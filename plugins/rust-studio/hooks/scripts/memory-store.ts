#!/usr/bin/env bun
// Rust Code Studio — the project memory store (host-native).
//
// Since v0.36.0 the studio keeps NO memory store of its own. Project memory IS the
// host's auto-memory directory — the `MEMORY.md` index Claude Code loads at session
// start plus one topic file per memory — resolved exactly the way the host resolves
// it, so /remember, /recall, /memory-doctor, the hooks, and the host itself read and
// write ONE directory. Codex has no file-based auto-memory, so a Codex session uses
// the same path and shares the brain with Claude Code.
//
// Resolution order (first hit wins):
//   1. studio option `memory_dir` (CLAUDE_PLUGIN_OPTION_MEMORY_DIR / RUST_STUDIO_MEMORY_DIR)
//   2. Claude Code `autoMemoryDirectory` — `.claude/settings.local.json` at the
//      main-worktree root, then `~/.claude/settings.json` (the host ignores a
//      checked-in project settings.json for this key, so we do too)
//   3. `$CLAUDE_CONFIG_DIR|~/.claude/projects/<project-key>/memory/`, where
//      <project-key> is the main-worktree root path with every character outside
//      [A-Za-z0-9-] replaced by `-` (the host's key; worktrees share it)
//
// Every function here is fail-quiet: bad input → empty result, never a throw that
// could take a hook (and the session) down with it.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname, resolve, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { option } from "./_lib.ts";

/** The host loads only the first 200 lines / 25 KB of MEMORY.md (code.claude.com/docs/en/memory);
 *  past that it errors and tells the model to rewrite the index. */
export const INDEX_LINE_CAP = 200;
export const INDEX_BYTE_CAP = 25_000;
export const INDEX_FILE = "MEMORY.md";
/** Host memory types (what the host's own guidance uses) and the studio's finer kinds,
 *  kept as `metadata.kind` — the host preserves extra string keys under `metadata`. */
export const MEMORY_TYPES = ["user", "feedback", "project", "reference"] as const;
export const MEMORY_KINDS = ["decision", "gotcha", "convention", "fix", "reference", "concept"] as const;

/** Canonical main-worktree root for cwd, so a git WORKTREE shares the real project's
 *  memory (the host keys memory on the repository, not the checkout). Falls back to cwd. */
export function gitMainRoot(cwd: string): string {
  try {
    const common = execSync("git rev-parse --git-common-dir", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    if (common) {
      const abs = resolve(cwd, common); // relative ".git" in main checkout, absolute in a worktree
      return basename(abs) === ".git" ? dirname(abs) : abs;
    }
  } catch {
    /* not a git repo / git missing */
  }
  return cwd;
}

/** The host's project key: the root path with everything outside [A-Za-z0-9-] → "-". */
export function projectKey(root: string): string {
  const k = root.replace(/[^a-zA-Z0-9-]/g, "-");
  return k === "" ? "unknown" : k;
}

export function configDir(): string {
  const env = (process.env.CLAUDE_CONFIG_DIR ?? "").trim();
  return env ? env : join(homedir(), ".claude");
}

export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return p;
}

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export interface HostMemorySettings {
  /** `autoMemoryDirectory` (already ~-expanded), or null when unset. */
  dir: string | null;
  /** `autoMemoryEnabled` — null when unset (host default: on). */
  enabled: boolean | null;
}

/** Claude Code's memory-relevant settings: local (untracked) overrides user. */
export function hostMemorySettings(root: string, cfg = configDir()): HostMemorySettings {
  const layers = [readJson(join(root, ".claude", "settings.local.json")), readJson(join(cfg, "settings.json"))];
  let dir: string | null = null;
  let enabled: boolean | null = null;
  for (const s of layers) {
    if (!s || typeof s !== "object") continue;
    if (dir == null && typeof s.autoMemoryDirectory === "string" && s.autoMemoryDirectory.trim())
      dir = expandHome(s.autoMemoryDirectory.trim());
    if (enabled == null && typeof s.autoMemoryEnabled === "boolean") enabled = s.autoMemoryEnabled;
  }
  return { dir, enabled };
}

/** Running under Claude Code? Hooks see CLAUDE_PLUGIN_ROOT; a Bash tool call inside a
 *  session (where /memory-doctor runs the CLI) sees CLAUDECODE instead. */
export function isClaudeHost(): boolean {
  return Boolean(process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDECODE);
}

/** Is the host's auto-memory on (so the host itself injects the index)? Mirrors the
 *  host's own gate: the env kill-switch first, then the setting, default on. */
export function hostAutoMemoryOn(settings: HostMemorySettings): boolean {
  const env = (process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY ?? "").trim();
  if (env && !/^(false|0|no|off)$/i.test(env)) return false;
  return settings.enabled !== false;
}

export interface StoreInfo {
  /** The memory directory (contains MEMORY.md + topic files). */
  dir: string;
  source: "option" | "settings" | "default";
  exists: boolean;
  /** True when Claude Code loads this very index itself, so a hook should surface
   *  pointers and health, not re-inject the index. */
  hostInjectsIndex: boolean;
  projectKey: string;
  root: string;
}

export function resolveStore(cwd: string): StoreInfo {
  const root = gitMainRoot(cwd);
  const key = projectKey(root);
  const settings = hostMemorySettings(root);
  let dir: string;
  let source: StoreInfo["source"];
  const opt = option("memory_dir");
  if (opt) {
    const e = expandHome(opt);
    dir = isAbsolute(e) ? e : resolve(root, e);
    source = "option";
  } else if (settings.dir) {
    dir = settings.dir;
    source = "settings";
  } else {
    dir = join(configDir(), "projects", key, "memory");
    source = "default";
  }
  let exists = false;
  try {
    exists = statSync(dir).isDirectory();
  } catch {
    exists = false;
  }
  const hostInjectsIndex = isClaudeHost() && hostAutoMemoryOn(settings) && source !== "option";
  return { dir, source, exists, hostInjectsIndex, projectKey: key, root };
}

// ---------------------------------------------------------------- index + notes

export interface IndexEntry {
  title: string;
  /** File name relative to the memory dir (host form: `slug.md`). */
  file: string;
  hook: string;
  /** 0-based line number in MEMORY.md. */
  line: number;
}

const HOST_LINE = /^\s*[-*]\s+\[([^\]]+)\]\(([^)\s]+)\)\s*(?:[—–-]+\s*(.*))?$/;
const WIKI_LINE = /^\s*[-*]\s+\[\[([^\]|]+)(?:\|([^\]]*))?\]\]\s*(?:[—–-]+\s*(.*))?$/;

/** Parse a MEMORY.md index. Accepts the host form `- [Title](file.md) — hook` and the
 *  legacy vault form `- [[slug|Title]] — hook` (so a migrated index still resolves). */
export function parseIndex(text: string): IndexEntry[] {
  const out: IndexEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m = HOST_LINE.exec(l);
    if (m) {
      out.push({ title: m[1].trim(), file: m[2].trim(), hook: (m[3] ?? "").trim(), line: i });
      continue;
    }
    m = WIKI_LINE.exec(l);
    if (m) {
      const slug = m[1].trim();
      out.push({
        title: (m[2] ?? slug).trim() || slug,
        file: slug.endsWith(".md") ? slug : `${slug}.md`,
        hook: (m[3] ?? "").trim(),
        line: i,
      });
    }
  }
  return out;
}

export interface IndexInfo {
  text: string;
  entries: IndexEntry[];
  lineCount: number;
  byteCount: number;
}

export function readIndex(dir: string): IndexInfo | null {
  let text: string;
  try {
    text = readFileSync(join(dir, INDEX_FILE), "utf8");
  } catch {
    return null;
  }
  // Count lines the way a reader does: a trailing newline does not add a line.
  const parts = text.split(/\r?\n/);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  const lineCount = parts.length;
  return { text, entries: parseIndex(text), lineCount, byteCount: Buffer.byteLength(text, "utf8") };
}

/** Topic files in the store: top-level `*.md` except the index; `archive/` and other
 *  subfolders are deliberately not memory (the host indexes flat). */
export function listNotes(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== INDEX_FILE && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export interface NoteMeta {
  name: string;
  description: string;
  type: string;
  kind: string;
  status: string;
  modified: string;
}

function fmField(fm: string, key: string): string {
  const m = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im").exec(fm);
  return m ? m[1].trim().replace(/^["']|["']$/g, "").trim() : "";
}

/** Frontmatter of a memory file. Reads the host's nested `metadata:` block and the
 *  flat docs form (`type:` at top level) alike; description falls back to the first
 *  body line so an untyped note still gets a one-line hook. */
export function noteMeta(body: string): NoteMeta {
  const fmm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body);
  const fm = fmm ? fmm[1] : "";
  const metaBlock = /^metadata\s*:\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/im.exec(fm)?.[1] ?? "";
  const pick = (k: string): string => fmField(metaBlock, k) || fmField(fm, k);
  let description = fmField(fm, "description");
  if (!description) {
    const after = fmm ? body.slice(fmm[0].length) : body;
    for (const raw of after.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith(">") || line.startsWith("---")) continue;
      description = line;
      break;
    }
  }
  return {
    name: fmField(fm, "name") || fmField(fm, "title"),
    description,
    type: pick("type"),
    kind: pick("kind") || fmField(fm, "note_type"),
    status: pick("status"),
    modified: pick("modified") || fmField(fm, "updated"),
  };
}

export interface IndexHealth {
  lineCount: number;
  byteCount: number;
  /** Fraction of the tighter host cap already used (0–1+). */
  fill: number;
  overCap: boolean;
  nearCap: boolean;
  /** Index entries whose file is missing. */
  dangling: string[];
  /** Topic files no index line points at. */
  unindexed: string[];
  /** Entries pointing at the same file more than once. */
  duplicates: string[];
}

export function indexHealth(dir: string, index: IndexInfo | null = readIndex(dir)): IndexHealth {
  const notes = new Set(listNotes(dir));
  const seen = new Set<string>();
  const dangling: string[] = [];
  const duplicates: string[] = [];
  const entries = index?.entries ?? [];
  for (const e of entries) {
    if (seen.has(e.file)) duplicates.push(e.file);
    seen.add(e.file);
    if (!notes.has(e.file) && !existsSync(join(dir, e.file))) dangling.push(e.file);
  }
  const unindexed = [...notes].filter((f) => !seen.has(f));
  const lineCount = index?.lineCount ?? 0;
  const byteCount = index?.byteCount ?? 0;
  const fill = Math.max(lineCount / INDEX_LINE_CAP, byteCount / INDEX_BYTE_CAP);
  return {
    lineCount,
    byteCount,
    fill,
    overCap: fill >= 1,
    nearCap: fill >= 0.85,
    dangling,
    unindexed,
    duplicates,
  };
}

// ---------------------------------------------------------------- ranking

export const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "are", "was",
  "main", "master", "feat", "fix", "chore", "refactor", "docs", "test", "wip", "branch",
  "add", "update", "remove", "merge", "rust", "crate", "crates", "src", "lib", "mod",
  "please", "make", "should", "would", "could", "have", "does", "when", "what", "where",
  "which", "there", "here", "then", "than", "them", "they", "will", "just", "also", "some",
  "file", "files", "code", "change", "changes", "need", "needs", "want", "like", "about",
]);

/** Lower-cased search terms (≥4 chars, not stop words) from any text. */
export function terms(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of text.toLowerCase().split(/[^a-z0-9_]+/)) if (t.length >= 4 && !STOP.has(t)) out.add(t);
  return out;
}

export interface Ranked extends IndexEntry {
  score: number;
  matched: string[];
}

/** Score an index entry against terms: a hit in the file slug or title counts 3, in the
 *  hook 1, in the body (when `bodyOf` is given) 1 — per distinct term, so two weak hits
 *  outrank one. Ties keep index order (the index is the curated ranking). */
export function rankEntries(
  entries: IndexEntry[],
  sig: Set<string>,
  limit = 5,
  bodyOf?: (file: string) => string,
): Ranked[] {
  const out: Ranked[] = [];
  for (const e of entries) {
    const strong = `${e.file} ${e.title}`.toLowerCase();
    const weak = e.hook.toLowerCase();
    let body: string | null = null;
    let score = 0;
    const matched: string[] = [];
    for (const t of sig) {
      if (strong.includes(t)) {
        score += 3;
        matched.push(t);
      } else if (weak.includes(t)) {
        score += 1;
        matched.push(t);
      } else if (bodyOf) {
        if (body == null) body = bodyOf(e.file).toLowerCase();
        if (body.includes(t)) {
          score += 1;
          matched.push(t);
        }
      }
    }
    if (score > 0) out.push({ ...e, score, matched });
  }
  return out.sort((a, b) => b.score - a.score || a.line - b.line).slice(0, limit);
}

/** Bounded body reader for ranking: at most `maxBytes` per file, "" on any error. */
export function bodyReader(dir: string, maxBytes = 64_000): (file: string) => string {
  return (file: string): string => {
    try {
      const b = readFileSync(join(dir, file), "utf8");
      return b.length > maxBytes ? b.slice(0, maxBytes) : b;
    } catch {
      return "";
    }
  };
}

/** Days since an ISO/YYYY-MM-DD stamp, or null. */
export function ageDays(stamp: string, now = Date.now()): number | null {
  if (!stamp) return null;
  const t = Date.parse(stamp.trim().replace(/^["']|["']$/g, ""));
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** Age of a note in days: its `modified`/`updated` stamp, else the file's mtime (an
 *  older host note carries no stamp), else null. */
export function noteAgeDays(dir: string, file: string, meta: NoteMeta, now = Date.now()): number | null {
  const stamped = ageDays(meta.modified, now);
  if (stamped != null) return stamped;
  try {
    return Math.max(0, Math.floor((now - statSync(join(dir, file)).mtimeMs) / 86_400_000));
  } catch {
    return null;
  }
}

/** `(gotcha, 12d)` — the kind/type and age label used next to a recalled note. */
export function noteLabel(meta: NoteMeta, now = Date.now(), age: number | null = ageDays(meta.modified, now)): string {
  const bits: string[] = [];
  if (meta.kind || meta.type) bits.push(meta.kind || meta.type);
  if (age != null) bits.push(`${age}d`);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

/** Label for a note on disk: frontmatter kind/type + age (stamp or mtime). */
export function labelFor(dir: string, file: string, now = Date.now()): string {
  const meta = noteMeta(bodyReader(dir)(file));
  return noteLabel(meta, now, noteAgeDays(dir, file, meta, now));
}

/** Cheap git signal for "what is this session about": branch, last subject, crates touched. */
export function gitSignal(cwd: string): Set<string> {
  const git = (args: string): string => {
    try {
      return execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
    } catch {
      return "";
    }
  };
  const sig = terms(`${git("rev-parse --abbrev-ref HEAD")} ${git("log -1 --format=%s")}`);
  const changed = git("diff --name-only HEAD") + "\n" + git("diff --name-only");
  for (const m of changed.matchAll(/crates[\/\\]([a-z0-9_-]+)/gi)) sig.add(m[1].toLowerCase());
  return sig;
}

/** Human line for the index budget, e.g. "index 187/200 lines, 18.2 KB/25 KB". */
export function budgetLine(h: IndexHealth): string {
  return `index ${h.lineCount}/${INDEX_LINE_CAP} lines, ${(h.byteCount / 1000).toFixed(1)} KB/${INDEX_BYTE_CAP / 1000} KB`;
}
