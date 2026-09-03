#!/usr/bin/env bun
// Rust Code Studio — memory doctor (a CLI, not a hook; takes no stdin).
//
// Deterministic hygiene for the host-native project memory store: audit the index
// against the host's budget and the files, flag notes that are likely rotten (a path
// that no longer exists, an unverified fact older than 90 days, a resolved item still
// indexed, a relative date, a secret), import a legacy Obsidian-vault project folder
// into the host format, rebuild missing index lines, and archive a note.
//
//   bun memory-doctor.ts audit   [--cwd <dir>] [--dir <memdir>] [--json] [--strict]
//   bun memory-doctor.ts import  <vault-project-dir> [--dir <memdir>] [--apply]
//   bun memory-doctor.ts reindex [--dir <memdir>] [--apply]
//   bun memory-doctor.ts archive <file.md> [--dir <memdir>] [--apply]
//
// Mutating commands are DRY-RUN unless --apply. Nothing is ever deleted: archive moves
// a note under archive/ and drops its index line; import never overwrites a file.
// The judgement (is this note still true? merge these two?) stays with the agent
// running /memory-doctor — this tool only makes the evidence deterministic.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  INDEX_FILE,
  INDEX_LINE_CAP,
  INDEX_BYTE_CAP,
  MEMORY_TYPES,
  budgetLine,
  indexHealth,
  listNotes,
  noteAgeDays,
  noteMeta,
  parseIndex,
  readIndex,
  resolveStore,
  type IndexEntry,
  type StoreInfo,
} from "./memory-store.ts";

const DAY = 86_400_000;
export const UNVERIFIED_DAYS = 90;
export const PROMOTE_DAYS = 30;
export const HOOK_MAX = 160;

// ---------------------------------------------------------------- per-note findings

const PATH_RE = /(?:^|[\s`(\[])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:rs|toml|md|ts|js|mjs|sh|json|ya?ml|py|txt|lock))(?::\d+)?/g;
const RESOLVED_RE = /^\s*(?:\*\*)?(RESOLVED|FIXED|CLOSED|DONE|SUPERSEDED|OBSOLETE)\b/i;
const RELATIVE_DATE_RE = /\b(yesterday|tomorrow|last (?:week|month|sprint)|next (?:week|month|sprint)|this (?:week|month|sprint)|recently)\b/i;
const SECRET_RES = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_\-/+.]{12,}/i,
];

export function parseDate(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s.trim().replace(/^["']|["']$/g, ""));
  return Number.isNaN(t) ? null : t;
}

/** Relative paths a note names that no longer exist under the repo root. Absolute,
 *  templated (`<crate>`, `*`, `$`), and URL-ish tokens are skipped. */
export function missingPaths(body: string, root: string, budgetMs = 1500): string[] {
  const out = new Set<string>();
  const deadline = Date.now() + budgetMs;
  for (const m of body.matchAll(PATH_RE)) {
    const p = m[1].replace(/^\.\//, "");
    if (/[<>*{}$]/.test(p) || p.startsWith("target/") || p.startsWith("http") || p.includes("//")) continue;
    if (existsSync(join(root, p))) continue;
    // A note often names a path relative to a sub-crate or sub-plugin, not the repo
    // root — look for it anywhere below the root before calling it missing. Bounded:
    // past the time budget we stop judging rather than flag what we could not check.
    if (Date.now() > deadline) break;
    let found = false;
    try {
      for (const _hit of new Bun.Glob(`**/${p}`).scanSync({ cwd: root, onlyFiles: false })) {
        found = true;
        break;
      }
    } catch {
      found = true; // could not check → do not flag
    }
    if (!found) out.add(p);
  }
  return [...out];
}

export interface NoteFinding {
  code:
    | "missing-path"
    | "unverified"
    | "resolved"
    | "relative-date"
    | "secret"
    | "untyped"
    | "long-hook"
    | "promote";
  detail: string;
}

export function noteFindings(
  body: string,
  entry: IndexEntry | undefined,
  root: string,
  now = Date.now(),
): { meta: ReturnType<typeof noteMeta>; ageDays: number | null; findings: NoteFinding[] } {
  const meta = noteMeta(body);
  const findings: NoteFinding[] = [];
  const modified = parseDate(meta.modified);
  const ageDays = modified == null ? null : Math.floor((now - modified) / DAY);
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body)?.[1] ?? "";
  const verifiedRaw = /^\s*verified\s*:\s*(.+)$/im.exec(fm)?.[1] ?? "";
  const verified = parseDate(verifiedRaw);
  const verifiedAge = verified == null ? null : Math.floor((now - verified) / DAY);
  const text = body.slice(fm ? fm.length + 8 : 0);

  for (const p of missingPaths(text, root)) findings.push({ code: "missing-path", detail: p });
  const status = meta.status.toLowerCase();
  if (
    ["resolved", "fixed", "closed", "superseded", "obsolete", "archived", "stale"].includes(status) ||
    RESOLVED_RE.test(meta.description) ||
    (entry && RESOLVED_RE.test(entry.hook))
  )
    findings.push({ code: "resolved", detail: status || "hook says resolved" });
  const freshest = verifiedAge == null ? ageDays : ageDays == null ? verifiedAge : Math.min(ageDays, verifiedAge);
  if (freshest != null && freshest >= UNVERIFIED_DAYS)
    findings.push({ code: "unverified", detail: `${freshest}d since modified/verified` });
  const rel = RELATIVE_DATE_RE.exec(text);
  if (rel) findings.push({ code: "relative-date", detail: rel[1] });
  for (const re of SECRET_RES)
    if (re.test(text)) {
      findings.push({ code: "secret", detail: re.source.slice(0, 24) });
      break;
    }
  if (!meta.type || !(MEMORY_TYPES as readonly string[]).includes(meta.type))
    findings.push({ code: "untyped", detail: meta.type ? `unknown type ${meta.type}` : "no metadata.type" });
  if (entry && entry.hook.length > HOOK_MAX) findings.push({ code: "long-hook", detail: `${entry.hook.length} chars` });
  if (meta.kind === "convention" && ageDays != null && ageDays >= PROMOTE_DAYS && !findings.some((f) => f.code === "resolved"))
    findings.push({ code: "promote", detail: `convention ${ageDays}d old — rules ≠ memory; move it to CLAUDE.md / rules` });
  return { meta, ageDays, findings };
}

// ---------------------------------------------------------------- audit

export interface NoteReport {
  file: string;
  title: string;
  type: string;
  kind: string;
  status: string;
  ageDays: number | null;
  indexed: boolean;
  findings: NoteFinding[];
}

export interface AuditReport {
  store: Pick<StoreInfo, "dir" | "source" | "exists" | "hostInjectsIndex">;
  root: string;
  budget: { lineCount: number; byteCount: number; fill: number; overCap: boolean; nearCap: boolean };
  integrity: { dangling: string[]; unindexed: string[]; duplicates: string[] };
  notes: NoteReport[];
  counts: Record<string, number>;
}

export function auditStore(store: StoreInfo, now = Date.now()): AuditReport {
  const index = readIndex(store.dir);
  const h = indexHealth(store.dir, index);
  const byFile = new Map<string, IndexEntry>();
  for (const e of index?.entries ?? []) if (!byFile.has(e.file)) byFile.set(e.file, e);
  const notes: NoteReport[] = [];
  const counts: Record<string, number> = {};
  for (const file of listNotes(store.dir)) {
    let body = "";
    try {
      body = readFileSync(join(store.dir, file), "utf8");
    } catch {
      continue;
    }
    const entry = byFile.get(file);
    const found = noteFindings(body, entry, store.root, now);
    const { meta, findings } = found;
    const ageDays = found.ageDays ?? noteAgeDays(store.dir, file, meta, now);
    for (const f of findings) counts[f.code] = (counts[f.code] ?? 0) + 1;
    notes.push({
      file,
      title: entry?.title || meta.name || file.replace(/\.md$/, ""),
      type: meta.type,
      kind: meta.kind,
      status: meta.status,
      ageDays,
      indexed: Boolean(entry),
      findings,
    });
  }
  return {
    store: { dir: store.dir, source: store.source, exists: store.exists, hostInjectsIndex: store.hostInjectsIndex },
    root: store.root,
    budget: { lineCount: h.lineCount, byteCount: h.byteCount, fill: h.fill, overCap: h.overCap, nearCap: h.nearCap },
    integrity: { dangling: h.dangling, unindexed: h.unindexed, duplicates: h.duplicates },
    notes,
    counts,
  };
}

export function renderAudit(r: AuditReport): string {
  const out: string[] = [];
  out.push(`# Memory audit — ${r.store.dir}`);
  out.push(
    `store: ${r.store.exists ? "present" : "ABSENT (nothing saved yet)"} · resolved from ${r.store.source} · ` +
      `${r.store.hostInjectsIndex ? "Claude Code loads this index itself" : "the studio surfaces this index (host does not)"}`,
  );
  const b = r.budget;
  const budget = budgetLine({ ...b, dangling: [], unindexed: [], duplicates: [] });
  out.push(`budget: ${budget} (${Math.round(b.fill * 100)}% of the host cap${b.overCap ? " — OVER CAP: the host will refuse to load past it" : b.nearCap ? " — near cap" : ""})`);
  const i = r.integrity;
  out.push(
    `integrity: ${i.dangling.length} dangling, ${i.unindexed.length} unindexed, ${i.duplicates.length} duplicate` +
      (i.dangling.length ? `\n  dangling (index line, no file): ${i.dangling.join(", ")}` : "") +
      (i.unindexed.length ? `\n  unindexed (file, no index line): ${i.unindexed.join(", ")}` : "") +
      (i.duplicates.length ? `\n  duplicate index lines: ${i.duplicates.join(", ")}` : ""),
  );
  out.push(`notes: ${r.notes.length}` + (Object.keys(r.counts).length ? ` · findings: ${Object.entries(r.counts).map(([k, v]) => `${k}×${v}`).join(", ")}` : " · no findings"));
  const flagged = r.notes.filter((n) => n.findings.length);
  if (flagged.length) {
    out.push("");
    out.push("| file | kind/type | age | findings |");
    out.push("|---|---|---|---|");
    for (const n of flagged) {
      const age = n.ageDays == null ? "?" : `${n.ageDays}d`;
      out.push(`| ${n.file} | ${n.kind || "-"}/${n.type || "-"} | ${age} | ${n.findings.map((f) => `${f.code}: ${f.detail}`).join("; ")} |`);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- import (vault → host)

const VAULT_TYPE_MAP: Record<string, string> = {
  feedback: "feedback",
  reference: "reference",
  user: "user",
};

function yamlQuote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `[[slug|Title]]` → `[Title](slug.md)`, `[[slug]]` → `[slug](slug.md)`. */
export function convertWikilinks(body: string): string {
  return body.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, slug: string, title?: string) => {
    const s = slug.trim();
    const file = s.endsWith(".md") ? s : `${s}.md`;
    return `[${(title ?? s).trim() || s}](${file})`;
  });
}

export interface ConvertedNote {
  file: string;
  content: string;
  indexLine: string;
  title: string;
}

/** One vault note → one host-format note + its index line. `hookFromIndex` is the
 *  vault index's one-liner for this slug, when it had one. */
export function convertVaultNote(slug: string, body: string, hookFromIndex: string, now = Date.now(), origin = ""): ConvertedNote {
  const meta = noteMeta(body);
  const fmm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(body);
  const rawBody = (fmm ? body.slice(fmm[0].length) : body).replace(/^\s+/, "");
  const title = meta.name || slug.replace(/[-_]+/g, " ");
  const kind = meta.kind || "concept";
  const type = VAULT_TYPE_MAP[kind] ?? "project";
  const modified = meta.modified ? (parseDate(meta.modified) != null ? meta.modified : isoDate(now)) : isoDate(now);
  // Vault titles ran to whole sentences and the vault hook often repeated the title's
  // second clause; the host index has a 25 KB budget, so keep the link text to the first
  // clause of a long title and drop a hook the title already says.
  const linkTitle = indexTitle(title);
  let hook = (hookFromIndex || meta.description || "").replace(/\s+/g, " ").trim();
  if (hook && title.toLowerCase().includes(hook.replace(/[.…]+$/, "").toLowerCase())) hook = "";
  const shortHook = hook.length > 140 ? hook.slice(0, 137).trimEnd() + "…" : hook;
  const fm = [
    "---",
    `name: ${slug}`,
    `description: ${yamlQuote(title)}`,
    "metadata:",
    `  type: ${type}`,
    `  kind: ${kind}`,
    `  status: ${meta.status || "active"}`,
    `  modified: ${modified}`,
    `  imported: ${isoDate(now)}`,
    ...(origin ? [`  imported_from: ${yamlQuote(origin)}`] : []),
    "---",
    "",
  ].join("\n");
  const file = `${slug}.md`;
  return {
    file,
    content: fm + convertWikilinks(rawBody).trimEnd() + "\n",
    indexLine: `- [${linkTitle.replace(/\]/g, ")")}](${file})${shortHook ? ` — ${shortHook}` : ""}`,
    title,
  };
}

/** Link text for the index: a title longer than 90 chars is cut at its first clause
 *  break (" — ", ": ", ", ") when that leaves at least 30 chars. */
export function indexTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= 90) return t;
  const m = /^(.{30,90}?)(?:\s+[—–]\s+|:\s+|,\s+)/.exec(t);
  return m ? m[1] : t.slice(0, 87).trimEnd() + "…";
}

export interface ImportPlan {
  vaultDir: string;
  memDir: string;
  create: ConvertedNote[];
  skipExists: string[];
  skipEmpty: string[];
  /** Index lines after import vs the host cap. */
  projectedLines: number;
  overCap: boolean;
}

export function planImport(vaultDir: string, memDir: string, now = Date.now()): ImportPlan {
  const vaultIndex = readIndex(vaultDir);
  const hooks = new Map<string, string>();
  for (const e of vaultIndex?.entries ?? []) if (!hooks.has(e.file)) hooks.set(e.file, e.hook);
  const existing = new Set(listNotes(memDir));
  const memIndex = readIndex(memDir);
  const create: ConvertedNote[] = [];
  const skipExists: string[] = [];
  const skipEmpty: string[] = [];
  for (const file of listNotes(vaultDir)) {
    if (file.startsWith("_Index_of_")) continue;
    if (existing.has(file)) {
      skipExists.push(file);
      continue;
    }
    let body = "";
    try {
      body = readFileSync(join(vaultDir, file), "utf8");
    } catch {
      continue;
    }
    if (!body.trim()) {
      skipEmpty.push(file);
      continue;
    }
    create.push(convertVaultNote(file.replace(/\.md$/, ""), body, hooks.get(file) ?? "", now, `${basename(vaultDir)}/${file}`));
  }
  const projectedLines = (memIndex?.lineCount ?? 1) + create.length;
  return { vaultDir, memDir, create, skipExists, skipEmpty, projectedLines, overCap: projectedLines > INDEX_LINE_CAP };
}

export function applyImport(plan: ImportPlan): { written: number } {
  mkdirSync(plan.memDir, { recursive: true });
  const indexPath = join(plan.memDir, INDEX_FILE);
  let index = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "# Memory index\n\n";
  if (index.length && !index.endsWith("\n")) index += "\n";
  const present = new Set(parseIndex(index).map((e) => e.file));
  let written = 0;
  for (const n of plan.create) {
    const target = join(plan.memDir, n.file);
    if (existsSync(target)) continue; // never overwrite
    writeFileSync(target, n.content);
    written++;
    if (!present.has(n.file)) {
      index += n.indexLine + "\n";
      present.add(n.file);
    }
  }
  writeFileSync(indexPath, index);
  return { written };
}

export function renderImportPlan(p: ImportPlan, applied?: { written: number }): string {
  const out: string[] = [];
  out.push(`# Memory import — ${p.vaultDir} → ${p.memDir}`);
  out.push(`create: ${p.create.length} · skip (already present): ${p.skipExists.length} · skip (empty): ${p.skipEmpty.length}`);
  out.push(`projected index: ${p.projectedLines}/${INDEX_LINE_CAP} lines${p.overCap ? " — OVER CAP: archive or merge before importing everything" : ""}`);
  for (const n of p.create) out.push(`  + ${n.indexLine}`);
  for (const f of p.skipExists) out.push(`  = ${f} (exists — reconcile by hand if the vault copy is newer)`);
  out.push(applied ? `applied: ${applied.written} files written` : "dry run — re-run with --apply to write");
  return out.join("\n");
}

// ---------------------------------------------------------------- reindex / archive

export function planReindex(dir: string): string[] {
  const h = indexHealth(dir);
  const lines: string[] = [];
  for (const file of h.unindexed) {
    let body = "";
    try {
      body = readFileSync(join(dir, file), "utf8");
    } catch {
      continue;
    }
    const m = noteMeta(body);
    const title = m.name || file.replace(/\.md$/, "");
    const hook = m.description.replace(/\s+/g, " ").trim();
    lines.push(`- [${title.replace(/\]/g, ")")}](${file})${hook && hook !== title ? ` — ${hook.length > 140 ? hook.slice(0, 137).trimEnd() + "…" : hook}` : ""}`);
  }
  return lines;
}

export function applyReindex(dir: string, lines: string[]): void {
  const indexPath = join(dir, INDEX_FILE);
  let index = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "# Memory index\n\n";
  if (index.length && !index.endsWith("\n")) index += "\n";
  writeFileSync(indexPath, index + lines.join("\n") + (lines.length ? "\n" : ""));
}

export function planArchive(dir: string, file: string): { file: string; indexLines: number; exists: boolean } {
  const index = readIndex(dir);
  return {
    file,
    indexLines: (index?.entries ?? []).filter((e) => e.file === file).length,
    exists: existsSync(join(dir, file)),
  };
}

export function applyArchive(dir: string, file: string): void {
  const src = join(dir, file);
  const dest = join(dir, "archive", file);
  mkdirSync(join(dir, "archive"), { recursive: true });
  if (existsSync(src)) renameSync(src, dest);
  const indexPath = join(dir, INDEX_FILE);
  if (!existsSync(indexPath)) return;
  const text = readFileSync(indexPath, "utf8");
  const drop = new Set(parseIndex(text).filter((e) => e.file === file).map((e) => e.line));
  writeFileSync(indexPath, text.split(/\r?\n/).filter((_l, i) => !drop.has(i)).join("\n"));
}

// ---------------------------------------------------------------- CLI

function arg(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "audit";
  const cwd = resolve(arg(args, "--cwd") ?? process.cwd());
  const store = resolveStore(cwd);
  const dirOverride = arg(args, "--dir");
  if (dirOverride) {
    store.dir = resolve(cwd, dirOverride);
    store.source = "option";
    store.exists = existsSync(store.dir);
    store.hostInjectsIndex = false;
  }
  const apply = args.includes("--apply");
  const positional = args.slice(1).filter((a, i, all) => !a.startsWith("--") && (i === 0 || !all[i - 1].startsWith("--")));

  switch (cmd) {
    case "audit": {
      const r = auditStore(store);
      if (args.includes("--json")) console.log(JSON.stringify(r, null, 2));
      else console.log(renderAudit(r));
      if (args.includes("--strict") && (r.budget.overCap || r.integrity.dangling.length || r.integrity.duplicates.length)) process.exit(1);
      break;
    }
    case "import": {
      const vault = positional[0];
      if (!vault) {
        console.error("usage: memory-doctor.ts import <vault-project-dir> [--dir <memdir>] [--apply]");
        process.exit(2);
      }
      const plan = planImport(resolve(cwd, vault), store.dir);
      console.log(renderImportPlan(plan, apply ? applyImport(plan) : undefined));
      break;
    }
    case "reindex": {
      const lines = planReindex(store.dir);
      console.log(lines.length ? lines.join("\n") : "(index already lists every note)");
      if (apply && lines.length) {
        applyReindex(store.dir, lines);
        console.log(`applied: ${lines.length} index lines appended`);
      } else if (lines.length) console.log("dry run — re-run with --apply to append");
      break;
    }
    case "archive": {
      const file = positional[0];
      if (!file) {
        console.error("usage: memory-doctor.ts archive <file.md> [--dir <memdir>] [--apply]");
        process.exit(2);
      }
      const p = planArchive(store.dir, file);
      console.log(`${p.exists ? "move" : "no file, only"} ${file} → archive/ and drop ${p.indexLines} index line(s)`);
      if (apply) {
        applyArchive(store.dir, file);
        console.log("applied");
      } else console.log("dry run — re-run with --apply to archive");
      break;
    }
    default:
      console.error(`unknown command: ${cmd} (audit | import | reindex | archive)`);
      process.exit(2);
  }
}
