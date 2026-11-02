// Read-only migration registry. Resolution preserves provenance and grants no authority.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface MigrationCatalog {
  skills: Record<string, { legacy: string[]; operations: Record<string, { mode: string }> }>;
  agents: Record<string, { legacy: Record<string, string>; model: string }>;
  profiles: Record<string, string>;
  priorAliases?: Record<string, { skill: string; mode: string }>;
}
export interface CatalogRegistry { root: string; catalog: MigrationCatalog }

export function readMigrationCatalog(root?: string): CatalogRegistry {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = root ? [resolve(root)] : [here, resolve(here, "../..")];
  for (const candidate of candidates) {
    const path = join(candidate, "catalog.json");
    if (existsSync(path)) return { root: candidate, catalog: JSON.parse(readFileSync(path, "utf8")) };
  }
  throw new Error("catalog.json is missing; migration cannot be resolved");
}

const bare = (name: string) => name.replace(/^rust[-_ ]?studio[:/ -]/i, "").trim();
export function resolveSkill(name: string, registry = readMigrationCatalog()): { rawName: string; skill: string; mode: string | null } | null {
  const label = bare(name);
  if (registry.catalog.skills[label]) return { rawName: name, skill: label, mode: null };
  for (const [skill, entry] of Object.entries(registry.catalog.skills)) {
    if (entry.legacy.includes(label)) return { rawName: name, skill, mode: entry.operations[label].mode };
  }
  const alias = registry.catalog.priorAliases?.[label];
  return alias ? { rawName: name, ...alias } : null;
}

/** A profile is knowledge, never permission. Missing files block dispatch with that lens. */
export function profilePath(profile: string, registry = readMigrationCatalog()): string {
  const declared = registry.catalog.profiles[profile];
  if (!declared) throw new Error(`unknown profile: ${profile}`);
  for (const path of [join(registry.root, declared), join(registry.root, "../references/profiles", `${profile}.md`)]) {
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  throw new Error(`required profile is missing: ${profile} (${declared})`);
}

/** Default migration only. Callers select an execution role from action and independence,
 * not from the old specialist's name. Never mutate an existing task or its repair history. */
export function resolveAgent(name: string, registry = readMigrationCatalog()): { rawName: string; role: string; profile: string | null; model: string } | null {
  const label = bare(name);
  const current = registry.catalog.agents[label];
  if (current) return { rawName: name, role: label, profile: null, model: current.model };
  for (const [role, entry] of Object.entries(registry.catalog.agents)) {
    const profile = entry.legacy[label];
    if (profile) return { rawName: name, role, profile, model: entry.model };
  }
  return null;
}

export function selectAgent(name: string, role: string, profiles: string[] = [], registry = readMigrationCatalog()) {
  const legacy = resolveAgent(name, registry);
  if (!legacy) throw new Error(`unknown agent label: ${name}`);
  const selected = registry.catalog.agents[role];
  if (!selected) throw new Error(`unknown execution role: ${role}`);
  const lenses = [...new Set([...(legacy?.profile ? [legacy.profile] : []), ...profiles])];
  return { rawName: name, role, model: selected.model, profiles: lenses, profilePaths: lenses.map(p => profilePath(p, registry)) };
}

export const CATALOG_USAGE = `Read-only catalog resolution (no task edits, dispatch, authorization, or freshness claim):
  bun catalog.ts skill <current-or-legacy-name> [--root <catalog-directory>]
  bun catalog.ts agent <current-or-legacy-name> --role <requested-role> [--profiles <comma-list>] [--root <catalog-directory>]
Select role from the requested action and independence requirements. Legacy labels only supply domain knowledge.
JSON retains rawName; agent resolution checks that every required profile file exists.`;

export function catalogMain(argv: string[], out = console.log, error = console.error): number {
  try {
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) { out(CATALOG_USAGE); return 0; }
    const [kind, name, ...args] = argv;
    if (!name || !["skill", "agent"].includes(kind)) throw new Error("expected skill <name> or agent <name>");
    const options: Record<string, string> = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!["--root", "--role", "--profiles"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`invalid option: ${args[i]}`);
      options[args[i]] = args[i + 1];
    }
    const registry = readMigrationCatalog(options["--root"]);
    if (kind === "skill") {
      if (options["--role"] || options["--profiles"]) throw new Error("skill resolution does not accept agent role/profile flags");
      const result = resolveSkill(name, registry);
      if (!result) throw new Error(`unknown skill label: ${name}`);
      out(JSON.stringify(result));
    } else {
      if (!options["--role"]) throw new Error("--role is required; legacy labels do not authorize an execution role");
      out(JSON.stringify(selectAgent(name, options["--role"], (options["--profiles"] ?? "").split(",").filter(Boolean), registry)));
    }
    return 0;
  } catch (cause) { error(String(cause)); return 2; }
}

if (import.meta.main) process.exit(catalogMain(process.argv.slice(2)));
