#!/usr/bin/env bun
// Rust Code Studio — usage report (a CLI, not a hook; takes no stdin).
//
// Reads the usage log that usage-log.ts and the prompt hook append to, and answers the
// question the catalog cannot answer about itself: which skills and agents does anyone
// actually reach for, from where, and which have never been touched.
//
//   bun usage-report.ts                      # last 7 days, text
//   bun usage-report.ts --days 30            # a wider window; --days 0 for everything
//   bun usage-report.ts --json               # one object, for a script or an agent
//   bun usage-report.ts --file <usage.jsonl> # a log copied from another machine
//   bun usage-report.ts --plugin-root <dir>  # where skills/ and agents/ are, if not found
//
// Per skill and per agent: invocations, split by whose hand (the model through the Skill or
// Agent tool, the user through a typed `/name`), distinct sessions, and the projects they came
// from (the working directory's basename; `rust-studio` is flagged as plugin development,
// because a skill exercised only while building the plugin has not been needed by anyone).
// Then the list that matters for pruning: every skill and agent on disk that the window never
// saw. Names in the log that match nothing on disk — a built-in agent, another plugin's skill
// — are listed separately as "outside the studio", since a model that spawns `Explore` where
// `rust-scout` exists is a routing fact too.
//
// This file replaces mining 1.7 GB of transcripts. It reads one file and the two directories.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pluginRoot } from "./_lib.ts";
import { parseUsageLine, usagePath, type UsageRow } from "./usage-log.ts";

const DAY = 86_400_000;
export const DEFAULT_DAYS = 7;
/** A working directory whose basename is one of these is the plugin's own checkout. */
export const PLUGIN_DEV_PROJECTS: ReadonlySet<string> = new Set(["rust-studio"]);

// ---------------------------------------------------------------- the catalog on disk

export interface Catalog {
  root: string | null;
  skills: string[];
  agents: string[];
}

/** The plugin root, wherever this script runs from: the host's variable, the plugin-relative
 *  default, or — for the copy bundled inside a skill — the nearest ancestor that holds both
 *  `skills/` and `agents/`. Null when none of those exist, in which case the report still
 *  counts what was used but cannot say what was not. */
export function findPluginRoot(explicit?: string): string | null {
  const looksLikeRoot = (d: string) => existsSync(join(d, "skills")) && existsSync(join(d, "agents"));
  if (explicit) return looksLikeRoot(explicit) ? resolve(explicit) : null;
  const guess = pluginRoot();
  if (looksLikeRoot(guess)) return guess;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (looksLikeRoot(dir)) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** Skill directories that carry a SKILL.md, and agent briefs, by name. */
export function readCatalog(root: string | null): Catalog {
  if (!root) return { root: null, skills: [], agents: [] };
  const skills: string[] = [];
  const agents: string[] = [];
  try {
    for (const d of readdirSync(join(root, "skills"))) {
      try {
        if (statSync(join(root, "skills", d)).isDirectory() && existsSync(join(root, "skills", d, "SKILL.md"))) skills.push(d);
      } catch {
        /* a vanished entry */
      }
    }
  } catch {
    /* no skills dir */
  }
  try {
    for (const f of readdirSync(join(root, "agents"))) if (f.endsWith(".md")) agents.push(f.slice(0, -3));
  } catch {
    /* no agents dir */
  }
  return { root, skills: skills.sort(), agents: agents.sort() };
}

// ---------------------------------------------------------------- the log

/** Every well-formed row of a log; malformed lines are counted, not thrown over. */
export function readUsage(text: string): { rows: UsageRow[]; malformed: number } {
  const rows: UsageRow[] = [];
  let malformed = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const row = parseUsageLine(line);
    if (row) rows.push(row);
    else malformed += 1;
  }
  return { rows, malformed };
}

/** The rows at or after `since` (a millisecond timestamp); everything when `since` is null. */
export function inWindow(rows: UsageRow[], since: number | null): UsageRow[] {
  if (since == null) return rows;
  return rows.filter((r) => Date.parse(r.ts) >= since);
}

/** The project a row came from: the working directory's basename, `?` when unknown. */
export function projectOf(row: UsageRow): string {
  const cwd = row.cwd.replace(/[\\/]+$/, "");
  return cwd ? basename(cwd) || cwd : "?";
}

export function isPluginDev(project: string): boolean {
  return PLUGIN_DEV_PROJECTS.has(project);
}

// ---------------------------------------------------------------- aggregation

export interface NameStats {
  name: string;
  total: number;
  model: number;
  user: number;
  /** Invocations from a project that is not the plugin's own checkout. */
  outsidePluginDev: number;
  sessions: number;
  /** project → invocations, most first. */
  projects: Array<[string, number]>;
  first: string;
  last: string;
}

export interface Report {
  generated: string;
  file: string;
  days: number | null;
  since: string | null;
  rows: number;
  malformed: number;
  sessions: number;
  root: string | null;
  skills: { onDisk: number; used: NameStats[]; never: string[] };
  agents: { onDisk: number; used: NameStats[]; never: string[] };
  /** Names in the log that are neither a skill nor an agent on disk. */
  outside: NameStats[];
}

function aggregate(rows: UsageRow[]): Map<string, NameStats> {
  const out = new Map<string, NameStats>();
  const sessions = new Map<string, Set<string>>();
  const projects = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let s = out.get(r.name);
    if (!s) {
      s = { name: r.name, total: 0, model: 0, user: 0, outsidePluginDev: 0, sessions: 0, projects: [], first: r.ts, last: r.ts };
      out.set(r.name, s);
      sessions.set(r.name, new Set());
      projects.set(r.name, new Map());
    }
    s.total += 1;
    s[r.invoker] += 1;
    const p = projectOf(r);
    if (!isPluginDev(p)) s.outsidePluginDev += 1;
    if (r.session_id) sessions.get(r.name)!.add(r.session_id);
    projects.get(r.name)!.set(p, (projects.get(r.name)!.get(p) ?? 0) + 1);
    if (r.ts < s.first) s.first = r.ts;
    if (r.ts > s.last) s.last = r.ts;
  }
  for (const [name, s] of out) {
    s.sessions = sessions.get(name)!.size;
    s.projects = [...projects.get(name)!].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  return out;
}

const byUse = (a: NameStats, b: NameStats) => b.total - a.total || a.name.localeCompare(b.name);

/** Pure: the whole report from a log's rows and the catalog. `since` null means no window. */
export function buildReport(
  rows: UsageRow[],
  catalog: Catalog,
  opts: { file: string; days: number | null; since: number | null; malformed: number; now?: Date },
): Report {
  const windowed = inWindow(rows, opts.since);
  const skills = aggregate(windowed.filter((r) => r.kind === "skill"));
  const agents = aggregate(windowed.filter((r) => r.kind === "agent"));
  const onDiskSkills = new Set(catalog.skills);
  const onDiskAgents = new Set(catalog.agents);
  const outside: NameStats[] = [];
  const usedSkills: NameStats[] = [];
  const usedAgents: NameStats[] = [];
  for (const s of skills.values()) (catalog.root == null || onDiskSkills.has(s.name) ? usedSkills : outside).push(s);
  for (const s of agents.values()) (catalog.root == null || onDiskAgents.has(s.name) ? usedAgents : outside).push(s);
  return {
    generated: (opts.now ?? new Date()).toISOString(),
    file: opts.file,
    days: opts.days,
    since: opts.since == null ? null : new Date(opts.since).toISOString(),
    rows: windowed.length,
    malformed: opts.malformed,
    sessions: new Set(windowed.map((r) => r.session_id).filter(Boolean)).size,
    root: catalog.root,
    skills: { onDisk: catalog.skills.length, used: usedSkills.sort(byUse), never: catalog.skills.filter((n) => !skills.has(n)) },
    agents: { onDisk: catalog.agents.length, used: usedAgents.sort(byUse), never: catalog.agents.filter((n) => !agents.has(n)) },
    outside: outside.sort(byUse),
  };
}

// ---------------------------------------------------------------- rendering

function table(rows: NameStats[], head: string): string[] {
  if (!rows.length) return [`  (none)`];
  const w = Math.max(head.length, ...rows.map((r) => r.name.length));
  const lines = [`  ${head.padEnd(w)}  total  model  user  sessions  projects`];
  for (const r of rows) {
    const projects = r.projects.map(([p, n]) => `${p}${isPluginDev(p) ? " (plugin-dev)" : ""}×${n}`).join(", ");
    lines.push(`  ${r.name.padEnd(w)}  ${String(r.total).padStart(5)}  ${String(r.model).padStart(5)}  ${String(r.user).padStart(4)}  ${String(r.sessions).padStart(8)}  ${projects}`);
  }
  return lines;
}

function wrapList(names: string[], indent = "  "): string[] {
  if (!names.length) return [`${indent}(none)`];
  const lines: string[] = [];
  let cur = indent;
  for (const n of names) {
    if (cur.length + n.length + 2 > 96 && cur.trim()) {
      lines.push(cur.replace(/,\s*$/, ""));
      cur = indent;
    }
    cur += `${n}, `;
  }
  lines.push(cur.replace(/,\s*$/, ""));
  return lines;
}

export function renderReport(r: Report): string {
  const window = r.days == null ? "all time" : `last ${r.days} day${r.days === 1 ? "" : "s"} (since ${r.since!.slice(0, 10)})`;
  const out: string[] = [];
  out.push(`Rust Code Studio usage — ${window}: ${r.rows} invocation${r.rows === 1 ? "" : "s"} across ${r.sessions} session${r.sessions === 1 ? "" : "s"}`);
  out.push(`  log: ${r.file}${r.malformed ? ` (${r.malformed} malformed line${r.malformed === 1 ? "" : "s"} skipped)` : ""}`);
  if (r.root == null) out.push("  catalog: not found — pass --plugin-root <dir> to list what was never invoked");
  out.push("");
  out.push(`Skills — ${r.skills.used.length} invoked${r.root ? ` of ${r.skills.onDisk} on disk` : ""}`);
  out.push(...table(r.skills.used, "skill"));
  if (r.root) {
    out.push("");
    out.push(`Never invoked — skills (${r.skills.never.length}):`);
    out.push(...wrapList(r.skills.never));
  }
  out.push("");
  out.push(`Agents — ${r.agents.used.length} spawned${r.root ? ` of ${r.agents.onDisk} on disk` : ""}`);
  out.push(...table(r.agents.used, "agent"));
  if (r.root) {
    out.push("");
    out.push(`Never spawned — agents (${r.agents.never.length}):`);
    out.push(...wrapList(r.agents.never));
  }
  if (r.outside.length) {
    out.push("");
    out.push(`Outside the studio (not on disk here) — ${r.outside.length}:`);
    out.push(...table(r.outside, "name"));
  }
  out.push("");
  out.push("Counts are invocations; `user` is a typed `/name`, `model` the Skill or Agent tool. A skill used only");
  out.push("under plugin-dev has not been needed by a project yet. What to do with the numbers: docs/usage-telemetry.md.");
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------- CLI

const HELP = `usage-report — which studio skills and agents are actually used

  bun usage-report.ts [--days N] [--json] [--file <usage.jsonl>] [--plugin-root <dir>]

  --days N           window in days (default ${DEFAULT_DAYS}; 0 = everything in the log)
  --json             emit the report as one JSON object
  --file <path>      read this log instead of the plugin's own
  --plugin-root DIR  where skills/ and agents/ live, when they are not found automatically
  --help             this text

Reads <plugin data>/usage.jsonl, written by the PostToolUse hook (Skill and Agent tools) and
the UserPromptSubmit hook (a typed /name). Prints per-skill and per-agent invocations, split by
model/user, sessions and projects, then everything on disk the window never touched.
`;

export function main(argv: string[], io: { out: (s: string) => void; err: (s: string) => void }): number {
  let days: number | null = DEFAULT_DAYS;
  let json = false;
  let file: string | null = null;
  let root: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      io.out(HELP);
      return 0;
    } else if (a === "--json") json = true;
    else if (a === "--days") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) {
        io.err("usage-report: --days wants a non-negative number\n");
        return 2;
      }
      days = n === 0 ? null : n;
    } else if (a === "--all") days = null;
    else if (a === "--file") file = argv[++i] ?? null;
    else if (a === "--plugin-root") root = argv[++i];
    else {
      io.err(`usage-report: unknown argument ${a}\n${HELP}`);
      return 2;
    }
  }
  const path = file ?? usagePath();
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    /* no log yet is a valid, empty report */
  }
  const { rows, malformed } = readUsage(text);
  const catalog = readCatalog(findPluginRoot(root));
  const now = new Date();
  const since = days == null ? null : now.getTime() - days * DAY;
  const report = buildReport(rows, catalog, { file: path, days, since, malformed, now });
  io.out(json ? JSON.stringify(report, null, 2) + "\n" : renderReport(report));
  return 0;
}

if (import.meta.main) {
  // exitCode, not process.exit(): bun drops piped stdout past 64 KB on an immediate exit.
  const chunks: string[] = [];
  const code = main(process.argv.slice(2), { out: (s) => chunks.push(s), err: (s) => process.stderr.write(s) });
  await Bun.write(Bun.stdout, chunks.join(""));
  process.exitCode = code;
}
