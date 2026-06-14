#!/usr/bin/env bun
// Rust Code Studio — path-scoped rule injection (PostToolUse: Write|Edit).
//
// After a file is written/edited, find any rules/*.md whose `paths:` frontmatter
// glob matches the edited path and inject that rule's body as additionalContext,
// so the relevant Rust standard is in front of the agent. Never fails the session.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
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
  tool_input?: { file_path?: string; path?: string };
}

const data = await readInput<Input>();
disarm();

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

const chunks: string[] = [];
for (const f of entries!) {
  let text: string;
  try {
    text = readFileSync(join(rulesDir, f), "utf8");
  } catch {
    continue;
  }
  const [fm, body] = parseFrontmatter(text);
  const globs = fm.paths || "";
  if (!globs) continue; // e.g. unsafe.md (content-triggered elsewhere)
  if (pathMatches(globs, norm)) chunks.push(body.trim());
}

if (!chunks.length) done();

const header =
  `Path-scoped Rust standards apply to \`${basename(norm)}\` ` +
  "(Rust Code Studio). Conform the edit to these:\n\n";
let context = header + chunks.join("\n\n---\n\n");
if (context.length > 8000) context = context.slice(0, 8000) + "\n\n…(truncated)";

emit({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: context,
  },
});
