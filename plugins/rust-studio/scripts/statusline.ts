#!/usr/bin/env bun
// Rust Code Studio — main status line (rich, opt-in via /progress-bar).
//
// Two-line rounded layout:
//   ╭─ 🦀 rust-studio · <project> · <branch ●dirty ↑ahead ↓behind> · <model> · lsp ✓
//   ╰─ ctx <bar> <pct>% · ▸ <phase> <bar> <step> · ✓ <tasks> · 5h <bar>% · 7d <bar>% · <dur> · +A −R
//
// Colors: truecolor gradient (COLORTERM=truecolor|24bit) → 256-color threshold → 16-color → none
// (NO_COLOR honored). ASCII bars via RUST_STUDIO_STATUSLINE_ASCII=1. Powerline arrow separators via
// RUST_STUDIO_STATUSLINE_POWERLINE=1 (needs a Nerd Font). git is cached ~5s in tmpdir so the bar
// stays <50ms. Phase/tasks come from <project>/.rust-studio/progress.json. Smart-hiding: empty /
// zero segments are dropped. Never throws: on any error it prints what it can (or nothing).

import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";

// ---------------- capabilities (env) ----------------
const noColor = () => !!process.env.NO_COLOR; // call-time so tests can toggle it
const ASCII = process.env.RUST_STUDIO_STATUSLINE_ASCII === "1";
const TRUECOLOR = /truecolor|24bit/i.test(process.env.COLORTERM || "");
const POWERLINE = process.env.RUST_STUDIO_STATUSLINE_POWERLINE === "1";

// ---------------- glyphs ----------------
const G = {
  crab: "🦀",
  barFull: ASCII ? "#" : "█",
  barEmpty: ASCII ? "." : "░",
  phFull: ASCII ? "#" : "▰",
  phEmpty: ASCII ? "-" : "▱",
  dirty: ASCII ? "*" : "●",
  ahead: ASCII ? "^" : "↑",
  behind: ASCII ? "v" : "↓",
  phase: ASCII ? ">" : "▸",
  ok: ASCII ? "+" : "✓",
  no: ASCII ? "x" : "✗",
  add: "+",
  del: ASCII ? "-" : "−",
  topL: ASCII ? "+-" : "╭─",
  botL: ASCII ? "+-" : "╰─",
};
const SEP = POWERLINE ? "  " : " · ";

// ---------------- color ----------------
function wrap(code: string, s: string): string {
  return noColor() || !s ? s : `\x1b[${code}m${s}\x1b[0m`;
}
const dim = (s: string) => wrap("2", s);
const bold = (s: string) => wrap("1", s);
const c256 = (n: number, s: string) => (noColor() || !s ? s : `\x1b[38;5;${n}m${s}\x1b[0m`);
const cRGB = (r: number, g: number, b: number, s: string) =>
  noColor() || !s ? s : `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;

/** Color a string by a 0-100 percentage: green → yellow → red. Truecolor gradient when available,
 *  else a 16/256 threshold color. */
export function byPct(pct: number, s: string): string {
  const p = Math.max(0, Math.min(100, pct));
  if (noColor()) return s;
  if (TRUECOLOR) {
    // green (0) → yellow (50) → red (100)
    const r = p < 50 ? Math.round((p / 50) * 255) : 255;
    const g = p < 50 ? 255 : Math.round((1 - (p - 50) / 50) * 255);
    return cRGB(r, g, 40, s);
  }
  const n = p < 50 ? 35 : p < 80 ? 178 : 196; // 256-color green / amber / red
  return c256(n, s);
}

// ---------------- pure formatters (tested) ----------------

/** Strip context-window suffixes from a model name: "Opus 4.8 (1M context)" → "Opus 4.8". */
export function stripModel(name: string): string {
  return String(name || "")
    .replace(/\s*\((?:[^)]*context[^)]*)\)\s*$/i, "")
    .replace(/\s*\[[^\]]*\]\s*$/i, "")
    .trim();
}

/** A block progress bar of `width` cells for a 0-100 percentage (plain, no color). */
export function bar(pct: number, width = 10): string {
  const p = Math.max(0, Math.min(100, pct || 0));
  const filled = Math.round((p / 100) * width);
  return G.barFull.repeat(filled) + G.barEmpty.repeat(Math.max(0, width - filled));
}

/** A ▰▱ phase bar from a "n/total" step string, or "" if unparseable. */
export function phaseBar(step: string, width = 4): string {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(step || "").trim());
  if (!m) return "";
  const done = Number(m[1]);
  const total = Math.max(1, Number(m[2]));
  const filled = Math.max(0, Math.min(width, Math.round((done / total) * width)));
  return G.phFull.repeat(filled) + G.phEmpty.repeat(width - filled);
}

export function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

/** Plain git text from parsed counts, e.g. "main ●3 ↑2 ↓1". Empty branch → "". */
export function gitText(g: { branch?: string; dirty?: number; ahead?: number; behind?: number }): string {
  if (!g || !g.branch) return "";
  let out = g.branch;
  if (g.dirty) out += ` ${G.dirty}${g.dirty}`;
  if (g.ahead) out += ` ${G.ahead}${g.ahead}`;
  if (g.behind) out += ` ${G.behind}${g.behind}`;
  return out;
}

/** Reasoning-effort label from stdin effort.level, e.g. "think:high". "" if absent/unknown. */
export function effortLabel(level?: string): string {
  const l = String(level || "").toLowerCase();
  return ["low", "medium", "high", "xhigh", "max"].includes(l) ? `think:${l}` : "";
}

/** Prompt-cache hit rate (% of input tokens served from cache) from current_usage, or null. */
export function cacheHitPct(usage: any): number | null {
  if (!usage) return null;
  const read = Number(usage.cache_read_input_tokens) || 0;
  const input = Number(usage.input_tokens) || 0;
  const denom = read + input;
  if (denom <= 0) return null;
  return Math.round((read / denom) * 100);
}

// ---------------- IO helpers (main only) ----------------
interface Progress {
  phase?: string;
  step?: string;
  tasks?: string;
  note?: string;
  ts?: number;
}
const STALE_MS = 3_600_000;

export function freshProgress(p: any, now = Date.now()): Progress | null {
  if (!p || typeof p !== "object" || !p.phase) return null;
  if (p.ts && now - p.ts > STALE_MS) return null;
  return p as Progress;
}

function gitRun(cwd: string, args: string[], timeout = 800): string | null {
  try {
    const r = Bun.spawnSync(["git", "-C", cwd, ...args], {
      stdout: "pipe",
      stderr: "ignore",
      stdin: "ignore",
      timeout,
    });
    if ((r.exitCode ?? 1) !== 0) return null;
    return new TextDecoder().decode(r.stdout).trim();
  } catch {
    return null;
  }
}

interface GitInfo {
  branch?: string;
  dirty?: number;
  ahead?: number;
  behind?: number;
}

/** Git info with a ~5s tmpdir cache keyed by cwd, so the bar never pays the git cost every tick. */
function gitInfo(cwd: string): GitInfo {
  const key = cwd.replace(/[^a-z0-9]/gi, "_").slice(-80);
  const cache = join(tmpdir(), `rust-studio-git-${key}.json`);
  try {
    if (Date.now() - statSync(cache).mtimeMs < 5000) {
      return JSON.parse(readFileSync(cache, "utf8"));
    }
  } catch {
    /* cache miss */
  }
  const info: GitInfo = {};
  const branch = gitRun(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch) {
    try {
      writeFileSync(cache, JSON.stringify(info));
    } catch {}
    return info; // not a repo
  }
  info.branch = branch === "HEAD" ? "(detached)" : branch;
  const porcelain = gitRun(cwd, ["status", "--porcelain"]);
  if (porcelain != null) info.dirty = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;
  const ab = gitRun(cwd, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  if (ab) {
    const m = /(\d+)\s+(\d+)/.exec(ab);
    if (m) {
      info.behind = Number(m[1]);
      info.ahead = Number(m[2]);
    }
  }
  try {
    writeFileSync(cache, JSON.stringify(info));
  } catch {}
  return info;
}

function projectName(dir: string): string {
  return dir ? dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "" : "";
}

function readProgress(dir: string): Progress | null {
  try {
    const f = join(dir, ".rust-studio", "progress.json");
    if (existsSync(f)) return freshProgress(JSON.parse(readFileSync(f, "utf8")));
  } catch {
    /* none */
  }
  return null;
}

function hasRustAnalyzer(): boolean {
  return Bun.which("rust-analyzer") != null;
}

// ---------------- assembly ----------------
function joinSegs(segs: string[]): string {
  return segs.filter(Boolean).join(SEP);
}

function buildLine1(session: any, git: GitInfo, lspInRust: boolean): string {
  const proj = projectName(session?.workspace?.current_dir || session?.cwd || "");
  const model = stripModel(session?.model?.display_name || session?.model?.id || "");
  const gt = gitText(git);
  const gitColored = gt ? (git.dirty ? c256(178, gt) : c256(35, gt)) : "";
  const effort = effortLabel(session?.effort?.level);
  const effortColored = effort ? (/(high|xhigh|max)/.test(effort) ? c256(208, effort) : dim(effort)) : "";
  const lsp = lspInRust ? (hasRustAnalyzer() ? `lsp ${c256(35, G.ok)}` : `lsp ${c256(196, G.no)}`) : "";
  // Studio branding only in a Rust project — the auto-installed bar is global, so a Python repo
  // shouldn't read "🦀 rust-studio"; there it degrades to project · git · model · ctx.
  const tag = lspInRust ? `${G.crab} ${c256(208, bold("rust-studio"))}` : "";
  return joinSegs([
    tag,
    proj ? dim(proj) : "",
    gitColored,
    model ? c256(75, model) : "",
    effortColored,
    lsp,
  ]);
}

function buildLine2(session: any, progress: Progress | null): string {
  const segs: string[] = [];

  // context bar (mandatory)
  const pct = session?.context_window?.used_percentage;
  if (typeof pct === "number") {
    const over = session?.exceeds_200k_tokens === true;
    const p = over ? Math.max(pct, 85) : pct;
    segs.push(`ctx ${byPct(p, bar(pct))} ${byPct(p, Math.round(pct) + "%")}`);
  }

  // prompt-cache hit rate
  const cache = cacheHitPct(session?.context_window?.current_usage);
  if (cache != null) segs.push(`cache ${c256(75, cache + "%")}`);

  // phase progress (mandatory when present)
  if (progress?.phase) {
    const pb = progress.step ? phaseBar(progress.step) : "";
    segs.push(
      `${c256(208, G.phase)} ${progress.phase}` +
        (pb ? ` ${pb}` : "") +
        (progress.step ? ` ${dim(progress.step)}` : ""),
    );
  }

  // tasks N/M (from progress.json, when present)
  if (progress?.tasks) segs.push(`${c256(35, G.ok)} ${progress.tasks}`);

  // rate limits 5h / 7d (Pro/Max only)
  const rl = session?.rate_limits;
  const five = rl?.five_hour?.used_percentage;
  const seven = rl?.seven_day?.used_percentage;
  if (typeof five === "number") segs.push(`5h ${byPct(five, bar(five, 4))} ${byPct(five, Math.round(five) + "%")}`);
  if (typeof seven === "number") segs.push(`7d ${byPct(seven, bar(seven, 4))} ${byPct(seven, Math.round(seven) + "%")}`);

  // duration
  const dur = fmtDuration(session?.cost?.total_duration_ms);
  if (dur) segs.push(dim(dur));

  // lines +/-
  const add = session?.cost?.total_lines_added || 0;
  const del = session?.cost?.total_lines_removed || 0;
  if (add || del) segs.push(`${c256(35, G.add + add)} ${c256(196, G.del + del)}`);

  return joinSegs(segs);
}

/** Pure: build both lines from session JSON + progress + lsp flag (no IO). For tests. */
export function render(session: any, progress: Progress | null, opts: { git?: GitInfo; lspInRust?: boolean } = {}): string {
  const l1 = buildLine1(session, opts.git || {}, opts.lspInRust ?? false);
  const l2 = buildLine2(session, progress);
  const top = `${dim(G.topL)} ${l1}`;
  const bot = `${dim(G.botL)} ${l2}`;
  return l2 ? `${top}\n${bot}` : top;
}

if (import.meta.main) {
  let session: any = {};
  try {
    const raw = await new Response(Bun.stdin).text();
    session = raw ? JSON.parse(raw) : {};
  } catch {
    /* empty */
  }
  const dir =
    session?.workspace?.project_dir ||
    session?.workspace?.current_dir ||
    session?.cwd ||
    process.cwd();
  const progress = readProgress(dir);
  const inRust = existsSync(join(dir, "Cargo.toml"));
  const git = gitInfo(dir);
  process.stdout.write(render(session, progress, { git, lspInRust: inRust }));
  process.exit(0);
}
