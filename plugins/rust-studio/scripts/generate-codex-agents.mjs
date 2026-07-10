#!/usr/bin/env node
// Convert the studio's Claude agent briefs (agents/*.md) into Codex custom agents
// (.toml files for ~/.codex/agents/ or a project's .codex/agents/).
//
// Codex plugins cannot bundle agent definitions, so this runs at install time
// (install.sh) or by hand:
//
//   node scripts/generate-codex-agents.mjs [outdir]   # default: ~/.codex/agents
//
// Mapping: name/description copy over; the markdown body becomes
// developer_instructions; agents that may not Write/Edit get a read-only sandbox.
// Claude model aliases (sonnet/haiku/inherit) are dropped — the agent inherits
// the parent session's model, which is the portable behavior.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsRoot = path.join(pluginRoot, "agents");
const outDir = process.argv[2] ?? path.join(os.homedir(), ".codex", "agents");

function parse(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);

  const fields = new Map();
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
    if (field) fields.set(field[1], field[2].trim());
  }
  return { fields, body: match[2].trim() };
}

function unquote(value) {
  return value.startsWith('"') && value.endsWith('"') ? JSON.parse(value) : value;
}

// TOML basic strings share JSON's escape set, so JSON.stringify emits valid TOML.
const tomlString = (s) => JSON.stringify(s);

fs.mkdirSync(outDir, { recursive: true });
let count = 0;
for (const entry of fs.readdirSync(agentsRoot).sort()) {
  if (!entry.endsWith(".md")) continue;
  const { fields, body } = parse(path.join(agentsRoot, entry));
  const name = fields.get("name");
  const description = unquote(fields.get("description") ?? "");
  if (!name || !description || !body) throw new Error(`${entry}: missing name/description/body`);
  if (body.includes("'''")) throw new Error(`${entry}: body would break the TOML literal string`);

  const readOnly = /\bWrite\b/.test(fields.get("disallowedTools") ?? "");
  const lines = [
    `name = ${tomlString(name)}`,
    `description = ${tomlString(description)}`,
    ...(readOnly ? ['sandbox_mode = "read-only"'] : []),
    `developer_instructions = '''`,
    body,
    `'''`,
    "",
  ];
  fs.writeFileSync(path.join(outDir, `${name}.toml`), lines.join("\n"));
  count += 1;
}

console.log(`codex agents: ${count} written to ${outDir}`);
