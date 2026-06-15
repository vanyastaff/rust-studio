#!/usr/bin/env bun
// Rust Code Studio — context-cost meter.
//
// Measures how many tokens the studio's HOOKS inject into the conversation — per
// event, per realistic session, and (empirically) from a real transcript. This is
// the "measure first" step before any context-rot optimization: it tells us which
// injections are one-time vs. repeated-every-turn, and what fraction of injected
// context is pure redundancy (the same bytes appearing more than once), which is
// the part that dilutes attention as a session grows.
//
// Usage:
//   bun tools/context-cost.ts                         # static + projection
//   bun tools/context-cost.ts --transcript <a.jsonl>  # also scan a real transcript
//   bun tools/context-cost.ts --transcript auto       # auto-pick largest project transcript
//
// Token estimate is chars/CHARS_PER_TOK (~±15%); it is meant for RELATIVE
// comparison and prioritization, not billing.

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir, homedir } from "node:os";

const CHARS_PER_TOK = 4; // rough English/markdown/code average
const SCRIPTS = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PLUGIN_ROOT = join(SCRIPTS, ".."); // tools/ -> plugin root
const HOOKS = join(PLUGIN_ROOT, "hooks", "scripts");

// inject-rules dedupes per session_id+path via tmp markers; a per-run nonce keeps
// every invocation's markers unique so re-running this meter measures cleanly.
const RUN = `${process.pid}-${Date.now()}`;
const tok = (chars: number): number => Math.round(chars / CHARS_PER_TOK);
const pad = (s: string, n: number): string => (s.length >= n ? s : s + " ".repeat(n - s.length));
const padl = (s: string, n: number): string => (s.length >= n ? s : " ".repeat(n - s.length) + s);

interface RunResult {
  /** text that lands in the MODEL's context window (additionalContext / UserPromptSubmit stdout) */
  modelContext: string;
  /** text shown only to the USER (systemMessage) — not part of the model window */
  userMessage: string;
  raw: string;
}

async function runHook(
  script: string,
  input: unknown,
  env: Record<string, string> = {},
): Promise<RunResult> {
  const proc = Bun.spawn(["bun", join(HOOKS, script)], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, ...env },
  });
  proc.stdin.write(JSON.stringify(input));
  proc.stdin.end();
  const raw = await new Response(proc.stdout).text();
  await proc.exited;
  let modelContext = "";
  let userMessage = "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const o = JSON.parse(trimmed);
      modelContext = o?.hookSpecificOutput?.additionalContext ?? "";
      userMessage = o?.systemMessage ?? "";
    } catch {
      modelContext = raw; // not JSON -> treat stdout as injected context
    }
  } else {
    modelContext = raw; // UserPromptSubmit prints plain text to stdout
  }
  return { modelContext, userMessage, raw };
}

// ----------------------------------------------------------------------------
// A. STATIC — per-event injection cost
// ----------------------------------------------------------------------------
interface Row {
  hook: string;
  event: string;
  scenario: string;
  freq: string; // when it fires
  chars: number;
  toUser: boolean;
}

async function staticMeasure(): Promise<Row[]> {
  const rows: Row[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "ctx-cost-"));

  // 1) session-start — no Cargo.toml
  {
    const r = await runHook("session-start.ts", { cwd: tmp });
    rows.push({ hook: "session-start", event: "SessionStart", scenario: "no Cargo.toml", freq: "1×/session", chars: r.modelContext.length, toUser: false });
  }
  // 1b) session-start — workspace with async deps (full briefing)
  {
    const wsDir = join(tmp, "ws");
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(
      join(wsDir, "Cargo.toml"),
      `[package]\nname = "demo"\nedition = "2024"\nrust-version = "1.85"\n\n[workspace]\nmembers = ["crates/a","crates/b","crates/c"]\n\n[dependencies]\ntokio = "1"\naxum = "0.7"\nsqlx = "0.8"\nclap = "4"\n`,
    );
    const r = await runHook("session-start.ts", { cwd: wsDir });
    rows.push({ hook: "session-start", event: "SessionStart", scenario: "workspace + async/cli briefing", freq: "1×/session", chars: r.modelContext.length, toUser: false });
  }

  // 2) inject-rules — representative paths (unique session_id each => bypass dedup)
  const paths: Array<[string, Record<string, unknown>]> = [
    ["src/lib.rs (API root)", { file_path: "src/lib.rs" }],
    ["src/main.rs (CLI bin)", { file_path: "src/main.rs" }],
    ["src/error.rs", { file_path: "src/error.rs" }],
    ["crates/api/src/lib.rs", { file_path: "crates/api/src/lib.rs" }],
    ["src/handlers/users.rs (async)", { file_path: "src/handlers/users.rs" }],
    ["build.rs", { file_path: "build.rs" }],
    ["src/ffi.rs", { file_path: "src/ffi.rs" }],
    ["edit introducing `unsafe`", { file_path: "src/core.rs", new_string: "let p = unsafe { *raw };" }],
  ];
  let n = 0;
  for (const [label, ti] of paths) {
    const r = await runHook("inject-rules.ts", {
      hook_event_name: "PreToolUse",
      session_id: `cost-meter-${RUN}-${n++}-${label.replace(/\W/g, "")}`,
      tool_input: ti,
    });
    rows.push({ hook: "inject-rules", event: "PreToolUse", scenario: label, freq: "1×/distinct file", chars: r.modelContext.length, toUser: false });
  }

  // 3) user-prompt-submit — the per-turn nudge
  {
    const r = await runHook("user-prompt-submit.ts", { prompt: "add a feature", session_id: `nudge-${RUN}` });
    rows.push({ hook: "user-prompt-submit", event: "UserPromptSubmit", scenario: "routing nudge", freq: "1×/session", chars: r.modelContext.length, toUser: false });
  }

  // 4) subagent-stop — verdict present (silent) vs absent (injects)
  {
    const tWith = join(tmp, "twith.txt");
    const tNo = join(tmp, "tno.txt");
    writeFileSync(tWith, "...\nVerdict: COMPLETE — all checks green.\n");
    writeFileSync(tNo, "...\nthe agent rambled but gave no verdict token at all.\n");
    const rWith = await runHook("subagent-stop.ts", { agent_type: "rust-builder", transcript_path: tWith });
    const rNo = await runHook("subagent-stop.ts", { agent_type: "rust-builder", transcript_path: tNo });
    rows.push({ hook: "subagent-stop", event: "SubagentStop", scenario: "verdict present (silent)", freq: "per sub-agent", chars: rWith.modelContext.length, toUser: false });
    rows.push({ hook: "subagent-stop", event: "SubagentStop", scenario: "NO verdict (escalation)", freq: "per sub-agent", chars: rNo.modelContext.length, toUser: false });
  }

  // 5) pre-compact — systemMessage is USER-facing, not model context
  {
    const r = await runHook("pre-compact.ts", {});
    rows.push({ hook: "pre-compact", event: "PreCompact", scenario: "systemMessage (user-only)", freq: "per compaction", chars: r.userMessage.length, toUser: true });
  }

  // 6) fmt-check (Stop) and 7) session-end — measure whatever they inject
  {
    const r = await runHook("fmt-check.ts", { cwd: tmp });
    rows.push({ hook: "fmt-check", event: "Stop", scenario: "non-Rust cwd (no-op)", freq: "every Stop", chars: r.modelContext.length, toUser: false });
  }
  {
    const r = await runHook("session-end.ts", { cwd: tmp });
    rows.push({ hook: "session-end", event: "SessionEnd", scenario: "end of session", freq: "1×/session", chars: (r.modelContext || r.userMessage).length, toUser: !r.modelContext });
  }

  return rows;
}

// ----------------------------------------------------------------------------
// B. EMPIRICAL — scan a real transcript JSONL
// ----------------------------------------------------------------------------
interface HookStat {
  label: string;
  count: number;
  totalChars: number;
  uniqueChars: number; // sum of distinct contents
  uniqueCount: number;
}

function scanTranscript(path: string): { stats: HookStat[]; turns: number } {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const byLabel = new Map<string, { contents: string[]; seen: Map<string, number> }>();
  let turns = 0;
  for (const l of lines) {
    let o: any;
    try {
      o = JSON.parse(l);
    } catch {
      continue;
    }
    if (o.type === "user" && o.message && !o.toolUseResult && o.userType !== "external") {
      // crude human-turn counter: user records carrying a real prompt
    }
    const a = o.attachment;
    if (!a || !a.hookEvent) continue;
    const label = a.hookName || (a.command ? basename(String(a.command)).replace(/["']/g, "") : a.hookEvent);
    const content = String(a.content ?? a.stdout ?? "");
    if (!content) continue;
    if (!byLabel.has(label)) byLabel.set(label, { contents: [], seen: new Map() });
    const e = byLabel.get(label)!;
    e.contents.push(content);
    e.seen.set(content, (e.seen.get(content) || 0) + 1);
  }
  // count human turns = number of UserPromptSubmit hook firings (one per submitted prompt)
  for (const [label, e] of byLabel) if (/UserPromptSubmit/i.test(label)) turns = e.contents.length;

  const stats: HookStat[] = [];
  for (const [label, e] of byLabel) {
    const totalChars = e.contents.reduce((s, c) => s + c.length, 0);
    let uniqueChars = 0;
    for (const k of e.seen.keys()) uniqueChars += k.length;
    stats.push({ label, count: e.contents.length, totalChars, uniqueChars, uniqueCount: e.seen.size });
  }
  stats.sort((a, b) => b.totalChars - a.totalChars);
  return { stats, turns };
}

function autoTranscript(): string | null {
  const dir = join(homedir(), ".claude", "projects", "C--Users-vanya-rust-studio");
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ f: join(dir, f), s: statSync(join(dir, f)).size }))
      .sort((a, b) => b.s - a.s);
    return files.length ? files[0].f : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// C. PROJECTION — a typical session
// ----------------------------------------------------------------------------
function projection(rows: Row[], reinj: { totalChars: number; redundantChars: number; files: number }) {
  const get = (hook: string, scen?: string): number => {
    const r = rows.find((x) => x.hook === hook && (!scen || x.scenario === scen) && !x.toUser);
    return r ? r.chars : 0;
  };
  const TURNS = 40;
  const DISTINCT_FILES = reinj.files;
  const SUBAGENTS_NO_VERDICT = 3;

  const sessionStart = get("session-start", "workspace + async/cli briefing");
  const nudge = get("user-prompt-submit", "routing nudge");
  const subNo = get("subagent-stop", "NO verdict (escalation)");

  const items = [
    { what: "SessionStart briefing+recall", chars: sessionStart, redundant: 0 },
    { what: `Routing nudge ×1 (once/session)`, chars: nudge, redundant: 0 },
    { what: `inject-rules ×${DISTINCT_FILES} files`, chars: reinj.totalChars, redundant: reinj.redundantChars },
    { what: `subagent-stop (no verdict) ×${SUBAGENTS_NO_VERDICT}`, chars: subNo * SUBAGENTS_NO_VERDICT, redundant: 0 },
  ];
  const total = items.reduce((s, i) => s + i.chars, 0);
  const redundant = items.reduce((s, i) => s + i.redundant, 0);
  return { items, total, redundant, TURNS, DISTINCT_FILES };
}

// ----------------------------------------------------------------------------
// D. RULE RE-INJECTION — true cross-file redundancy
//
// inject-rules dedupes per PATH, but rules with a broad glob (core.md = **/*.rs,
// and other always-on baselines) are re-injected for EVERY distinct file. Each
// such injection is a fresh concatenation, so exact-match dedup (sections B/C)
// can't see the overlap. Here we decompose each file's injection back into its
// constituent rule bodies and count how many times each body is re-injected
// across a realistic multi-file session — the real context-rot driver.
// ----------------------------------------------------------------------------
async function ruleReinjection() {
  // a realistic async/web workspace coding session (12 distinct files)
  const files = [
    "src/lib.rs", "src/main.rs", "src/error.rs", "src/config.rs",
    "src/handlers/users.rs", "src/handlers/auth.rs", "src/routes/mod.rs",
    "src/db/mod.rs", "crates/core/src/lib.rs", "crates/api/src/lib.rs",
    "tests/integration.rs", "build.rs",
  ];
  // name -> { count: times its bullet is injected, size: bullet chars }
  const occ = new Map<string, { count: number; size: number }>();
  let totalChars = 0;
  let i = 0;
  for (const fp of files) {
    const r = await runHook("inject-rules.ts", {
      hook_event_name: "PreToolUse",
      session_id: `reinj-${RUN}-${i++}`,
      tool_input: { file_path: fp },
    });
    totalChars += r.modelContext.length;
    // each rule contributes one bullet "- **name** … \n    Read: …"
    const parts = r.modelContext.split(/\n- \*\*/);
    for (let k = 1; k < parts.length; k++) {
      const b = "- **" + parts[k];
      const m = /^- \*\*([a-z0-9-]+)\*\*/.exec(b);
      if (!m) continue;
      const e = occ.get(m[1]) || { count: 0, size: 0 };
      e.count++;
      e.size = Math.max(e.size, b.length);
      occ.set(m[1], e);
    }
  }
  const ranked = [...occ.entries()]
    .map(([name, e]) => ({ name, count: e.count, size: e.size, redundant: e.size * (e.count - 1) }))
    .sort((a, b) => b.redundant - a.redundant);
  const redundantChars = ranked.reduce((s, r) => s + r.redundant, 0);
  return { ranked, files: files.length, totalChars, redundantChars };
}

// ----------------------------------------------------------------------------
// Render
// ----------------------------------------------------------------------------
function bar(frac: number, width = 24): string {
  const n = Math.round(frac * width);
  return "█".repeat(n) + "░".repeat(width - n);
}

const args = process.argv.slice(2);
const tIdx = args.indexOf("--transcript");
const transcriptArg = tIdx >= 0 ? args[tIdx + 1] : null;

console.log("\n════════════════════════════════════════════════════════════════════");
console.log(" Rust Code Studio — context-cost meter   (tokens ≈ chars/" + CHARS_PER_TOK + ", ±15%)");
console.log("════════════════════════════════════════════════════════════════════\n");

const rows = await staticMeasure();

console.log("A. PER-EVENT INJECTION COST (static, hooks run with realistic inputs)\n");
console.log(
  "  " + pad("hook", 20) + pad("scenario", 34) + pad("fires", 18) + padl("chars", 7) + padl("~tok", 7) + "  dest",
);
console.log("  " + "-".repeat(96));
for (const r of rows) {
  console.log(
    "  " +
      pad(r.hook, 20) +
      pad(r.scenario, 34) +
      pad(r.freq, 18) +
      padl(String(r.chars), 7) +
      padl(String(tok(r.chars)), 7) +
      "  " +
      (r.toUser ? "user" : "MODEL"),
  );
}

const reinj = await ruleReinjection();
const proj = projection(rows, reinj);
console.log("\n\nC. PROJECTED SESSION  (" + proj.TURNS + " turns, " + proj.DISTINCT_FILES + " files, model-context only)\n");
console.log("  " + pad("source", 40) + padl("~tok", 9) + padl("redundant~tok", 16));
console.log("  " + "-".repeat(66));
for (const i of proj.items) {
  console.log("  " + pad(i.what, 40) + padl(String(tok(i.chars)), 9) + padl(String(tok(i.redundant)), 16));
}
console.log("  " + "-".repeat(66));
console.log("  " + pad("TOTAL injected", 40) + padl(String(tok(proj.total)), 9) + padl(String(tok(proj.redundant)), 16));
const redFrac = proj.total ? proj.redundant / proj.total : 0;
console.log(
  "\n  Redundant (pure repeats): " +
    bar(redFrac) +
    "  " +
    (redFrac * 100).toFixed(0) +
    "%  (" +
    tok(proj.redundant) +
    " of " +
    tok(proj.total) +
    " tok)",
);

// D. rule re-injection across a realistic multi-file session (reuse computed `reinj`)
{
  const { ranked, files } = reinj;
  console.log("\n\nD. RULE RE-INJECTION across " + files + " distinct files (per-rule, across the session)\n");
  console.log("  " + pad("rule", 16) + padl("injected", 9) + padl("ptr~tok", 10) + padl("redundant~tok", 16));
  console.log("  " + "-".repeat(51));
  let red = 0;
  let total = 0;
  for (const r of ranked) {
    total += tok(r.size * r.count);
    red += tok(r.redundant);
    console.log(
      "  " + pad(r.name, 16) + padl(r.count + "×", 9) + padl(String(tok(r.size)), 10) + padl(String(tok(r.redundant)), 16),
    );
  }
  console.log("  " + "-".repeat(51));
  console.log("  " + pad("TOTAL", 16) + padl("", 9) + padl(String(total), 10) + padl(String(red), 16));
  const f = total ? red / total : 0;
  console.log(
    "\n  Re-injected pointer overhead: " + bar(f) + "  " + (f * 100).toFixed(0) + "%  (" + red + " of " + total + " tok are repeat pointers)",
  );
  console.log("  Rule BODIES are no longer injected — agents Read them on demand, so per-session rule cost is now ~" + total + " tok (was ~34k).");
}

const tPath = transcriptArg === "auto" || (!transcriptArg && false) ? autoTranscript() : transcriptArg;
if (tPath) {
  console.log("\n\nB. EMPIRICAL — real transcript\n  " + tPath + "\n");
  try {
    const { stats, turns } = scanTranscript(tPath);
    if (!stats.length) {
      console.log("  (no hook attachments found in this transcript)");
    } else {
      console.log("  " + pad("hook", 22) + padl("fires", 7) + padl("uniq", 6) + padl("totChars", 10) + padl("~tok", 8) + padl("redundant~tok", 16));
      console.log("  " + "-".repeat(69));
      let gTot = 0;
      let gRed = 0;
      for (const s of stats) {
        const red = s.totalChars - s.uniqueChars;
        gTot += s.totalChars;
        gRed += red;
        console.log(
          "  " +
            pad(s.label, 22) +
            padl(String(s.count), 7) +
            padl(String(s.uniqueCount), 6) +
            padl(String(s.totalChars), 10) +
            padl(String(tok(s.totalChars)), 8) +
            padl(String(tok(red)), 16),
        );
      }
      console.log("  " + "-".repeat(69));
      console.log("  " + pad("TOTAL", 22) + padl("", 7) + padl("", 6) + padl(String(gTot), 10) + padl(String(tok(gTot)), 8) + padl(String(tok(gRed)), 16));
      const f = gTot ? gRed / gTot : 0;
      console.log(
        "\n  UserPromptSubmit fires: " + turns + " (multiple prompt-hooks can fire per human turn). " +
          "Redundant injected context: " + bar(f) + "  " + (f * 100).toFixed(0) + "%",
      );
    }
  } catch (e) {
    console.log("  could not scan transcript: " + (e as Error).message);
  }
} else {
  console.log("\n\nB. EMPIRICAL — skipped (pass --transcript <file> or --transcript auto)");
}

console.log("\n════════════════════════════════════════════════════════════════════\n");
