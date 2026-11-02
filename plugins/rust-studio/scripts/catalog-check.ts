#!/usr/bin/env bun
/** Validate the public inventory and every migration destination from catalog.json. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative, isAbsolute, dirname } from "node:path";

type Operation = { mode: string; procedure: string };
type Catalog = {
  version: number;
  skills: Record<string, { legacy: string[]; explicitOnly: boolean; pluginOnly: boolean; operations: Record<string, Operation> }>;
  agents: Record<string, { legacy: Record<string, string>; model: string }>;
  profiles: Record<string, string>;
  priorAliases: Record<string, { skill: string; mode: string }>;
};
export function checkCatalog(root: string): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);
  const catalog: Catalog = JSON.parse(readFileSync(resolve(root, "catalog.json"), "utf8"));
  if (catalog.version !== 1) fail("catalog.json: unsupported version");
  const names = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  const skills = Object.keys(catalog.skills), agents = Object.keys(catalog.agents);
  const exact = (label: string, actual: string[], expected: string[]) => {
    for (const name of actual) if (!expected.includes(name)) fail(`${label}: unexpected ${name} (aliases must not remain installed)`);
    for (const name of expected) if (!actual.includes(name)) fail(`${label}: missing ${name}`);
  };
  if (skills.length !== 11 || agents.length !== 5) fail(`catalog.json: expected 11 skills and 5 roles, got ${skills.length}/${agents.length}`);
  if (Object.values(catalog.skills).filter(s => s.explicitOnly).length !== 3) fail("catalog.json: expected three explicit-only entries");
  if (Object.values(catalog.skills).filter(s => s.pluginOnly).length !== 1) fail("catalog.json: expected one plugin-only entry");
  for (const name of [...skills, ...agents]) if (!names.test(name) || name.length > 64) fail(`catalog.json: invalid name ${name}`);
  const dirs = readdirSync(resolve(root, "skills"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  exact("skills", dirs, skills);
  exact("agents", readdirSync(resolve(root, "agents")).filter(n => n.endsWith(".md")).map(n => n.slice(0, -3)), agents);
  const sourcePath = (file: string, context: string) => {
    const resolved = resolve(root, file), rel = relative(root, resolved);
    if (isAbsolute(file) || rel.startsWith("..") || isAbsolute(rel) || !existsSync(resolved)) { fail(`${context}: missing or unsafe destination ${file}`); return undefined; }
    return resolved;
  };
  const legacySkills = new Set<string>(), legacyAgents = new Set<string>();
  for (const [name, skill] of Object.entries(catalog.skills)) {
    if (typeof skill.explicitOnly !== "boolean" || typeof skill.pluginOnly !== "boolean") fail(`${name}: invocation policy must be boolean`);
    if (skill.pluginOnly && !skill.explicitOnly) fail(`${name}: plugin-only maintenance must be explicit-only`);
    const entry = sourcePath(`skills/${name}/SKILL.md`, name);
    if (entry && !new RegExp(`^name: ${name}\\r?$`, "m").test(readFileSync(entry, "utf8"))) fail(`${name}: frontmatter name differs`);
    const profileBundle = resolve(root, "skills", name, "references/profiles");
    if (existsSync(profileBundle)) {
      for (const file of readdirSync(profileBundle).filter(file => file.endsWith(".md"))) {
        const text = readFileSync(resolve(profileBundle, file), "utf8");
        if (/\$\{CLAUDE_PLUGIN_ROOT\}\/(?:hooks\/)?scripts\//.test(text)) fail(`${name}/${file}: unresolved host-root helper`);
        for (const [, helper] of text.matchAll(/\b(scripts\/[a-z0-9_-]+\.(?:ts|sh|mjs))/g)) {
          if (!existsSync(resolve(root, "skills", name, helper))) fail(`${name}/${file}: missing profile helper ${helper}`);
        }
      }
    }
    const scripts = resolve(root, "skills", name, "scripts");
    if (existsSync(scripts)) {
      for (const helper of readdirSync(scripts).filter(file => /\.(ts|mjs)$/.test(file) && !file.endsWith(".test.ts"))) {
        const source = resolve(scripts, helper);
        for (const [, dependency] of readFileSync(source, "utf8").matchAll(/(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)) {
          const target = resolve(dirname(source), dependency);
          if (!existsSync(target) || relative(resolve(root, "skills", name), target).startsWith("..")) fail(`${name}/${helper}: missing or nonportable import ${dependency}`);
        }
      }
      if (existsSync(resolve(scripts, "catalog.ts"))) {
        sourcePath(`skills/${name}/scripts/catalog.json`, `${name} migration registry`);
        for (const profile of Object.keys(catalog.profiles)) sourcePath(`skills/${name}/references/profiles/${profile}.md`, `${name} profile ${profile}`);
      }
    }
    exact(`${name} operations`, Object.keys(skill.operations), skill.legacy);
    for (const old of skill.legacy) {
      if (legacySkills.has(old)) fail(`legacy skill ${old}: duplicate migration`);
      legacySkills.add(old);
      if (skills.includes(old) || existsSync(resolve(root, "skills", old))) fail(`legacy skill ${old}: installed alias remains`);
      const operation = skill.operations[old];
      if (!operation?.mode || !names.test(operation.mode)) fail(`${name}/${old}: missing valid mode`);
      if (typeof operation?.procedure !== "string" || !operation.procedure) { fail(`${name}/${old}: missing procedure destination`); continue; }
      const [file, anchor] = operation.procedure.split("#");
      if (!file.startsWith("docs/") || !file.endsWith(".md")) { fail(`${name}/${old}: procedure must name a canonical docs Markdown file`); continue; }
      const procedure = sourcePath(file, `${name}/${old}`);
      if (procedure && anchor) {
        const headings = [...readFileSync(procedure, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").trim().replace(/\s/g, "-"));
        if (!headings.includes(anchor)) fail(`${name}/${old}: missing procedure anchor ${anchor}`);
      }
      sourcePath(`skills/${name}/references/${file.slice(5)}`, `${name}/${old} standalone bundle`);
    }
  }
  for (const [name, agent] of Object.entries(catalog.agents)) {
    const brief = sourcePath(`agents/${name}.md`, name);
    if (brief) {
      const text = readFileSync(brief, "utf8");
      if (!new RegExp(`^name: ${name}\\r?$`, "m").test(text)) fail(`${name}: brief name differs`);
      if (!new RegExp(`^model: ${agent.model}\\r?$`, "m").test(text)) fail(`${name}: model class differs from catalog`);
    }
    for (const [old, profile] of Object.entries(agent.legacy)) {
      if (legacyAgents.has(old)) fail(`legacy agent ${old}: duplicate migration`);
      legacyAgents.add(old);
      if (agents.includes(old) || existsSync(resolve(root, "agents", `${old}.md`))) fail(`legacy agent ${old}: installed alias remains`);
      if (!catalog.profiles[profile]) fail(`${name}/${old}: unknown required profile ${profile}`);
    }
  }
  for (const [name, file] of Object.entries(catalog.profiles)) {
    if (!file.startsWith("docs/profiles/") || !file.endsWith(".md")) fail(`${name}: profile must name docs/profiles/*.md`);
    sourcePath(file, `profile ${name}`);
  }
  if (legacySkills.size !== 59 || legacyAgents.size !== 33) fail(`migration coverage: expected 59 skills and 33 agents, got ${legacySkills.size}/${legacyAgents.size}`);
  for (const [old, destination] of Object.entries(catalog.priorAliases)) {
    if (legacySkills.has(old) || skills.includes(old)) fail(`prior alias ${old}: duplicate migration`);
    if (!catalog.skills[destination.skill] || !names.test(destination.mode)) fail(`prior alias ${old}: invalid destination`);
    if (existsSync(resolve(root, "skills", old))) fail(`prior alias ${old}: installed alias remains`);
  }
  return errors;
}
if (import.meta.main) {
  if (process.argv.includes("--help")) { console.log("Usage: bun scripts/catalog-check.ts [plugin-root]\nValidate exact inventory, migration coverage, procedures and profiles."); }
  else {
    try {
      const errors = checkCatalog(resolve(process.argv[2] ?? resolve(import.meta.dir, "..")));
      if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
      else console.log("catalog valid: 11 skills, 5 roles, 59 skill migrations, 33 agent migrations");
    } catch (error) { console.error(`catalog invalid: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; }
  }
}
