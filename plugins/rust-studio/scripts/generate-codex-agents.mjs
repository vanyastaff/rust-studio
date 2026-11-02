#!/usr/bin/env node
// Convert the studio's Claude agent briefs (agents/*.md) into Codex custom agents
// (.toml files for ~/.codex/agents/ or a project's .codex/agents/).
//
// Codex plugins cannot bundle agent definitions, so this runs at install time
// (install.sh) or by hand:
//
//   node scripts/generate-codex-agents.mjs [outdir] [--routing <file>]
//   # default outdir: ~/.codex/agents; routing schema: docs/model-routing.md
//
// Mapping: name/description copy over; the markdown body becomes
// developer_instructions; agents that may not Write/Edit get a read-only sandbox.
// Claude model aliases are dropped by default, so generated agents inherit the
// parent session. An explicit local routing file can map those roles to Codex
// models and efforts without publishing provider-specific names in the plugin.
//
// Doc pointers are RESOLVED here, and that asymmetry is deliberate. Claude Code
// expands `${CLAUDE_PLUGIN_ROOT}` when it loads an agent brief — verified: a
// spawned agent sees a literal absolute path and reads the file. Codex cannot do
// the same, because (per the note above) it does not bundle agent definitions:
// these TOMLs land in ~/.codex/agents/, outside any plugin, so there is no plugin
// context to resolve against and the placeholder would reach the model verbatim
// as an unopenable path. Substituting `pluginRoot` is correct rather than merely
// convenient — it is the same tree these briefs were read from, so the docs the
// pointers name are the version-matched ones sitting beside them.

import fs from "node:fs";
import os from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsRoot = path.join(pluginRoot, "agents");
function parseArgs(args) {
  let outDir;
  let routingFile;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--routing") {
      routingFile = args[++index];
      if (!routingFile) throw new Error("--routing needs a JSON file path");
    } else if (!outDir) {
      outDir = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  return { outDir: outDir ?? path.join(os.homedir(), ".codex", "agents"), routingFile };
}

function loadRouting(file) {
  if (!file) return new Map();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot read routing file ${file}: ${error.message}`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("routing file must be a JSON object keyed by inherit, haiku, sonnet, or opus");
  }
  const allowedRoles = new Set(["inherit", "haiku", "sonnet", "opus"]);
  const route = new Map();
  for (const [role, value] of Object.entries(parsed)) {
    if (!allowedRoles.has(role)) throw new Error(`routing file has unknown role: ${role}`);
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new Error(`routing.${role} must be an object`);
    }
    const keys = Object.keys(value);
    if (keys.some((key) => key !== "model" && key !== "model_reasoning_effort")) {
      throw new Error(`routing.${role} only accepts model and model_reasoning_effort`);
    }
    if (value.model !== undefined && (typeof value.model !== "string" || !value.model)) {
      throw new Error(`routing.${role}.model must be a non-empty string`);
    }
    if (value.model_reasoning_effort !== undefined &&
        (typeof value.model_reasoning_effort !== "string" || !value.model_reasoning_effort)) {
      throw new Error(`routing.${role}.model_reasoning_effort must be a non-empty string`);
    }
    route.set(role, value);
  }
  return route;
}

const { outDir, routingFile } = parseArgs(process.argv.slice(2));
const routing = loadRouting(routingFile);

function parse(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
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

const catalog = JSON.parse(fs.readFileSync(path.join(pluginRoot, "catalog.json"), "utf8"));
const outputs = new Map();
for (const [catalogName, definition] of Object.entries(catalog.agents)) {
  if (!/^[a-z][a-z0-9-]*$/.test(catalogName)) throw new Error(`invalid catalog role: ${catalogName}`);
  const entry = `${catalogName}.md`;
  const { fields, body } = parse(path.join(agentsRoot, entry));
  const name = fields.get("name");
  const role = definition.model;
  if (name !== catalogName || fields.get("model") !== role) throw new Error(`${entry}: name/model differs from catalog.json`);
  const description = unquote(fields.get("description") ?? "");
  if (!name || !description || !body) throw new Error(`${entry}: missing name/description/body`);
  if (body.includes("'''")) throw new Error(`${entry}: body would break the TOML literal string`);

  const readOnly = /\bWrite\b/.test(fields.get("disallowedTools") ?? "");
  const route = routing.get(role) ?? {};

  // Resolve the Claude-only placeholder to a real path (see the header note), then
  // refuse to ship anything that still carries one — a stray `${CLAUDE_…}` in a
  // prompt is silent: the agent reads it as a path, cannot open it, and proceeds.
  const resolved = body.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
  const stray = resolved.match(/\$\{CLAUDE_[A-Z_]*\}/);
  if (stray) throw new Error(`${entry}: unresolved ${stray[0]} would ship to Codex as a literal`);

  const lines = [
    `# Generated by rust-studio scripts/generate-codex-agents.mjs — do not edit by hand.`,
    `# Doc pointers below resolve against: ${pluginRoot}`,
    `# Re-run the generator if that tree moves, or the pointers go stale.`,
    `name = ${tomlString(name)}`,
    `description = ${tomlString(description)}`,
    ...(route.model ? [`model = ${tomlString(route.model)}`] : []),
    ...(route.model_reasoning_effort ? [`model_reasoning_effort = ${tomlString(route.model_reasoning_effort)}`] : []),
    ...(readOnly ? ['sandbox_mode = "read-only"'] : []),
    `developer_instructions = '''`,
    resolved,
    `'''`,
    "",
  ];
  outputs.set(`${name}.toml`, lines.join("\n"));
}

// A header is not proof of ownership: old installers did not record hashes.
// Only an unchanged file recorded in this manifest can be replaced or retired.
const manifestPath = path.join(outDir, ".rust-studio-agents.json");
const digest = (data) => createHash("sha256").update(data).digest("hex");
const regular = (file) => { try { return fs.lstatSync(file).isFile(); } catch (e) { if (e.code === "ENOENT") return false; throw e; } };
let previous = { version: 1, files: {} };
if (present(".rust-studio-agents.json")) {
  if (!regular(manifestPath)) throw new Error("ownership manifest must be a regular file");
  previous = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (previous.version !== 1 || !previous.files || Array.isArray(previous.files) || typeof previous.files !== "object" ||
      Object.entries(previous.files).some(([name, hash]) => !/^[a-z][a-z0-9-]*\.toml$/.test(name) || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("invalid ownership manifest; no agent files were changed");
  }
}
fs.mkdirSync(outDir, { recursive: true });
const next = { version: 1, files: { ...previous.files } };
let count = 0, retired = 0, preserved = 0;
const warned = new Set();
function preserve(name, reason) {
  if (warned.has(name)) return;
  warned.add(name); preserved += 1;
  console.error(`preserved: ${name} (${reason}); resolve manually if this definition should be replaced`);
}
function owned(name) {
  const file = path.join(outDir, name);
  return regular(file) && previous.files[name] === digest(fs.readFileSync(file));
}
function present(name) {
  try { fs.lstatSync(path.join(outDir, name)); return true; } catch (e) { if (e.code === "ENOENT") return false; throw e; }
}
for (const [name, output] of outputs) {
  if (present(name) && !owned(name)) { preserve(name, "customized or unknown ownership"); continue; }
  // Exclusive creation avoids overwriting an unknown file introduced since inspection.
  if (!present(name)) fs.writeFileSync(path.join(outDir, name), output, { flag: "wx" });
  else fs.writeFileSync(path.join(outDir, name), output);
  next.files[name] = digest(output); count += 1;
}
for (const name of Object.keys(previous.files)) {
  if (outputs.has(name)) continue;
  if (!present(name)) { delete next.files[name]; continue; }
  if (!owned(name)) { preserve(name, "modified previously generated definition"); continue; }
  fs.unlinkSync(path.join(outDir, name)); delete next.files[name]; retired += 1;
}
for (const definition of Object.values(catalog.agents)) {
  for (const legacy of Object.keys(definition.legacy ?? {})) {
    const name = `${legacy}.toml`;
    if (!outputs.has(name) && present(name)) preserve(name, "legacy definition has no unchanged ownership evidence");
  }
}
fs.writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`codex agents: ${count} written, ${retired} retired, ${preserved} preserved in ${outDir}${routingFile ? ` with routing ${routingFile}` : ""}`);
