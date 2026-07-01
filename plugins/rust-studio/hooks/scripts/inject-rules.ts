#!/usr/bin/env bun
// Rust Code Studio — path-scoped rule POINTERS (PreToolUse: Read|Write|Edit).
//
// BEFORE a source file is read or edited, find any rules/*.md whose `paths:`
// frontmatter glob matches the path and inject a COMPACT POINTER to each matching
// rule — its name, one-line description, and absolute path — instead of the full
// rule body. The agent reads the full standard on demand (Read tool). This keeps
// the binding standards in front of the agent while costing ~1 line per rule
// instead of 300–1300 tokens each, so a multi-file session no longer re-injects
// the same baselines (core.md, etc.) a dozen times over — the dominant source of
// context bloat measured by tools/context-cost.ts. Safety/security-critical rules
// are flagged REQUIRED to mitigate the agent skipping the read. Each matching path
// injects once per session (a tmp marker dedupes repeat reads/edits). Never fails
// the session.

import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { readInput, emit, done, watchdog, pluginRoot } from "./_lib.ts";

export function globToRegex(pattern: string): RegExp {
  pattern = pattern.trim().replace(/\\/g, "/");
  const n = pattern.length;
  let i = 0;
  const out: string[] = ["^"];
  while (i < n) {
    const c = pattern[i];
    if (c === "*") {
      if (i + 1 < n && pattern[i + 1] === "*") {
        i += 2;
        if (i < n && pattern[i] === "/") i += 1;
        out.push(".*");
      } else {
        out.push("[^/]*");
        i += 1;
      }
    } else if (c === "?") {
      out.push("[^/]");
      i += 1;
    } else {
      out.push(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      i += 1;
    }
  }
  out.push("$");
  return new RegExp(out.join(""), "s");
}

function parseFrontmatter(text: string): [Record<string, string>, string] {
  if (!text.startsWith("---")) return [{}, text];
  const parts = text.split("---");
  if (parts.length < 3) return [{}, text];
  const fmRaw = parts[1];
  const body = parts.slice(2).join("---");
  const fm: Record<string, string> = {};
  for (let line of fmRaw.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#") || !line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    fm[key] = val;
  }
  return [fm, body.replace(/^\n+/, "")];
}

export function pathMatches(globs: string, path: string): boolean {
  path = path.replace(/\\/g, "/");
  for (let raw of globs.split(",")) {
    raw = raw.trim();
    if (!raw) continue;
    try {
      if (globToRegex(raw).test(path)) return true;
      // A relative glob (no leading "**" or "/") is ^-anchored and can never match
      // the absolute tool path — retry it anchored anywhere. Covers both bare
      // names ("Cargo.toml") and relative dir globs ("src/**/*.rs").
      if (!raw.startsWith("**") && !raw.startsWith("/") && globToRegex("**/" + raw).test(path))
        return true;
    } catch {
      continue;
    }
  }
  return false;
}

interface Input {
  hook_event_name?: string;
  session_id?: string;
  tool_input?: {
    file_path?: string;
    path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    edits?: Array<{ old_string?: string; new_string?: string }>;
  };
}

// Main flow is guarded so importing this module (tests import globToRegex /
// pathMatches) doesn't read stdin, arm the watchdog, or process.exit the host.
if (import.meta.main) {
  const disarm = watchdog();
  const data = await readInput<Input>();
  disarm();

  const event = data.hook_event_name || "PreToolUse";
  const filePath = data.tool_input?.file_path || data.tool_input?.path || "";
  if (!filePath) done();
  const norm = String(filePath).replace(/\\/g, "/");

  const rulesDir = join(pluginRoot(), "rules");
  let entries: string[];
  try {
    if (!statSync(rulesDir).isDirectory()) done();
    entries = readdirSync(rulesDir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    done();
  }

  // Collect rules whose path glob matches. Rules with an empty `paths:` are
  // content-triggered (e.g. unsafe.md) and handled below, not by path.
  interface Rule {
    name: string;
    desc: string;
  }
  const matched: Rule[] = [];
  const contentTriggered: Rule[] = [];
  for (const f of entries!) {
    let text: string;
    try {
      text = readFileSync(join(rulesDir, f), "utf8");
    } catch {
      continue;
    }
    const [fm] = parseFrontmatter(text);
    const name = fm.name || basename(f, ".md");
    const desc = fm.description || "(see rule)";
    const globs = fm.paths || "";
    if (!globs) {
      contentTriggered.push({ name, desc });
      continue;
    }
    if (pathMatches(globs, norm)) matched.push({ name, desc });
  }

  // Content trigger: an edit that introduces or touches `unsafe` pulls in the
  // unsafe standard (which carries no path glob) — restoring what the removed
  // unsafe-guard hook used to do, now folded into this one injector.
  const payload = [
    data.tool_input?.content,
    data.tool_input?.new_string,
    data.tool_input?.old_string,
    ...(data.tool_input?.edits || []).flatMap((e) => [e?.new_string, e?.old_string]),
  ]
    .filter(Boolean)
    .join("\n");
  // Only a real unsafe CONSTRUCT in a Rust file pulls in unsafe.md — not the bare
  // word "unsafe" in prose/comments/markdown, not the `unsafe_op_in_unsafe_fn` lint
  // name, and not a doc that merely discusses unsafe. Match `unsafe` immediately
  // followed by a block/fn/impl/trait/extern.
  const touchesUnsafe =
    norm.endsWith(".rs") && /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b|extern\b)/.test(payload);
  if (touchesUnsafe) {
    for (const r of contentTriggered) {
      if (!matched.some((m) => m.name === r.name)) matched.push(r);
    }
  }

  if (!matched.length) done();

  // core.md is the universal baseline — sort it first so a length cap never drops
  // it; everything else stays alphabetical for stable, predictable output.
  matched.sort((a, b) =>
    a.name === "core" ? -1 : b.name === "core" ? 1 : a.name.localeCompare(b.name),
  );

  // Inject a given path's rules at most once per session — a Read followed by
  // several Edits to the same file shouldn't re-inject the same standard each time.
  // Fail-open: any fs error just means we inject (never wedge the session).
  // No session_id → no dedupe key: a shared "nosession" marker would persist in tmp
  // and suppress rule injection for every LATER id-less session. Rules are
  // high-value; fail toward injecting (skip the dedupe entirely).
  try {
    if (!data.session_id) throw new Error("no session key");
    const dir = join(tmpdir(), "rust-studio-rules");
    const sid = String(data.session_id).replace(/[^A-Za-z0-9]/g, "_");
    // Key the marker by whether `unsafe` is present so the first edit that
    // introduces unsafe still surfaces unsafe.md even if the path was seen before.
    const suffix = touchesUnsafe ? "__unsafe" : "";
    const marker = join(
      dir,
      `${sid}__${norm.replace(/[^A-Za-z0-9]/g, "_")}${suffix}`,
    );
    if (existsSync(marker)) done();
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker, "1");
  } catch {
    /* inject anyway */
  }

  // Emit POINTERS, not bodies. Each matching rule contributes one bullet: name +
  // one-line description + the absolute path to Read on demand. core.md is first in
  // `matched` so the universal baseline always heads the list. Safety/security-
  // critical rules are flagged REQUIRED so the agent does not skip the read.
  const root = pluginRoot().replace(/\\/g, "/").replace(/\/+$/, "");
  const CRITICAL = new Set(["unsafe", "ffi", "security"]);

  const header =
    `Path-scoped Rust standards apply to \`${basename(norm)}\` (Rust Code Studio). ` +
    "These are BINDING — do not shape the edit from memory. Before you finish this " +
    "edit, **read (Read tool) each rule below that you have not already read this " +
    "session**:\n";

  const bullets = matched.map((r) => {
    const ptr = `${root}/rules/${r.name}.md`;
    const tag = CRITICAL.has(r.name) ? " — ⚠️ **REQUIRED before this edit**" : "";
    return `- **${r.name}** — ${r.desc}${tag}\n    Read: \`${ptr}\``;
  });

  emit({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: header + "\n" + bullets.join("\n"),
    },
  });
}
