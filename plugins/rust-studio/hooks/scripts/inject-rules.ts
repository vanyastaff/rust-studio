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
    [key: string]: unknown;
  };
}

/** Files and added text carried by a Codex `apply_patch` blob.
 *
 *  Claude names the file it is about to touch in `tool_input.file_path`. Codex
 *  hands the whole edit over as one patch document instead, so without this the
 *  injector saw no path and every path-scoped standard stayed silent on Codex.
 *  The blob is located by its `*** Begin Patch` marker in whichever string field
 *  carries it, rather than by field name, so it keeps working if the wrapper key
 *  changes. Format verified against real Codex session transcripts. */
export function applyPatchTargets(toolInput: Record<string, unknown> | undefined): {
  paths: string[];
  added: string;
} {
  const blob = Object.values(toolInput ?? {}).find(
    (v): v is string => typeof v === "string" && v.includes("*** Begin Patch"),
  );
  if (!blob) return { paths: [], added: "" };

  const paths: string[] = [];
  const added: string[] = [];
  for (const line of blob.split("\n")) {
    const file = /^\*\*\* (?:Add|Update|Delete|Move) File: (.+?)\s*$/.exec(line);
    if (file) {
      paths.push(file[1]);
      continue;
    }
    // `+++`/`---` are diff headers, not content; a lone `+` prefix is an added line.
    if (line.startsWith("+") && !line.startsWith("+++")) added.push(line.slice(1));
  }
  return { paths: [...new Set(paths)], added: added.join("\n") };
}

// Main flow is guarded so importing this module (tests import globToRegex /
// pathMatches) doesn't read stdin, arm the watchdog, or process.exit the host.
if (import.meta.main) {
  const disarm = watchdog();
  const data = await readInput<Input>();
  disarm();

  const event = data.hook_event_name || "PreToolUse";
  const filePath = data.tool_input?.file_path || data.tool_input?.path || "";
  const patch = applyPatchTargets(data.tool_input);
  // One path on Claude, potentially several on Codex — a single apply_patch can
  // rewrite a whole module. Rules are unioned over every file the edit touches.
  const norms = (filePath ? [String(filePath)] : patch.paths).map((p) => p.replace(/\\/g, "/"));
  if (!norms.length) done();
  const norm = norms[0];

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
    if (norms.some((n) => pathMatches(globs, n))) matched.push({ name, desc });
  }

  // Content trigger: an edit that introduces or touches `unsafe` pulls in the
  // unsafe standard (which carries no path glob) — restoring what the removed
  // unsafe-guard hook used to do, now folded into this one injector.
  const payload = [
    data.tool_input?.content,
    data.tool_input?.new_string,
    data.tool_input?.old_string,
    ...(data.tool_input?.edits || []).flatMap((e) => [e?.new_string, e?.old_string]),
    patch.added,
  ]
    .filter(Boolean)
    .join("\n");
  // Only a real unsafe CONSTRUCT in a Rust file pulls in unsafe.md — not the bare
  // word "unsafe" in prose/comments/markdown, not the `unsafe_op_in_unsafe_fn` lint
  // name, and not a doc that merely discusses unsafe. Match `unsafe` immediately
  // followed by a block/fn/impl/trait/extern.
  const touchesUnsafe =
    norms.some((n) => n.endsWith(".rs")) &&
    /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b|extern\b)/.test(payload);
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

  // Announce each rule at most once per session — keyed by RULE, not by file.
  // Keying by path meant core.md's pointer was re-injected once per file touched:
  // measured at 12 re-announcements and ~70% of all rule-pointer tokens in a
  // 12-file session (`bun tools/context-cost.ts`). Telling an agent to read
  // core.md a twelfth time carries no information the first eleven didn't; it
  // just dilutes attention as the session grows. PreCompact clears these markers,
  // so a rule is re-announced exactly when the context holding it was discarded —
  // re-injection tracks actual context loss instead of file count.
  //
  // Fail-open: any fs error just means we inject (never wedge the session).
  // No session_id → no dedupe key: a shared "nosession" marker would persist in
  // tmp and suppress rule injection for every LATER id-less session. Rules are
  // high-value; fail toward injecting (skip the dedupe entirely).
  let fresh = matched;
  try {
    if (!data.session_id) throw new Error("no session key");
    const dir = join(tmpdir(), "rust-studio-rules");
    const sid = String(data.session_id).replace(/[^A-Za-z0-9]/g, "_");
    mkdirSync(dir, { recursive: true });
    fresh = matched.filter((r) => !existsSync(join(dir, `${sid}__rule__${r.name}`)));
    if (!fresh.length) done(); // every applicable standard is already in context
    for (const r of fresh) writeFileSync(join(dir, `${sid}__rule__${r.name}`), "1");
  } catch {
    /* inject anyway */
  }

  // Emit POINTERS, not bodies. Each matching rule contributes one bullet: name +
  // one-line description + the absolute path to Read on demand. core.md is first in
  // `matched` so the universal baseline always heads the list. Safety/security-
  // critical rules are flagged REQUIRED so the agent does not skip the read.
  const root = pluginRoot().replace(/\\/g, "/").replace(/\/+$/, "");
  const CRITICAL = new Set(["unsafe", "ffi", "security"]);

  // Name every file when the edit spans several, so the agent can tell which
  // standard it is being held to on which file.
  const scope =
    norms.length === 1
      ? `\`${basename(norm)}\``
      : norms.map((n) => `\`${basename(n)}\``).join(", ");
  const header =
    `Path-scoped Rust standards apply to ${scope} (Rust Code Studio). ` +
    "These are BINDING — do not shape the edit from memory. Before you finish this " +
    "edit, **read each rule below**:\n";

  const bullets = fresh.map((r) => {
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
