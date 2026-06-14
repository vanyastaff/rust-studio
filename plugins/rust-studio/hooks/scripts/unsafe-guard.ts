#!/usr/bin/env bun
// Rust Code Studio — unsafe guard (PostToolUse: Write|Edit).
//
// When an edited .rs file contains `unsafe`, inject the unsafe standards and a
// targeted reminder (every unsafe block needs a `// SAFETY:` invariant, miri,
// unsafe-auditor / SAFETY-GATE). Content-triggered, not path-scoped. Never fails.

import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readInput, emit, done, watchdog, pluginRoot } from "./_lib.ts";

const disarm = watchdog();

const UNSAFE_SITE = /\bunsafe\s*(\{|fn\b|impl\b|trait\b)/g;
const SAFETY_NOTE = /\/\/\s*SAFETY:/gi;

interface Input {
  tool_input?: { file_path?: string; path?: string; content?: string; new_string?: string };
}

const data = await readInput<Input>();
disarm();

const ti = data.tool_input || {};
const filePath = ti.file_path || ti.path || "";
if (!String(filePath).endsWith(".rs")) done();

let content: string;
try {
  content = readFileSync(String(filePath), "utf8");
} catch {
  content = ti.content || ti.new_string || "";
}

// Strip line comments cheaply so `unsafe` inside prose doesn't match, but keep
// the original for counting `// SAFETY:` notes.
const code = content
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");

const sites = (code.match(UNSAFE_SITE) || []).length;
if (sites === 0) done();
const safetyNotes = (content.match(SAFETY_NOTE) || []).length;

let body = "";
try {
  let text = readFileSync(join(pluginRoot(), "rules", "unsafe.md"), "utf8");
  if (text.startsWith("---")) text = text.split("---").slice(2).join("---");
  body = text.trim();
} catch {
  body = "";
}

const p = basename(String(filePath));
const gap = sites - safetyNotes;
const head = [
  `⚠️ \`unsafe\` present in \`${p}\` ` +
    `(${sites} unsafe site(s), ${safetyNotes} \`// SAFETY:\` note(s)).`,
];
if (gap > 0) {
  head.push(
    `At least ${gap} unsafe site(s) lack a \`// SAFETY:\` invariant comment. ` +
      "Add one above each unsafe block stating why it is sound.",
  );
}
head.push(
  "Before SAFETY-GATE passes: justify each block, document `# Safety` on any " +
    "`unsafe fn`, run `cargo +nightly miri test` where feasible, and have " +
    "`unsafe-auditor` review. Consider `/audit-unsafe`.",
);

let context = head.join("\n");
if (body) context += "\n\n---\n\n" + body;

emit({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: context,
  },
});
