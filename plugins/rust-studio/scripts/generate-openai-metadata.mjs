#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(pluginRoot, "skills");
const checkOnly = process.argv.includes("--check");

const acronyms = new Map([
  ["adr", "ADR"],
  ["api", "API"],
  ["ci", "CI"],
  ["msrv", "MSRV"],
  ["pr", "PR"],
  ["tdd", "TDD"],
]);

// Keep shared SKILL.md frontmatter within the Agent Skills standard. Host-specific
// invocation policy belongs here, in the Codex metadata generator, rather than in the
// portable skill source.
const explicitOnlySkills = new Set([
  "add-dep",
  "commit",
  "eval-agents",
  "new-crate",
  "pr",
  "progress-bar",
  "publish",
  "worktree-sweep",
]);

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function readFrontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);

  const fields = new Map();
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
    if (field) fields.set(field[1], unquote(field[2]));
  }
  return fields;
}

function displayName(name) {
  return name
    .split("-")
    .map((part) => acronyms.get(part) ?? part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function firstSentence(description) {
  return description.split(/(?<=[.!?])\s+/u, 1)[0].replace(/[.!?]+$/u, "");
}

// Cut at the last CLAUSE boundary at or before `max`, falling back to a word
// boundary, then strip trailing punctuation and dangling function words. Cutting
// on whitespace alone left every one of the 58 blurbs ending mid-clause
// ("...with tests, clippy," / "...semver hazards, accidental"), which reads as a
// truncation bug in the one string Codex shows in its skill catalog.
const DANGLING = /\s+(a|an|the|and|or|with|for|to|then|in|of|from|by|on|at|into|as)$/iu;

function truncateAtWord(text, max) {
  if (text.length <= max) return text;
  const prefix = text.slice(0, max + 1);
  let cut = Math.max(
    prefix.lastIndexOf(", "),
    prefix.lastIndexOf("; "),
    prefix.lastIndexOf(": "),
    prefix.lastIndexOf(" — "),
  );
  if (cut < 25) cut = prefix.lastIndexOf(" ");
  let out = prefix
    .slice(0, cut > 24 ? cut : max)
    .trimEnd()
    .replace(/[\s,;:—-]+$/u, "");
  while (DANGLING.test(out)) out = out.replace(DANGLING, "").replace(/[\s,;:—-]+$/u, "");
  return out;
}

function shortSummary(description) {
  let summary = firstSentence(description)
    .replace(/^Use only in Claude Code when /u, "Claude Code: ")
    .replace(/^Use when /u, "")
    .replace(/^Use /u, "");
  summary = summary[0].toUpperCase() + summary.slice(1);
  return summary;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function render(name, fields) {
  const description = fields.get("description");
  if (!description) throw new Error(`${name}: missing description`);

  let shortDescription = truncateAtWord(shortSummary(description), 64);
  if (shortDescription.length < 25) shortDescription += " for Rust projects";
  // The Codex catalog bound. Trimming dangling words can only shorten, so a skill
  // whose description shrinks past the floor must be reworded at the source rather
  // than padded here — fail loudly instead of shipping an out-of-spec blurb.
  if (shortDescription.length < 25 || shortDescription.length > 64) {
    throw new Error(
      `${name}: short_description is ${shortDescription.length} chars (Codex spec: 25-64) — ` +
        `reword the SKILL.md description`,
    );
  }

  const sentence = firstSentence(description);
  const defaultPrompt = sentence.replace(/^Use\b/u, `Use $${name}`);
  const lines = [
    "interface:",
    `  display_name: ${yamlString(displayName(name))}`,
    `  short_description: ${yamlString(shortDescription)}`,
    `  default_prompt: ${yamlString(`${defaultPrompt}.`)}`,
  ];

  if (explicitOnlySkills.has(name)) {
    lines.push("policy:", "  allow_implicit_invocation: false");
  }

  return `${lines.join("\n")}\n`;
}

let stale = false;
for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const skillFile = path.join(skillsRoot, entry.name, "SKILL.md");
  if (!fs.existsSync(skillFile)) continue;

  const fields = readFrontmatter(skillFile);
  if (fields.get("name") !== entry.name) {
    throw new Error(`${entry.name}: frontmatter name does not match its directory`);
  }

  const output = render(entry.name, fields);
  const outputDir = path.join(skillsRoot, entry.name, "agents");
  const outputFile = path.join(outputDir, "openai.yaml");

  if (checkOnly) {
    const current = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8") : "";
    if (current !== output) {
      console.error(`stale: ${path.relative(pluginRoot, outputFile)}`);
      stale = true;
    }
    continue;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, output);
}

if (stale) process.exitCode = 1;
else console.log(checkOnly ? "OpenAI skill metadata in sync" : "Generated OpenAI skill metadata");
