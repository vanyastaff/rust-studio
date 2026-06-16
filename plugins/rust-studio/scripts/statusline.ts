#!/usr/bin/env bun
// Rust Code Studio — main status line (rich, opt-in via /progress-bar).
//
// Default look: Tokyo Night theme · Powerline segments (colored arrow caps) · Nerd Font icons.
// Two-line layout. Fallbacks (auto / env): no color or NO_COLOR -> plain colored/no-color middot
// line with rounded caps; RUST_STUDIO_STATUSLINE_NERDFONT=0 -> text labels, no glyph icons;
// RUST_STUDIO_STATUSLINE_POWERLINE=0 -> middot separators (keep color+icons);
// RUST_STUDIO_STATUSLINE_ASCII=1 -> pure ASCII. Phase/tasks come from
// <project>/.rust-studio/progress.json. git is cached ~5s. Smart-hides empty segments. Never throws.
//
// All special glyphs use \u escapes so the source stays editable and free of mojibake.

import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";

// ---------------- capabilities (env) ----------------
const noColor = () => !!process.env.NO_COLOR;
// CLI args let /progress-bar bake the look into the statusLine command (no env juggling on Windows):
//   --icons nerd|emoji|text · --no-powerline · --ascii    (args override env).
// Decorative icons default to EMOJI (render without any special font); `nerd` = sleek FontAwesome
// (F0xx, needs a Nerd Font); `text` = labels. Powerline glyphs (arrows E0B0/E0B1, branch E0A0) ship
// in powerline-patched fonts and are kept independently of the icon mode.
const ARGV = process.argv.slice(2);
const argVal = (name: string) => {
  const i = ARGV.indexOf(name);
  return i >= 0 && i + 1 < ARGV.length ? ARGV[i + 1] : undefined;
};
const ASCII = process.env.RUST_STUDIO_STATUSLINE_ASCII === "1" || ARGV.includes("--ascii");
const PLGLYPH = !ASCII;
const argIcons = argVal("--icons");
const envIcons: "emoji" | "nerd" | "off" =
  process.env.RUST_STUDIO_STATUSLINE_NERDFONT === "0"
    ? "off"
    : process.env.RUST_STUDIO_STATUSLINE_NERDFONT === "1"
      ? "nerd"
      : "emoji";
const ICON_MODE: "emoji" | "nerd" | "off" = ASCII
  ? "off"
  : argIcons === "nerd" || argIcons === "emoji"
    ? argIcons
    : argIcons === "text" || argIcons === "off"
      ? "off"
      : envIcons;
const POWERLINE = () =>
  PLGLYPH && !noColor() && process.env.RUST_STUDIO_STATUSLINE_POWERLINE !== "0" && !ARGV.includes("--no-powerline");

// ---------------- Tokyo Night palette (truecolor) ----------------
type RGB = [number, number, number];
const TN = {
  bg: [26, 27, 38] as RGB,
  bg2: [41, 46, 66] as RGB,
  fg: [192, 202, 245] as RGB,
  blue: [122, 162, 247] as RGB,
  cyan: [125, 207, 255] as RGB,
  green: [158, 206, 106] as RGB,
  yellow: [224, 175, 104] as RGB,
  orange: [255, 158, 100] as RGB,
  red: [247, 118, 142] as RGB,
  magenta: [187, 154, 247] as RGB,
  dim: [86, 95, 137] as RGB,
};
function pctRgb(p: number): RGB {
  return p < 50 ? TN.green : p < 80 ? TN.yellow : TN.red;
}
const sameRGB = (a: RGB, b: RGB) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// ---------------- glyphs / icons ----------------
const G = {
  barFull: ASCII ? "#" : "█", // █
  barEmpty: ASCII ? "." : "░", // ░
  phFull: ASCII ? "#" : "▰", // ▰
  phEmpty: ASCII ? "-" : "▱", // ▱
  dirty: ASCII ? "*" : "●", // ●
  ahead: ASCII ? "^" : "↑", // ↑
  behind: ASCII ? "v" : "↓", // ↓
  phase: ASCII ? ">" : "▸", // ▸
  ok: ASCII ? "+" : "✓", // ✓
  no: ASCII ? "x" : "✗", // ✗
  del: ASCII ? "-" : "−", // −
  arrow: "\u{E0B0}", // powerline right cap (between different backgrounds)
  arrowThin: "\u{E0B1}", // powerline thin separator (between same-background segments)
  topL: ASCII ? "+-" : "╭─", // ╭─
  botL: ASCII ? "+-" : "╰─", // ╰─
};
const EMOJI = { folder: "📁 ", ctx: "📊 ", cache: "💾 ", clock: "🕐 " };
const NF = { folder: "\u{F07B} ", ctx: "\u{F0E4} ", cache: "\u{F1C0} ", clock: "\u{F017} " };
const pick = (k: "folder" | "ctx" | "cache" | "clock", textLabel: string) =>
  ICON_MODE === "emoji" ? EMOJI[k] : ICON_MODE === "nerd" ? NF[k] : textLabel;
const I = {
  folder: pick("folder", ""),
  branch: PLGLYPH ? "\u{E0A0} " : "", // powerline branch glyph (renders wherever the arrows do)
  ctx: pick("ctx", "ctx "),
  clock: pick("clock", ""),
  cache: pick("cache", "cache "),
};
const SEP_PLAIN = ASCII ? " | " : " · "; // ·

// ---------------- color ----------------
const fgCode = (c: RGB) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`;
const bgCode = (c: RGB) => `\x1b[48;2;${c[0]};${c[1]};${c[2]}m`;
const RESET = "\x1b[0m";
function paintFg(rgb: RGB | undefined, s: string): string {
  return noColor() || !rgb || !s ? s : `${fgCode(rgb)}${s}${RESET}`;
}
const dim = (s: string) => (noColor() || !s ? s : `\x1b[2m${s}${RESET}`);

/** Color a string by a 0-100 percentage with a truecolor green->yellow->red gradient. */
export function byPct(pct: number, s: string): string {
  const p = Math.max(0, Math.min(100, pct));
  if (noColor()) return s;
  const r = p < 50 ? Math.round((p / 50) * 255) : 255;
  const g = p < 50 ? 255 : Math.round((1 - (p - 50) / 50) * 255);
  return `${fgCode([r, g, 40])}${s}${RESET}`;
}

// ---------------- pure formatters (tested) ----------------
export function stripModel(name: string): string {
  return String(name || "")
    .replace(/\s*\((?:[^)]*context[^)]*)\)\s*$/i, "")
    .replace(/\s*\[[^\]]*\]\s*$/i, "")
    .trim();
}

export function bar(pct: number, width = 10): string {
  const p = Math.max(0, Math.min(100, pct || 0));
  const filled = Math.round((p / 100) * width);
  return G.barFull.repeat(filled) + G.barEmpty.repeat(Math.max(0, width - filled));
}

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

export function gitText(g: { branch?: string; dirty?: number; ahead?: number; behind?: number }): string {
  if (!g || !g.branch) return "";
  let out = g.branch;
  if (g.dirty) out += ` ${G.dirty}${g.dirty}`;
  if (g.ahead) out += ` ${G.ahead}${g.ahead}`;
  if (g.behind) out += ` ${G.behind}${g.behind}`;
  return out;
}

export function effortLabel(level?: string): string {
  const l = String(level || "").toLowerCase();
  return ["low", "medium", "high", "xhigh", "max"].includes(l) ? `think:${l}` : "";
}

export function cacheHitPct(usage: any): number | null {
  if (!usage) return null;
  const read = Number(usage.cache_read_input_tokens) || 0;
  const input = Number(usage.input_tokens) || 0;
  const denom = read + input;
  if (denom <= 0) return null;
  return Math.round((read / denom) * 100);
}

// ---------------- segments ----------------
interface Seg {
  text: string;
  fg: RGB;
  bg: RGB;
}
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

function projectName(dir: string): string {
  return dir ? dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "" : "";
}

function segs1(session: any, git: GitInfo, lspInRust: boolean, lspOk: boolean): Seg[] {
  const out: Seg[] = [];
  out.push({ text: "\u{1F980} rust-studio", fg: TN.bg, bg: TN.blue }); // 🦀
  // Prefer the project root name over a subdirectory (e.g. show "rust-studio", not "scripts").
  const proj = projectName(session?.workspace?.project_dir || session?.workspace?.current_dir || session?.cwd || "");
  if (proj) out.push({ text: `${I.folder}${proj}`, fg: TN.fg, bg: TN.bg2 });
  const gt = gitText(git);
  if (gt) out.push({ text: `${I.branch}${gt}`, fg: git.dirty ? TN.yellow : TN.green, bg: TN.bg2 });
  const model = stripModel(session?.model?.display_name || session?.model?.id || "");
  if (model) out.push({ text: model, fg: TN.magenta, bg: TN.bg2 });
  const effort = effortLabel(session?.effort?.level);
  if (effort) out.push({ text: effort, fg: TN.orange, bg: TN.bg2 });
  if (lspInRust) out.push({ text: `lsp ${lspOk ? G.ok : G.no}`, fg: lspOk ? TN.green : TN.red, bg: TN.bg2 });
  return out;
}

function segs2(session: any, progress: Progress | null): Seg[] {
  const out: Seg[] = [];
  const withBar = !POWERLINE(); // a block bar is illegible on a colored powerline background
  const pct = session?.context_window?.used_percentage;
  if (typeof pct === "number") {
    const over = session?.exceeds_200k_tokens === true;
    const p = over ? Math.max(pct, 85) : pct;
    const body = withBar ? `${bar(pct)} ${Math.round(pct)}%` : `${Math.round(pct)}%`;
    out.push({ text: `${I.ctx}${body}`, fg: TN.bg, bg: pctRgb(p) });
  }
  const cache = cacheHitPct(session?.context_window?.current_usage);
  if (cache != null) out.push({ text: `${I.cache}${cache}%`, fg: TN.cyan, bg: TN.bg2 });
  if (progress?.phase) {
    const pb = progress.step ? phaseBar(progress.step) : "";
    out.push({
      text: `${G.phase} ${progress.phase}` + (pb ? ` ${pb}` : "") + (progress.step ? ` ${progress.step}` : ""),
      fg: TN.blue,
      bg: TN.bg2,
    });
  }
  if (progress?.tasks) out.push({ text: `${G.ok} ${progress.tasks}`, fg: TN.green, bg: TN.bg2 });
  const rl = session?.rate_limits;
  const five = rl?.five_hour?.used_percentage;
  const seven = rl?.seven_day?.used_percentage;
  if (typeof five === "number") out.push({ text: `5h ${Math.round(five)}%`, fg: pctRgb(five), bg: TN.bg2 });
  if (typeof seven === "number") out.push({ text: `7d ${Math.round(seven)}%`, fg: pctRgb(seven), bg: TN.bg2 });
  const dur = fmtDuration(session?.cost?.total_duration_ms);
  if (dur) out.push({ text: `${I.clock}${dur}`, fg: TN.dim, bg: TN.bg2 });
  const add = session?.cost?.total_lines_added || 0;
  const del = session?.cost?.total_lines_removed || 0;
  if (add || del) out.push({ text: `+${add} ${G.del}${del}`, fg: TN.green, bg: TN.bg2 });
  return out;
}

// ---------------- rendering ----------------
function renderPowerline(segs: Seg[]): string {
  const s = segs.filter((x) => x && x.text);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += `${fgCode(s[i].fg)}${bgCode(s[i].bg)} ${s[i].text} ${RESET}`;
    const next = s[i + 1];
    if (next) {
      out += sameRGB(s[i].bg, next.bg)
        ? `${fgCode(TN.dim)}${bgCode(next.bg)}${G.arrowThin}${RESET}` // subtle divider, same bg
        : `${fgCode(s[i].bg)}${bgCode(next.bg)}${G.arrow}${RESET}`;
    } else {
      out += `${fgCode(s[i].bg)}${G.arrow}${RESET}`;
    }
  }
  return out;
}
function renderPlain(segs: Seg[]): string {
  return segs
    .filter((x) => x && x.text)
    .map((x) => paintFg(x.fg, x.text))
    .join(SEP_PLAIN);
}

/** Pure: build the status line. opts.git / lspInRust / lspOk are injected (no IO). */
export function render(
  session: any,
  progress: Progress | null,
  opts: { git?: GitInfo; lspInRust?: boolean; lspOk?: boolean } = {},
): string {
  const l1 = segs1(session, opts.git || {}, opts.lspInRust ?? false, opts.lspOk ?? false);
  const l2 = segs2(session, progress);
  if (POWERLINE()) {
    const top = renderPowerline(l1);
    const bot = renderPowerline(l2);
    return l2.length ? `${top}\n${bot}` : top;
  }
  const top = `${dim(G.topL)} ${renderPlain(l1)}`;
  const bot = `${dim(G.botL)} ${renderPlain(l2)}`;
  return l2.length ? `${top}\n${bot}` : top;
}

// ---------------- IO helpers (main only) ----------------
function gitRun(cwd: string, args: string[], timeout = 800): string | null {
  try {
    const r = Bun.spawnSync(["git", "-C", cwd, ...args], { stdout: "pipe", stderr: "ignore", stdin: "ignore", timeout });
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
function gitInfo(cwd: string): GitInfo {
  const key = cwd.replace(/[^a-z0-9]/gi, "_").slice(-80);
  const cache = join(tmpdir(), `rust-studio-git-${key}.json`);
  try {
    if (Date.now() - statSync(cache).mtimeMs < 5000) return JSON.parse(readFileSync(cache, "utf8"));
  } catch {
    /* miss */
  }
  const info: GitInfo = {};
  const branch = gitRun(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch) {
    try {
      writeFileSync(cache, JSON.stringify(info));
    } catch {}
    return info;
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
function readProgress(dir: string): Progress | null {
  try {
    const f = join(dir, ".rust-studio", "progress.json");
    if (existsSync(f)) return freshProgress(JSON.parse(readFileSync(f, "utf8")));
  } catch {
    /* none */
  }
  return null;
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
    session?.workspace?.project_dir || session?.workspace?.current_dir || session?.cwd || process.cwd();
  const progress = readProgress(dir);
  const inRust = existsSync(join(dir, "Cargo.toml"));
  const lspOk = inRust && Bun.which("rust-analyzer") != null;
  const git = gitInfo(dir);
  process.stdout.write(render(session, progress, { git, lspInRust: inRust, lspOk }));
  process.exit(0);
}
