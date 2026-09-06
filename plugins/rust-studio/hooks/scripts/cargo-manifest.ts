#!/usr/bin/env bun
// Rust Code Studio — minimal Cargo.toml reading shared by the session-start and
// sub-agent-start briefs. No TOML dependency: only the handful of fields the briefs
// print are extracted, and every function tolerates a manifest it cannot parse.

import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The body of `[name]` (top-level table only; array tables and dotted keys are not needed). */
export function section(text: string, name: string): string {
  const out: string[] = [];
  let inSec = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) {
      inSec = line.trim() === `[${name}]`;
      continue;
    }
    if (inSec) out.push(line);
  }
  return out.join("\n");
}

/** `key = "value"` inside a section body, or null. */
export function field(body: string, key: string): string | null {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']*)["']`, "m").exec(body);
  return m ? m[1] : null;
}

/** True when a field is inherited (`key.workspace = true`) rather than set here. */
export function inherits(body: string, key: string): boolean {
  return new RegExp(`^\\s*${key}\\.workspace\\s*=\\s*true`, "m").test(body);
}

/** A field read from `[package]`, falling back to `[workspace.package]` in the SAME file.
 *  Covers the common root manifest that is both a package and the workspace, and the
 *  virtual manifest where `[package]` is absent entirely. */
function packageField(text: string, key: string): string | null {
  const pkg = section(text, "package");
  const direct = field(pkg, key);
  if (direct !== null) return direct;
  return field(section(text, "workspace.package"), key);
}

/** Directories from `start` up to the filesystem root, nearest first. Depth-capped so a
 *  pathological path can never turn a hook into a long walk. */
function ancestors(start: string, max = 24): string[] {
  const out: string[] = [];
  let dir = resolve(start);
  for (let i = 0; i < max; i++) {
    out.push(dir);
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return out;
}

function readManifest(dir: string): string | null {
  try {
    const p = join(dir, "Cargo.toml");
    if (!statSync(p).isFile()) return null;
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

export interface CrateFloor {
  /** `rust-version`, following `workspace = true` inheritance to the workspace root. */
  msrv: string | null;
  edition: string | null;
  /** Directory of the manifest the crate belongs to, or null when there is none. */
  manifestDir: string | null;
}

/** The MSRV/edition floor that governs a file, resolved from the nearest enclosing crate.
 *
 *  Walking up matters in a workspace: the file being edited belongs to a member crate whose
 *  floor is its own or the workspace's, and neither is necessarily what sits at the session
 *  cwd. A field marked `workspace = true` — or simply absent — continues the walk to the
 *  manifest that declares `[workspace.package]`. */
export function crateFloor(startDir: string): CrateFloor {
  const out: CrateFloor = { msrv: null, edition: null, manifestDir: null };
  for (const dir of ancestors(startDir)) {
    const text = readManifest(dir);
    if (text === null) continue;
    if (out.manifestDir === null) out.manifestDir = dir;
    const pkg = section(text, "package");
    if (out.msrv === null && !inherits(pkg, "rust-version")) out.msrv = packageField(text, "rust-version");
    if (out.edition === null && !inherits(pkg, "edition")) out.edition = packageField(text, "edition");
    // A workspace root ends the walk: nothing above it governs this crate.
    if (/^\[workspace\]\s*$/m.test(text)) break;
  }
  return out;
}

/** Coarse domain classification from the lower-cased manifest text. */
export function classify(textLower: string): string[] {
  const hay = textLower;
  const domains: string[] = [];
  if (
    hay.includes("#![no_std]") ||
    hay.includes("embedded-hal") ||
    hay.includes("cortex-m") ||
    hay.includes("no-std")
  )
    domains.push("systems/embedded");
  if (["tokio", "axum", "actix-web", "actix_web", "hyper", "tower", "sqlx", "async-std"].some((k) => hay.includes(k)))
    domains.push("async/web");
  if (["clap", "ratatui", "crossterm"].some((k) => hay.includes(k)) || hay.includes("[[bin]]"))
    domains.push("cli");
  if (hay.includes("[lib]")) domains.push("library/crate");
  const seen: string[] = [];
  for (const d of domains) if (!seen.includes(d)) seen.push(d);
  return seen.length ? seen : ["(undetermined — run /detect-stack)"];
}

export interface ManifestSummary {
  /** `[package] name`, or "?" when absent (a virtual workspace root). */
  name: string;
  edition: string;
  /** `rust-version`, or null when the manifest does not declare one. */
  msrv: string | null;
  isWorkspace: boolean;
  /** Count of `members = [...]` globs (0 when not a workspace). */
  members: number;
  domains: string[];
}

/** Summarize `<cwd>/Cargo.toml`, or null when there is none. */
export function summarizeManifest(cwd: string): ManifestSummary | null {
  const manifest = join(cwd, "Cargo.toml");
  let text: string;
  try {
    if (!statSync(manifest).isFile()) return null;
    text = readFileSync(manifest, "utf8");
  } catch {
    return null;
  }
  const pkg = section(text, "package");
  const isWorkspace = /^\[workspace\]\s*$/m.test(text);
  let members = 0;
  if (isWorkspace) {
    const mm = /members\s*=\s*\[([\s\S]*?)\]/.exec(section(text, "workspace"));
    if (mm) members = (mm[1].match(/["'][^"']+["']/g) || []).length;
  }
  return {
    name: field(pkg, "name") || "?",
    // Both are commonly declared once under `[workspace.package]` and inherited; reading
    // only `[package]` reported "?" / unset for most real workspaces.
    edition: packageField(text, "edition") || "?",
    msrv: packageField(text, "rust-version"),
    isWorkspace,
    members,
    domains: classify(text.toLowerCase()),
  };
}
