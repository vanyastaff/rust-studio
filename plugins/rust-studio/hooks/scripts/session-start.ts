#!/usr/bin/env bun
// Rust Code Studio — SessionStart hook.
//
// Detects a Rust project at the session cwd and injects a concise studio
// briefing (detected stack + domain classification + collaboration protocol) as
// additionalContext. Never fails the session: on any error it exits 0 silently.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readInput, emit, watchdog } from "./_lib.ts";

const disarm = watchdog();

// --- minimal Cargo.toml field extraction (no TOML dep; only the fields used) ---
function section(text: string, name: string): string {
  // returns the body of [name] up to the next top-level [header] (or EOF).
  // Line-based to avoid JS-regex edge cases (no `\Z`; `$` is line-end under /m).
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
function field(body: string, key: string): string | null {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']*)["']`, "m").exec(body);
  return m ? m[1] : null;
}

function classify(textLower: string): string[] {
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

interface Input {
  cwd?: string;
}

const data = await readInput<Input>();
disarm();

const cwd = data.cwd || process.cwd();
const manifest = join(cwd, "Cargo.toml");

let manifestExists = false;
try {
  manifestExists = statSync(manifest).isFile();
} catch {
  manifestExists = false;
}

if (!manifestExists) {
  emit({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        "Rust Code Studio plugin is active, but no Cargo.toml was found at the " +
        "session root. If this is a Rust project, run /detect-stack from its root. " +
        "Studio protocol: Question → Options → Decision → Draft → Approval.",
    },
  });
}

let text = "";
try {
  text = readFileSync(manifest, "utf8");
} catch {
  text = "";
}

const pkg = section(text, "package");
const name = field(pkg, "name") || "?";
const edition = field(pkg, "edition") || "?";
const msrv = field(pkg, "rust-version") || "(unset)";

const isWorkspace = /^\[workspace\]\s*$/m.test(text);
let members = 0;
if (isWorkspace) {
  const ws = section(text, "workspace");
  const mm = /members\s*=\s*\[([\s\S]*?)\]/.exec(ws);
  if (mm) members = (mm[1].match(/["'][^"']+["']/g) || []).length;
}

const domains = classify(text.toLowerCase());

const lines = [
  "## Rust Code Studio active",
  "",
  `Detected Rust project at \`${cwd}\`.`,
  `- Crate/workspace: **${name}**` + (isWorkspace ? ` (workspace, ${members} member globs)` : ""),
  `- Edition: ${edition}   MSRV (rust-version): ${msrv}`,
  `- Domain(s): **${domains.join(", ")}**`,
  "",
  "**Protocol:** a quality loop, **autonomy-first** — decide tactical calls yourself " +
    "(state the choice + one-line rationale, then proceed); ask only on " +
    "strategic/irreversible/outward steps. No quick wins, no shims, finish the cross-crate " +
    "ripple; observability ships in the same pass. See docs/working-preferences.md.",
  "**Team:** directors (chief-architect, product-steward) → leads → specialists. " +
    "Path-scoped Rust standards are injected automatically when you edit matching files.",
  "**Start here:** `/start` for guided onboarding, `/help` for the catalog, " +
    "`/dev-task` to implement one unit of work, `/review` to audit a diff.",
  "**Skills first:** for any non-trivial task, check `/help` for a studio skill that fits " +
    "before improvising — prefer the skill's discipline (gates, agents, evidence) over ad-hoc steps.",
];

if (isWorkspace && members) {
  lines.push(
    "",
    `**Large workspace (${members} member globs):** scope context to the crate you ` +
      "touch — per-crate CLAUDE.md, `permissions.deny` on target/generated, and " +
      "`rust-analyzer-lsp` for symbol lookup. Run `/adopt` or see docs/large-workspace.md.",
  );
}

emit({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: lines.join("\n"),
  },
});
