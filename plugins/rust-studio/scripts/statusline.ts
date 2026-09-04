#!/usr/bin/env bun
// Rust Code Studio — main status line (rich, opt-in via /progress-bar).
//
// Default look: Tokyo Night theme · Powerline segments (colored arrow caps) · Nerd Font icons.
// Adaptive layout: two lines when the terminal is wide, one line when it is not, and segments are
// dropped by priority until the line fits COLUMNS. Fallbacks (auto / env): no color or NO_COLOR ->
// plain colored/no-color middot line with rounded caps; RUST_STUDIO_STATUSLINE_NERDFONT=0 -> text
// labels, no glyph icons; RUST_STUDIO_STATUSLINE_POWERLINE=0 -> middot separators (keep
// color+icons); RUST_STUDIO_STATUSLINE_ASCII=1 -> pure ASCII. Phase/tasks come from
// <project>/.rust-studio/progress.json. git is cached ~5s. Never throws.
//
// Segment policy: a segment earns its width. Anything that is only interesting when it goes wrong
// (prompt-cache degradation, a rate limit about to bite, extra scope directories) lives in a single
// priority-rotating ALERT slot instead of occupying the line permanently.
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
const ICON_MODE: "emoji" | "nerd" | "symbols" | "off" = ASCII
  ? "off"
  : argIcons === "nerd" || argIcons === "emoji" || argIcons === "symbols"
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
  warn: ASCII ? "!" : "⚠", // ⚠
  pending: ASCII ? "." : "·", // ·
  draft: ASCII ? "o" : "○", // ○
  ellipsis: ASCII ? "~" : "…", // …
  arrow: "\u{E0B0}", // powerline right cap (between different backgrounds)
  arrowThin: "\u{E0B1}", // powerline thin separator (between same-background segments)
  topL: ASCII ? "+-" : "╭─", // ╭─
  botL: ASCII ? "+-" : "╰─", // ╰─
};
/** Sparkline ramp, low -> high. ASCII mode degrades to a coarse three-step ramp. */
const SPARK = ASCII ? [".", "-", "=", "#"] : ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const EMOJI = { folder: "\u{1F4C1} ", ctx: "\u{1F4CA} ", cache: "\u{1F4BE} ", clock: "\u{1F550} ", fast: "⚡", burn: "\u{1F525} " };
const NF = { folder: "\u{F07B} ", ctx: "\u{F0E4} ", cache: "\u{F1C0} ", clock: "\u{F017} ", fast: "\u{F0E7}", burn: "\u{F06D} " };
// Plain-Unicode set (renders in a normal monospace font — no Nerd Font needed):
// ⌂ house, ◔ gauge/pie, ↻ refresh (cache reuse), ⏱ stopwatch (U+23F1), ⚡ bolt, ~ rate.
const SYM = { folder: "⌂ ", ctx: "◔ ", cache: "↻ ", clock: "⏱ ", fast: "⚡", burn: "∿ " };
const pick = (k: keyof typeof EMOJI, textLabel: string) =>
  ICON_MODE === "emoji" ? EMOJI[k] : ICON_MODE === "nerd" ? NF[k] : ICON_MODE === "symbols" ? SYM[k] : textLabel;
const I = {
  folder: pick("folder", ""),
  branch: PLGLYPH ? "\u{E0A0} " : "", // powerline branch glyph (renders wherever the arrows do)
  ctx: pick("ctx", "ctx "),
  clock: pick("clock", ""),
  cache: pick("cache", "cache "),
  fast: pick("fast", "fast"),
  burn: pick("burn", ""),
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

// ---------------- width / terminal fitting ----------------
const OSC8_RE = /\x1b\]8;;[^\x1b\x07]*(?:\x1b\\|\x07)/g;
const SGR_RE = /\x1b\[[0-9;]*m/g;

/** Visible width of a rendered string: ANSI colors and OSC 8 link wrappers cost no columns, and
 *  emoji / powerline-drawn glyphs occupy two. Approximate by design — it drives layout, not cursor
 *  placement. */
export function displayWidth(s: string): number {
  const plain = String(s || "")
    .replace(OSC8_RE, "")
    .replace(SGR_RE, "");
  let w = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue; // ZWJ / variation selectors
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f9ff) // emoji blocks
    // Misc-symbols/dingbats (U+2600-27BF: ✓ ✗ ⚠ …) are deliberately NOT wide: they default to text
    // presentation and render single-width in monospace fonts. Counting them as two would drop
    // segments that actually fit.
  );
}

export type Tier = "full" | "compact" | "micro";
/** Layout tier from the terminal width Claude Code exports as COLUMNS (v2.1.153+).
 *  Unknown width means "assume roomy" — never degrade a wide terminal on missing info. */
export function tierFor(cols?: number): Tier {
  if (!cols || !Number.isFinite(cols) || cols <= 0) return "full";
  if (cols < 80) return "micro";
  if (cols < 120) return "compact";
  return "full";
}

/** Make a clickable OSC 8 hyperlink. Only http(s) URLs are linked; anything else renders as text,
 *  so a malformed field can never inject escape sequences into the line. */
export function osc8(url: string | undefined, text: string): string {
  const u = String(url || "");
  if (!/^https?:\/\/[^\s\x00-\x1f]+$/.test(u)) return text;
  return `\x1b]8;;${u}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/** Shorten a branch/name to fit, keeping the tail meaningful. */
export function truncate(s: string, max: number): string {
  const str = String(s || "");
  if (max <= 1 || str.length <= max) return str;
  return str.slice(0, Math.max(1, max - 1)) + G.ellipsis;
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
  if (h < 24) return `${h}h${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

/** Compact token counts: 2100 -> "2.1k", 1_500_000 -> "1.5M". */
export function fmtTokens(n: number): string {
  const v = Math.max(0, Math.round(n || 0));
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

export function gitText(g: { branch?: string; dirty?: number; ahead?: number; behind?: number }, maxBranch = 0): string {
  if (!g || !g.branch) return "";
  let out = maxBranch > 0 ? truncate(g.branch, maxBranch) : g.branch;
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

/** Cache hit % for the alert slot. Claude Code >= 2.1.251 reports the session's own
 *  `prompt_cache.hit_ratio` (all requests, every provider); prefer it and fall back to
 *  the last response's token split on older versions. */
export function cacheHitFromSession(session: any): number | null {
  const ratio = session?.prompt_cache?.hit_ratio;
  if (typeof ratio === "number" && Number.isFinite(ratio)) return Math.round(ratio * 100);
  return cacheHitPct(session?.context_window?.current_usage);
}

/** Why the prompt cache last missed. `prompt_cache.last_miss_cause` is undocumented but shipped in
 *  2.1.261: `{ causes: string[], tools_added?: … }`. Returns "" when the harness says nothing. */
export function missCause(promptCache: any): string {
  const causes = promptCache?.last_miss_cause?.causes;
  if (!Array.isArray(causes) || causes.length === 0) return "";
  return causes
    .slice(0, 2)
    .map((c: any) => String(c).replace(/_/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

/** Time until a rate-limit window resets. `resets_at` is Unix epoch SECONDS. */
export function fmtResetIn(resetsAt?: number, now = Date.now()): string {
  const at = Number(resetsAt);
  if (!at || !Number.isFinite(at)) return "";
  const ms = at * 1000 - now;
  return ms > 0 ? fmtDuration(ms) : "";
}

/** One rate-limit window: "5h 23%" plus a reset countdown when the harness reports one. */
export function rateText(win: any, label: string, now = Date.now()): string {
  const pct = Number(win?.used_percentage);
  if (!Number.isFinite(pct)) return "";
  const reset = fmtResetIn(win?.resets_at, now);
  return `${label} ${Math.round(pct)}%` + (reset ? ` ${G.pending}${reset}` : "");
}

/** Pull-request / merge-request pill. `pr.kind === "mr"` marks a GitLab merge request
 *  (Claude Code >= 2.1.234), which is numbered with `!` rather than `#`. */
export function prText(pr: any): string {
  const num = Number(pr?.number);
  if (!Number.isFinite(num) || num <= 0) return "";
  const isMr = String(pr?.kind || "") === "mr";
  const head = isMr ? `MR !${num}` : `PR #${num}`;
  const state = String(pr?.review_state || "");
  const glyph =
    state === "approved" ? G.ok : state === "changes_requested" ? G.no : state === "draft" ? G.draft : state === "pending" ? G.pending : "";
  return glyph ? `${head} ${glyph}` : head;
}
export function prColor(pr: any): RGB {
  const state = String(pr?.review_state || "");
  if (state === "approved") return TN.green;
  if (state === "changes_requested") return TN.red;
  if (state === "draft") return TN.dim;
  return TN.yellow;
}

// ---------------- burn rate (cross-invocation state) ----------------
export interface BurnSample {
  t: number;
  cum: number;
}
export interface BurnState {
  cum: number;
  sig: string;
  samples: BurnSample[];
}
const BURN_MAX_SAMPLES = 24;
const BURN_WINDOW_MS = 10 * 60_000;

/** Fold one status-line invocation into the burn-rate state.
 *
 *  The payload carries no cumulative token counter — `context_window.current_usage` describes only
 *  the most recent API response, and it repeats unchanged across the several status-line runs that
 *  one response triggers. So accumulate ourselves: when the usage object changes, the tokens the
 *  model actually had to process anew are `output_tokens + cache_creation_input_tokens` (cache
 *  reads are, by definition, not new work). Pure so it can be tested without touching disk. */
export function updateBurn(prev: BurnState | null, usage: any, now: number): BurnState {
  const base: BurnState = prev && Number.isFinite(prev.cum) ? prev : { cum: 0, sig: "", samples: [] };
  if (!usage || typeof usage !== "object") return base;
  const sig = `${usage.input_tokens || 0}/${usage.output_tokens || 0}/${usage.cache_creation_input_tokens || 0}/${usage.cache_read_input_tokens || 0}`;
  if (sig === base.sig) return base;
  const fresh = (Number(usage.output_tokens) || 0) + (Number(usage.cache_creation_input_tokens) || 0);
  const cum = base.cum + fresh;
  const samples = [...base.samples, { t: now, cum }].filter((s) => now - s.t <= BURN_WINDOW_MS).slice(-BURN_MAX_SAMPLES);
  return { cum, sig, samples };
}

/** Tokens per minute across the retained window, or null when there is not enough history. */
export function burnRate(samples: BurnSample[]): number | null {
  if (!Array.isArray(samples) || samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const minutes = (last.t - first.t) / 60_000;
  if (minutes <= 0) return null;
  const delta = last.cum - first.cum;
  if (delta <= 0) return null;
  return delta / minutes;
}

/** Sparkline over consecutive deltas, so the shape shows pace rather than the running total. */
export function sparkline(samples: BurnSample[], width = 8): string {
  if (!Array.isArray(samples) || samples.length < 3) return "";
  const deltas: number[] = [];
  for (let i = 1; i < samples.length; i++) deltas.push(Math.max(0, samples[i].cum - samples[i - 1].cum));
  const tail = deltas.slice(-width);
  const max = Math.max(...tail);
  if (!(max > 0)) return "";
  return tail.map((d) => SPARK[Math.min(SPARK.length - 1, Math.round((d / max) * (SPARK.length - 1)))]).join("");
}

// ---------------- alert slot ----------------
export interface Alert {
  text: string;
  rgb: RGB;
}
const CACHE_ALERT_BELOW = 70;
const RATE_ALERT_AT = 85;

/** The single rotating alert segment. Returns the highest-priority thing currently worth a column,
 *  or null when nothing is wrong — a calm line is the normal state.
 *  Order: money > rate limits > cache degradation > scope surprises. */
export function alertSlot(session: any, now = Date.now()): Alert | null {
  const rl = session?.rate_limits;

  const spend = Number(rl?.spend_limit?.used_percentage);
  if (Number.isFinite(spend) && spend >= RATE_ALERT_AT) {
    const reset = fmtResetIn(rl?.spend_limit?.resets_at, now);
    return { text: `${G.warn} spend ${Math.round(spend)}%${reset ? ` ${G.pending}${reset}` : ""}`, rgb: TN.red };
  }

  for (const [key, label] of [
    ["five_hour", "5h"],
    ["seven_day", "7d"],
  ] as const) {
    const pct = Number(rl?.[key]?.used_percentage);
    if (Number.isFinite(pct) && pct >= RATE_ALERT_AT) {
      const reset = fmtResetIn(rl?.[key]?.resets_at, now);
      return { text: `${G.warn} ${label} ${Math.round(pct)}%${reset ? ` ${G.pending}${reset}` : ""}`, rgb: TN.red };
    }
  }

  const hit = cacheHitFromSession(session);
  if (hit != null && hit < CACHE_ALERT_BELOW) {
    const cause = missCause(session?.prompt_cache);
    return { text: `${G.warn} ${I.cache}${hit}%${cause ? ` — ${cause}` : ""}`, rgb: TN.yellow };
  }

  const added = session?.workspace?.added_dirs;
  if (Array.isArray(added) && added.length > 0) {
    return { text: `+${added.length} dir${added.length > 1 ? "s" : ""}`, rgb: TN.dim };
  }

  return null;
}

/** Scope hint: which worktree / non-default tree the session is actually editing. */
export function scopeText(session: any): string {
  const wt = session?.worktree?.name || session?.workspace?.git_worktree;
  return wt ? `⎇ ${truncate(String(wt), 18)}` : ""; // ⎇
}

// ---------------- segments ----------------
// Priority is what a segment is worth per column, NOT where it sits on the line. Higher is dropped
// first, both by the tier cut and by width fitting:
//   0  identity + the two live numbers you steer by  (studio tag, git, PR, context %)
//   1  the alert slot — by construction it only exists when something is wrong
//   2  session accounting you act on  (5h limit, cost, phase, tasks)
//   3  orientation you usually already know  (project, model, worktree scope)
//   4  nice to see, never decisive  (7d, burn rate, duration, line deltas, effort, fast, lsp)
const PRIO = { core: 0, alert: 1, acct: 2, orient: 3, extra: 4 } as const;
interface Seg {
  text: string;
  fg: RGB;
  bg: RGB;
  prio: number;
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

function segs1(session: any, git: GitInfo, lspInRust: boolean, lspOk: boolean, tier: Tier): Seg[] {
  const out: Seg[] = [];
  // The studio tag is priority 0, so on a narrow terminal it must earn its width: the crab alone
  // still identifies the line.
  out.push({ text: tier === "micro" ? "\u{1F980}" : "\u{1F980} rust-studio", fg: TN.bg, bg: TN.blue, prio: PRIO.core }); // 🦀
  // Prefer the project root name over a subdirectory (e.g. show "rust-studio", not "scripts").
  const proj = projectName(session?.workspace?.project_dir || session?.workspace?.current_dir || session?.cwd || "");
  if (proj) out.push({ text: `${I.folder}${proj}`, fg: TN.fg, bg: TN.bg2, prio: PRIO.orient });
  const gt = gitText(git, tier === "full" ? 0 : tier === "compact" ? 14 : 10);
  if (gt) out.push({ text: `${I.branch}${gt}`, fg: git.dirty ? TN.yellow : TN.green, bg: TN.bg2, prio: PRIO.core });
  const pr = prText(session?.pr);
  if (pr) out.push({ text: osc8(session?.pr?.url, pr), fg: prColor(session?.pr), bg: TN.bg2, prio: PRIO.core });
  const scope = scopeText(session);
  if (scope) out.push({ text: scope, fg: TN.magenta, bg: TN.bg2, prio: PRIO.orient });
  const model = stripModel(session?.model?.display_name || session?.model?.id || "");
  if (model) out.push({ text: model, fg: TN.magenta, bg: TN.bg2, prio: PRIO.orient });
  const effort = effortLabel(session?.effort?.level);
  if (effort) out.push({ text: effort, fg: TN.orange, bg: TN.bg2, prio: PRIO.extra });
  else if (session?.thinking?.enabled === true) out.push({ text: "think", fg: TN.orange, bg: TN.bg2, prio: PRIO.extra });
  if (session?.fast_mode === true) out.push({ text: I.fast, fg: TN.yellow, bg: TN.bg2, prio: PRIO.extra });
  if (lspInRust) out.push({ text: `lsp ${lspOk ? G.ok : G.no}`, fg: lspOk ? TN.green : TN.red, bg: TN.bg2, prio: PRIO.extra });
  return out;
}

function segs2(session: any, progress: Progress | null, burn: BurnState | null, now: number): Seg[] {
  const out: Seg[] = [];
  const withBar = !POWERLINE(); // a block bar is illegible on a colored powerline background
  const pct = session?.context_window?.used_percentage;
  if (typeof pct === "number") {
    const over = session?.exceeds_200k_tokens === true;
    const p = over ? Math.max(pct, 85) : pct;
    const body = withBar ? `${bar(pct)} ${Math.round(pct)}%` : `${Math.round(pct)}%`;
    out.push({ text: `${I.ctx}${body}`, fg: TN.bg, bg: pctRgb(p), prio: PRIO.core });
  }
  const rate = burn ? burnRate(burn.samples) : null;
  if (rate != null) {
    const spark = sparkline(burn!.samples);
    out.push({ text: `${I.burn}${spark ? spark + " " : ""}${fmtTokens(rate)}/min`, fg: TN.cyan, bg: TN.bg2, prio: PRIO.extra });
  }
  const alert = alertSlot(session, now);
  if (alert) out.push({ text: alert.text, fg: alert.rgb, bg: TN.bg2, prio: PRIO.alert });
  if (progress?.phase) {
    const pb = progress.step ? phaseBar(progress.step) : "";
    out.push({
      text: `${G.phase} ${progress.phase}` + (pb ? ` ${pb}` : "") + (progress.step ? ` ${progress.step}` : ""),
      fg: TN.blue,
      bg: TN.bg2,
      prio: PRIO.acct,
    });
  }
  if (progress?.tasks) out.push({ text: `${G.ok} ${progress.tasks}`, fg: TN.green, bg: TN.bg2, prio: PRIO.acct });
  const rl = session?.rate_limits;
  const five = rateText(rl?.five_hour, "5h", now);
  if (five) out.push({ text: five, fg: pctRgb(Number(rl?.five_hour?.used_percentage) || 0), bg: TN.bg2, prio: PRIO.acct });
  const seven = rateText(rl?.seven_day, "7d", now);
  if (seven) out.push({ text: seven, fg: pctRgb(Number(rl?.seven_day?.used_percentage) || 0), bg: TN.bg2, prio: PRIO.extra });
  const cost = Number(session?.cost?.total_cost_usd);
  if (Number.isFinite(cost) && cost > 0) {
    out.push({ text: `$${cost < 10 ? cost.toFixed(2) : cost.toFixed(1)}`, fg: cost > 10 ? TN.orange : TN.green, bg: TN.bg2, prio: PRIO.acct });
  }
  const dur = fmtDuration(session?.cost?.total_duration_ms);
  if (dur) out.push({ text: `${I.clock}${dur}`, fg: TN.dim, bg: TN.bg2, prio: PRIO.extra });
  const add = session?.cost?.total_lines_added || 0;
  const del = session?.cost?.total_lines_removed || 0;
  if (add || del) out.push({ text: `+${add} ${G.del}${del}`, fg: TN.green, bg: TN.bg2, prio: PRIO.extra });
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

/** Drop segments until the rendered LINE (cap included — `renderFn` must produce the finished
 *  line, not just its segments) fits `cols` — ONE at a time, least important first, so the
 *  line spends the width it actually has. (Dropping a whole priority class at once overshoots
 *  badly: one segment too wide would collapse the line to its essentials.) Ties break toward the
 *  tail, which is the natural reading order to lose. Priority 0 is never dropped: a line that
 *  cannot fit its essentials is better truncated by the terminal than silently emptied. */
export function fitSegs(segs: Seg[], cols: number | undefined, renderFn: (s: Seg[]) => string): Seg[] {
  if (!cols || cols <= 0) return segs;
  const cur = segs.slice();
  while (displayWidth(renderFn(cur)) > cols) {
    let idx = -1;
    let worst = 0;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].prio > 0 && cur[i].prio >= worst) {
        worst = cur[i].prio;
        idx = i;
      }
    }
    if (idx < 0) break; // only essentials left
    cur.splice(idx, 1);
  }
  return cur;
}

/** Pure: build the status line. opts.git / lspInRust / lspOk / cols / burn are injected (no IO). */
export function render(
  session: any,
  progress: Progress | null,
  opts: {
    git?: GitInfo;
    lspInRust?: boolean;
    lspOk?: boolean;
    cols?: number;
    burn?: BurnState | null;
    now?: number;
  } = {},
): string {
  const now = opts.now ?? Date.now();
  const cols = opts.cols;
  const tier = tierFor(cols);
  const l1 = segs1(session, opts.git || {}, opts.lspInRust ?? false, opts.lspOk ?? false, tier);
  const l2 = segs2(session, progress, opts.burn ?? null, now);
  const rf = POWERLINE() ? renderPowerline : renderPlain;
  // Fitting must measure the COMPLETE line, cap included — measuring the segments alone
  // under-counts by the width of the "╭─ " prefix and overflows the terminal by exactly that much.
  const lineFn = (cap: string) => (segs: Seg[]) => renderTierLine(segs, rf, cap);

  if (tier === "full") {
    const topFn = lineFn(G.topL);
    const botFn = lineFn(G.botL);
    const top = topFn(fitSegs(l1, cols, topFn));
    const bot = botFn(fitSegs(l2, cols, botFn));
    return l2.length ? `${top}\n${bot}` : top;
  }

  // One line: merge both rows and let width fitting decide what survives. The tier already did its
  // job — it chose one row, shortened the branch and collapsed the studio tag; capping priority on
  // top of that would leave columns unused on an 80-119 terminal.
  const oneFn = lineFn(G.topL);
  return oneFn(fitSegs([...l1, ...l2], cols, oneFn));
}
function renderTierLine(segs: Seg[], rf: (s: Seg[]) => string, cap: string): string {
  return POWERLINE() ? rf(segs) : `${dim(cap)} ${rf(segs)}`;
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
/** Burn-rate state lives beside the git cache, keyed by session so two sessions never mix. */
function burnStateIO(session: any, now: number): BurnState | null {
  try {
    const id = String(session?.session_id || "default").replace(/[^a-z0-9-]/gi, "_").slice(-64);
    const f = join(tmpdir(), `rust-studio-burn-${id}.json`);
    let prev: BurnState | null = null;
    try {
      prev = JSON.parse(readFileSync(f, "utf8"));
    } catch {
      /* first run */
    }
    const next = updateBurn(prev, session?.context_window?.current_usage, now);
    try {
      writeFileSync(f, JSON.stringify(next));
    } catch {}
    return next;
  } catch {
    return null;
  }
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
  const now = Date.now();
  const progress = readProgress(dir);
  const inRust = existsSync(join(dir, "Cargo.toml"));
  const lspOk = inRust && Bun.which("rust-analyzer") != null;
  const git = gitInfo(dir);
  const burn = burnStateIO(session, now);
  // Claude Code exports the live terminal size (v2.1.153+); tput/isatty cannot see it from here.
  const cols = Number(process.env.COLUMNS) || undefined;
  process.stdout.write(render(session, progress, { git, lspInRust: inRust, lspOk, cols, burn, now }));
  process.exit(0);
}
