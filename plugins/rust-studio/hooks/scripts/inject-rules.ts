#!/usr/bin/env bun
// Rust Code Studio — path-scoped rule injection (PreToolUse: Read|Write|Edit).
//
// BEFORE a source file is read or edited, find any rules/*.md whose `paths:`
// frontmatter glob matches the path and inject that rule's body as
// additionalContext, so the relevant Rust standard is in front of the agent
// BEFORE it shapes the first draft (firing on Read is what gets the rules in
// ahead of the first edit, not after it). Each matching path injects once per
// session (a tmp marker dedupes repeat reads/edits). Never fails the session.

import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { readInput, emit, done, watchdog, pluginRoot } from "./_lib.ts";

const disarm = watchdog();

function globToRegex(pattern: string): RegExp {
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

function pathMatches(globs: string, path: string): boolean {
  path = path.replace(/\\/g, "/");
  for (let raw of globs.split(",")) {
    raw = raw.trim();
    if (!raw) continue;
    try {
      if (globToRegex(raw).test(path)) return true;
      if (!raw.includes("/") && globToRegex("**/" + raw).test(path)) return true;
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
  body: string;
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
  const [fm, body] = parseFrontmatter(text);
  const name = fm.name || basename(f, ".md");
  const globs = fm.paths || "";
  if (!globs) {
    contentTriggered.push({ name, body: body.trim() });
    continue;
  }
  if (pathMatches(globs, norm)) matched.push({ name, body: body.trim() });
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
const touchesUnsafe = /\bunsafe\b/.test(payload);
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
try {
  const dir = join(tmpdir(), "rust-studio-rules");
  const sid = (data.session_id || "nosession").replace(/[^A-Za-z0-9]/g, "_");
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

const header =
  `Path-scoped Rust standards apply to \`${basename(norm)}\` ` +
  "(Rust Code Studio). Conform the edit to these:\n\n";

// Budget the injection: keep whole rules in priority order until the cap, then
// NAME any that didn't fit (instead of silently slicing mid-rule) so the agent
// can read them directly. core.md is first in `matched`, so it always lands.
const BUDGET = 18000;
const sep = "\n\n---\n\n";
const kept: string[] = [];
const elided: string[] = [];
let used = header.length;
for (const r of matched) {
  const cost = (kept.length ? sep.length : 0) + r.body.length;
  if (kept.length && used + cost > BUDGET) {
    elided.push(r.name);
    continue;
  }
  kept.push(r.body);
  used += cost;
}
let context = header + kept.join(sep);
if (elided.length) {
  context +=
    `${sep}…${elided.length} more standard(s) apply but were elided for length: ` +
    `${elided.join(", ")} — read \`\${CLAUDE_PLUGIN_ROOT}/rules/<name>.md\` directly.`;
}

emit({
  hookSpecificOutput: {
    hookEventName: event,
    additionalContext: context,
  },
});
