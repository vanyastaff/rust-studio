#!/usr/bin/env bun
// Rust Code Studio — minimal Cargo.toml reading shared by the session-start and
// sub-agent-start briefs. No TOML dependency: only the handful of fields the briefs
// print are extracted, and every function tolerates a manifest it cannot parse.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
    edition: field(pkg, "edition") || "?",
    msrv: field(pkg, "rust-version"),
    isWorkspace,
    members,
    domains: classify(text.toLowerCase()),
  };
}
