#!/usr/bin/env bun
// Rust Code Studio — SessionStart hook.
//
// 1) Detects a Rust project at the session cwd and injects a concise studio briefing
//    (detected stack + domain classification + collaboration protocol).
// 2) RECALLS project memory from the host-native store (Claude Code's auto-memory
//    directory for this repo, shared with Codex sessions): ranks the index against a
//    cheap git signal (branch / changed crates / last commit) and surfaces the few notes
//    that bind this work, plus index health (budget, index ↔ files). On Claude Code the
//    host loads the index itself, so only pointers are added; on Codex the index rides
//    along. Deeper retrieval is `/recall`. Never fails the session: on any error it
//    injects what it can and exits 0.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readInput, emit, watchdog, option, optionBool, pluginRoot } from "./_lib.ts";
import {
  INDEX_FILE,
  bodyReader,
  budgetLine,
  gitSignal,
  indexHealth,
  labelFor,
  rankEntries,
  readIndex,
  resolveStore,
  type IndexEntry,
  type IndexHealth,
  type Ranked,
  type StoreInfo,
} from "./memory-store.ts";

// Armed for the WHOLE run — buildRecall's git calls + vault walk happen after
// stdin, so disarming after readInput would leave the slow path unguarded and
// hand a stall to the harness's 20s kill (which loses the briefing too).
watchdog(15_000);

// --- minimal Cargo.toml field extraction (no TOML dep; only the fields used) ---
function section(text: string, name: string): string {
  const out: string[] = [];
  let inSec = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) {
      inSec = line.trim() === `[${name}]`;
      continue;
    }
    if (inSec) out.push(line);
  }
  return out.join("\n");
}
function field(body: string, key: string): string | null {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']*)["']`, "m").exec(body);
  return m ? m[1] : null;
}

function classify(textLower: string): string[] {
  const hay = textLower;
  const domains: string[] = [];
  if (
    hay.includes("#![no_std]") ||
    hay.includes("embedded-hal") ||
    hay.includes("cortex-m") ||
    hay.includes("no-std")
  )
    domains.push("systems/embedded");
  if (["tokio", "axum", "actix-web", "actix_web", "hyper", "tower", "sqlx", "async-std"].some((k) => hay.includes(k)))
    domains.push("async/web");
  if (["clap", "ratatui", "crossterm"].some((k) => hay.includes(k)) || hay.includes("[[bin]]"))
    domains.push("cli");
  if (hay.includes("[lib]")) domains.push("library/crate");
  const seen: string[] = [];
  for (const d of domains) if (!seen.includes(d)) seen.push(d);
  return seen.length ? seen : ["(undetermined — run /detect-stack)"];
}

/** Map the detected domain(s) to the right ENTRY skill, so the always-on briefing
 *  routes to the fitting command instead of the same generic list every session.
 *  Universal fallbacks (/dev-task, /review, /help) are surfaced separately. */
export function routeByDomain(domains: string[]): string {
  const picks: string[] = [];
  if (domains.includes("async/web"))
    picks.push("`/team-async` for an async/web feature, `/design-api` for the surface");
  if (domains.includes("systems/embedded"))
    picks.push("`/team-perf` for perf/safety, `/audit-unsafe` to review unsafe");
  if (domains.includes("cli")) picks.push("`/dev-task` (cli focus) for a subcommand");
  if (domains.includes("library/crate"))
    picks.push("`/design-api` or `/team-api` for the public surface");
  if (!picks.length)
    return "run `/detect-stack` to classify the stack, then `/start` for guided onboarding.";
  return picks.join("; ") + ".";
}

// --- memory recall (host-native store; a command hook has no tools, so it reads the files) ---

/** Warnings worth a line at session start: the index is close to what the host will
 *  load, or the index and the files disagree. Empty when healthy. */
export function healthLines(h: IndexHealth): string[] {
  const out: string[] = [];
  if (h.overCap)
    out.push(`⚠ memory ${budgetLine(h)} — OVER the host cap: Claude Code stops loading past it. Run \`/memory-doctor\` now.`);
  else if (h.nearCap) out.push(`⚠ memory ${budgetLine(h)} (${Math.round(h.fill * 100)}%) — run \`/memory-doctor\` before it hits the cap.`);
  const bad: string[] = [];
  if (h.dangling.length) bad.push(`${h.dangling.length} index line(s) point at missing files`);
  if (h.unindexed.length) bad.push(`${h.unindexed.length} note(s) have no index line`);
  if (h.duplicates.length) bad.push(`${h.duplicates.length} duplicate index line(s)`);
  if (bad.length) out.push(`⚠ memory index ↔ files disagree: ${bad.join("; ")} — \`/memory-doctor\` (reindex / archive).`);
  return out;
}

export interface RecallView {
  store: StoreInfo;
  entries: IndexEntry[];
  health: IndexHealth;
  ranked: Ranked[];
  signal: string[];
  labelOf: (file: string) => string;
  now?: number;
}

/** Render the session-start memory block. On Claude Code the host already loads the
 *  index, so this is pointers + health only; on a host that does not (Codex), it also
 *  carries the index itself, ranked matches first. */
export function renderRecall(v: RecallView): string {
  const { store, entries, health, ranked } = v;
  const dir = store.dir.replace(/\\/g, "/");
  const pathOf = (file: string): string => `${dir}/${file}`;
  const bullet = (e: IndexEntry): string =>
    `- **${e.title}**${v.labelOf(e.file)}${e.hook ? ` — ${e.hook}` : ""}\n    Read: \`${pathOf(e.file)}\``;
  const contract = join(pluginRoot(), "docs", "memory-protocol.md").replace(/\\/g, "/");
  const sig = v.signal.length ? ` (signal: ${v.signal.slice(0, 8).join(", ")})` : "";
  const warn = healthLines(health);
  const lines: string[] = [];

  if (store.hostInjectsIndex) {
    if (ranked.length) {
      lines.push(`## Project memory — pointers for this work${sig}`, "", ...ranked.map(bullet), "");
      lines.push(
        `_${entries.length} notes indexed (${budgetLine(health)}); Claude Code loads the index itself. ` +
          "`/recall <topic>` to pull more, `/remember` to save what settles, `/memory-doctor` to audit. " +
          `Contract: \`${contract}\`._`,
      );
    } else {
      lines.push(
        `_Project memory: ${entries.length} notes in \`${dir}\` (index loaded by Claude Code) — consult before ` +
          "re-deriving a decision; `/recall <topic>` · `/remember` · `/memory-doctor`._",
      );
    }
  } else {
    lines.push(`## Project memory${sig}`, "");
    lines.push(
      `Durable decisions, gotchas, conventions, and fixes from earlier sessions live in \`${dir}\` ` +
        "(shared with Claude Code's auto-memory for this repo). Consult before re-deriving; capture what settles " +
        `with \`/remember\`; contract: \`${contract}\`.`,
      "",
    );
    const seen = new Set(ranked.map((r) => r.file));
    const rest = entries.filter((e) => !seen.has(e.file));
    const cap = Math.max(0, INDEX_INJECT_CAP - ranked.length);
    if (ranked.length) lines.push("**Most relevant to this work:**", ...ranked.map(bullet), "");
    if (rest.length) lines.push(ranked.length ? "**Everything else:**" : "", ...rest.slice(0, cap).map(bullet));
    if (rest.length > cap) lines.push(`- … ${rest.length - cap} more in \`${pathOf(INDEX_FILE)}\``);
    lines.push("", "_`/recall <topic>` to pull more, `/remember` to save, `/memory-doctor` to audit._");
  }
  if (warn.length) lines.push("", ...warn);
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

/** How many index lines a non-injecting host gets at session start (the index itself
 *  is capped at 200 by the host; a hook briefing should stay well under that). */
export const INDEX_INJECT_CAP = 60;

function buildRecall(cwd: string): string {
  try {
    const store = resolveStore(cwd);
    if (!store.exists) return ""; // nothing saved for this project yet
    const index = readIndex(store.dir);
    const health = indexHealth(store.dir, index);
    const entries = index?.entries ?? [];
    if (!entries.length && !health.unindexed.length) return "";
    const sig = gitSignal(cwd);
    const ranked = rankEntries(entries, sig, 5, bodyReader(store.dir));
    const metaCache = new Map<string, string>();
    const labelOf = (file: string): string => {
      let l = metaCache.get(file);
      if (l == null) {
        l = labelFor(store.dir, file);
        metaCache.set(file, l);
      }
      return l;
    };
    return renderRecall({ store, entries, health, ranked, signal: [...sig], labelOf });
  } catch {
    return "";
  }
}

interface Input {
  cwd?: string;
}

const data = await readInput<Input>();

const cwd = data.cwd || process.cwd();
const manifest = join(cwd, "Cargo.toml");

let manifestExists = false;
try {
  manifestExists = statSync(manifest).isFile();
} catch {
  manifestExists = false;
}

let briefing: string;
let title = ""; // Claude Code >= 2.1.183 names the session from hookSpecificOutput.sessionTitle

if (!manifestExists) {
  briefing =
    "## Rust Code Studio active\n\n" +
    "Rust Code Studio plugin is active, but no Cargo.toml was found at the session root. " +
    "If this is a Rust project, run /detect-stack from its root. " +
    "Studio protocol: Question → Options → Decision → Draft → Approval.";
} else {
  let text = "";
  try {
    text = readFileSync(manifest, "utf8");
  } catch {
    text = "";
  }

  const pkg = section(text, "package");
  const name = field(pkg, "name") || "?";
  if (name !== "?") title = `🦀 ${name}`;
  const edition = field(pkg, "edition") || "?";
  const msrvDefault = option("default_msrv");
  const msrv = field(pkg, "rust-version") || (msrvDefault ? `${msrvDefault} (studio default)` : "(unset)");

  const isWorkspace = /^\[workspace\]\s*$/m.test(text);
  let members = 0;
  if (isWorkspace) {
    const ws = section(text, "workspace");
    const mm = /members\s*=\s*\[([\s\S]*?)\]/.exec(ws);
    if (mm) members = (mm[1].match(/["'][^"']+["']/g) || []).length;
  }

  const domains = classify(text.toLowerCase());

  const testRunner = option("test_runner") || "nextest";
  const gates = option("gate_intensity") || "full";
  const progress = optionBool("progress_tracking", true) ? "on" : "off";

  const lines = [
    "## Rust Code Studio active",
    "",
    `Detected Rust project at \`${cwd}\`.`,
    `- Crate/workspace: **${name}**` + (isWorkspace ? ` (workspace, ${members} member globs)` : ""),
    `- Edition: ${edition}   MSRV (rust-version): ${msrv}`,
    `- Domain(s): **${domains.join(", ")}**`,
    "",
    "**Protocol:** a quality loop, **autonomy-first** — decide tactical calls yourself " +
      "(state the choice + one-line rationale, then proceed); ask only on " +
      "strategic/irreversible/outward steps. No quick wins, no shims, finish the cross-crate " +
      "ripple; observability ships in the same pass. See docs/working-preferences.md.",
    "**Team:** directors (chief-architect, product-steward) → leads → specialists. " +
      "Path-scoped Rust standards are injected automatically when you edit matching files.",
    `**Studio config:** gates **${gates}** · tests **${testRunner}** · progress **${progress}**` +
      (msrvDefault ? ` · MSRV-default **${msrvDefault}**` : "") +
      " (change via `/plugin` → Rust Code Studio → configure). " +
      "rust-analyzer LSP is bundled — diagnostics surface after each edit when the binary is on PATH.",
    `**Gate intensity ${gates}** scales how many lenses review a change, never the evidence ` +
      "behind a claim. `unsafe`, public-API, and release changes run **full** regardless. " +
      "Every mode keeps the same bar: command output behind each claim, honest denominators, " +
      '"unverified" as a valid state. See docs/verdicts.md §"Review modes".',
    `**Start here${domains.some((d) => d.startsWith("(undetermined")) ? "" : ` (${domains.join(", ")})`}:** ` +
      routeByDomain(domains),
    "**Always available:** `/dev-task` to implement one unit of work, `/review` to audit a diff, " +
      "`/help` for the full catalog, `/start` for guided onboarding.",
    "**Skills first:** for any non-trivial task, check `/help` for a studio skill that fits " +
      "before improvising — prefer the skill's discipline (gates, agents, evidence) over ad-hoc steps.",
  ];

  if (isWorkspace && members) {
    lines.push(
      "",
      `**Large workspace (${members} member globs):** scope context to the crate you ` +
        "touch — per-crate CLAUDE.md, `permissions.deny` on target/generated, and the " +
        "bundled rust-analyzer LSP for symbol lookup. Run `/adopt` or see docs/large-workspace.md.",
    );
  }

  briefing = lines.join("\n");
}

const recall = optionBool("memory_recall", true) ? buildRecall(cwd) : "";

emit({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: briefing + (recall ? "\n\n" + recall : ""),
    ...(title ? { sessionTitle: title } : {}),
  },
});
