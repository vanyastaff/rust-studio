#!/usr/bin/env bun
// Rust Code Studio — acceptance ledger checker (CLI, bundled into the /acceptance skill).
//
// Runs the CHECK: lines of an acceptance ledger and writes definition-bound evidence back.
// A gate is met only when its command exits 0 AND its EXPECT: marker matches the combined
// stdout+stderr — a filter that matches zero tests, a wrong directory, or a missing tool all
// exit 0 with the wrong output, and this is the rule that turns those into failures.
//
// Modes (exactly one; the default is the one that cannot execute anything):
//   --status     parse and report state. Never runs a command, never writes.
//   --lint       advisory oracle audit (gates that cannot fail). Never runs, never writes.
//   --run        execute every runnable gate that is not currently met; record evidence.
//   --reverify   execute every runnable gate, met ones included; a failure demotes the gate.
//
// CHECK: lines are shell code with this process's permissions and environment. Inspect an
// inherited ledger with --status and read every command before --run; a ledger that arrived
// from outside the project is untrusted text (docs/untrusted-context.md). This CLI is never
// invoked by a hook — the Stop hook only parses — so a command runs only because an agent
// or a person asked for it, under the host's permission mode.
//
// Format and semantics: docs/acceptance-ledger.md. Zero dependencies; ships next to
// acceptance-ledger.ts inside the skill.

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  applyResult, definitionDigest, formatEvidence, gateState, isRunnable, lintLedger, matchExpect,
  parseLedger, qualify, safeText, summarize, type Gate, type GateState, type Ledger,
} from "./acceptance-ledger.ts";

export const OUTPUT_CAP = 4 * 1024 * 1024; // bytes of combined stdout+stderr per check
export const DEFAULT_TIMEOUT_S = 900; // cargo builds are slow; the ceiling is a safety net
const MAX_DIAG_LINES = 15;

type Mode = "status" | "lint" | "run" | "reverify";

export interface Options {
  mode: Mode;
  files: string[];
  cwd?: string;
  timeoutS: number;
  strict: boolean;
  json: boolean;
  help: boolean;
}

export const USAGE = `usage: acceptance-check.ts [--status | --lint | --run | --reverify] [options] <ledger.md> [more.md ...]

modes (default --status, which never executes or writes):
  --status        parse each ledger and report every gate's state
  --lint          audit the oracles: gates that cannot fail, unpinned cargo test counts,
                  activity titles, unmeasured numbers (--strict turns warnings into failures)
  --run           execute each runnable gate that is not met; write definition-bound evidence
  --reverify      execute every runnable gate, including met ones; a failure demotes the gate

options:
  --cwd DIR       working directory for CHECK: (default: the project root above .rust-studio/,
                  else the ledger's directory); a gate's CWD: is resolved beneath it
  --timeout S     per-check timeout in seconds, 1..86400 (default ${DEFAULT_TIMEOUT_S})
  --json          machine-readable report on stdout
  --strict        with --lint: exit 1 on warnings, not only on errors
  -h, --help      this text

a runnable gate is met only when its process exits 0 AND EXPECT: matches stdout+stderr.
ABANDON: <id> <reason> is a terminal handoff: the run exits 1 with HANDOFF REQUIRED.

exit codes: 0 all met (or lint clean); 1 unmet, failed, stale, or handoff; 2 usage or parse error.`;

export function parseArgs(argv: string[]): Options | Error {
  const o: Options = { mode: "status", files: [], timeoutS: DEFAULT_TIMEOUT_S, strict: false, json: false, help: false };
  let modeSet = false;
  let positional = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (positional || !a.startsWith("-")) { o.files.push(a); continue; }
    switch (a) {
      case "--": positional = true; break;
      case "-h": case "--help": o.help = true; break;
      case "--status": case "--lint": case "--run": case "--reverify":
        if (modeSet) return new Error(`only one mode may be given (saw ${a} after another mode)`);
        o.mode = a.slice(2) as Mode; modeSet = true; break;
      case "--strict": o.strict = true; break;
      case "--json": o.json = true; break;
      case "--cwd": {
        const v = argv[++i];
        if (!v) return new Error("--cwd needs a directory");
        o.cwd = v; break;
      }
      case "--timeout": {
        const v = argv[++i];
        const n = Number(v);
        if (!v || !Number.isInteger(n) || n < 1 || n > 86400) return new Error("--timeout needs an integer from 1 through 86400");
        o.timeoutS = n; break;
      }
      default: return new Error(`unknown option ${a}`);
    }
  }
  if (!o.help && o.files.length === 0) return new Error("name at least one ledger file");
  return o;
}

/** The directory a ledger's CHECK: lines run in: the project root that owns `.rust-studio/`,
 *  else the ledger's own directory. Repository-relative commands then mean the same thing
 *  from `/acceptance`, `/spec-verify`, and a person's shell. */
export function defaultCwd(ledgerPath: string): string {
  let dir = dirname(resolve(ledgerPath));
  for (let i = 0; i < 12; i++) {
    if (basename(dir) === ".rust-studio") return dirname(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirname(resolve(ledgerPath));
}

export function shellFor(platform = process.platform): { argv: (cmd: string) => string[]; name: string; groupKill: boolean } {
  if (platform === "win32") {
    const cmd = process.env.ComSpec || "cmd.exe";
    return { argv: (c) => [cmd, "/d", "/s", "/c", c], name: "cmd", groupKill: false };
  }
  // setsid makes the shell a process-group leader so a timeout can reap its descendants
  // (a killed `sh` otherwise leaves `cargo` running and holding the pipes). Linux ships it
  // in util-linux; where it is absent the plain shell is used and only the shell is killed.
  const hasSetsid = Bun.which("setsid") != null;
  return { argv: (c) => (hasSetsid ? ["setsid", "sh", "-c", c] : ["sh", "-c", c]), name: "sh", groupKill: hasSetsid };
}

export interface RunResult {
  exit: number;
  matched: boolean;
  combined: string;
  timedOut: boolean;
  overflow: boolean;
  spawnError?: string;
  durationMs: number;
}

/** Drain a stream into `chunks`, counting toward a shared byte budget. Stops — and reports
 *  overflow — the moment the budget is exceeded, so a runaway writer is cut off at the cap
 *  rather than after it exits. Resolves when the stream ends or the reader is torn down. */
async function collect(
  stream: ReadableStream<Uint8Array> | null,
  chunks: Uint8Array[],
  budget: { bytes: number; cap: number; overflow: boolean; onOverflow: () => void },
): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      budget.bytes += value.byteLength;
      if (budget.bytes > budget.cap) {
        if (!budget.overflow) { budget.overflow = true; budget.onOverflow(); }
        break;
      }
      chunks.push(value);
    }
  } catch { /* stream torn down by a kill — keep what arrived */ }
  try { reader.releaseLock(); } catch { /* already released */ }
}

const decode = (chunks: Uint8Array[]) => new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));

/** How long to wait, after the shell exited, for descendants that still hold its pipes. */
export const LINGER_GRACE_MS = 2000;

/** Execute one CHECK: line. Bounded three ways: a hard timeout, an output cap, and a grace
 *  period for descendants that outlive the shell — each kills the process group where
 *  setsid is available. Whatever output arrived before the cut is what EXPECT: sees. */
export async function runCheck(check: string, expect: string, cwd: string, timeoutS: number, opts: { cap?: number } = {}): Promise<RunResult> {
  const t0 = Date.now();
  const sh = shellFor();
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(sh.argv(check), {
      cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env: process.env,
      // timeout: the per-gate --timeout below kills the whole process group; Bun's own
      // timeout option would stop the shell only and leave cargo holding the pipes.
    });
  } catch (e) {
    return { exit: -1, matched: false, combined: "", timedOut: false, overflow: false, spawnError: String((e as Error).message ?? e), durationMs: Date.now() - t0 };
  }
  let killedFor: "timeout" | "overflow" | "linger" | null = null;
  const kill = (reason: "timeout" | "overflow" | "linger") => {
    if (!killedFor) killedFor = reason;
    if (sh.groupKill) { try { process.kill(-proc.pid, "SIGKILL"); } catch { /* already gone */ } }
    try { proc.kill("SIGKILL"); } catch { /* already gone */ }
  };
  const timer = setTimeout(() => kill("timeout"), timeoutS * 1000);
  const out: Uint8Array[] = [];
  const err: Uint8Array[] = [];
  const budget = { bytes: 0, cap: opts.cap ?? OUTPUT_CAP, overflow: false, onOverflow: () => kill("overflow") };
  const drained = Promise.all([collect(proc.stdout as ReadableStream<Uint8Array>, out, budget), collect(proc.stderr as ReadableStream<Uint8Array>, err, budget)]);
  const exit = await proc.exited;
  clearTimeout(timer);
  // A descendant that inherited the pipes (a server left in the background, a daemonizing
  // helper) can hold them open after the shell exited. Wait briefly, then reap it: the
  // check is over, and a process it left behind must not hold the checker — or the next
  // gate's port. What arrived before the cut is the transcript; the exit code stands.
  const lingered = await Promise.race([drained.then(() => false), new Promise<boolean>((r) => setTimeout(() => r(true), LINGER_GRACE_MS))]);
  if (lingered) kill("linger");
  const stdout = decode(out);
  const stderr = decode(err);
  const combined = stdout + (stdout && stderr ? "\n" : "") + stderr;
  const overflow = budget.overflow || Buffer.byteLength(combined, "utf8") > budget.cap;
  const timedOut = killedFor === "timeout";
  const matched = matchExpect(expect, combined);
  return { exit, matched, combined, timedOut, overflow, durationMs: Date.now() - t0 };
}

function readLedger(path: string): string {
  const st = statSync(path);
  if (!st.isFile()) throw new Error("not a regular file");
  if (st.size > 8 * 1024 * 1024) throw new Error("ledger larger than 8 MiB");
  return readFileSync(path, "utf8");
}

function writeAtomic(path: string, text: string): void {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

interface GateReport {
  id: string;
  qualified: string;
  title: string;
  runnable: boolean;
  state: GateState;
  ran?: boolean;
  exit?: number;
  matched?: boolean;
  durationMs?: number;
  note?: string;
}

interface LedgerReport {
  path: string;
  errors: string[];
  warnings: string[];
  gates: GateReport[];
  summary: ReturnType<typeof summarize> | null;
  handoffs: { id: string; reason: string }[];
}

const STATE_LABEL: Record<GateState, string> = { met: "met      ", unmet: "UNMET    ", stale: "STALE    ", abandoned: "ABANDONED" };

function diag(combined: string): string[] {
  const lines = combined.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.slice(-MAX_DIAG_LINES).map((l) => "      | " + safeText(l, 200));
}

async function processLedger(path: string, opts: Options, out: string[]): Promise<LedgerReport> {
  const report: LedgerReport = { path, errors: [], warnings: [], gates: [], summary: null, handoffs: [] };
  let text: string;
  try { text = readLedger(path); }
  catch (e) { report.errors.push(`cannot read: ${(e as Error).message}`); return report; }
  let ledger = parseLedger(text);
  report.errors = ledger.errors.slice();
  report.warnings = ledger.warnings.slice();
  if (ledger.errors.length) return report;

  const base = opts.cwd ? resolve(opts.cwd) : defaultCwd(path);
  const shell = shellFor().name;
  const execute = opts.mode === "run" || opts.mode === "reverify";

  for (const gate of ledger.gates) {
    const gr: GateReport = {
      id: gate.id, qualified: qualify(path, gate.id), title: gate.title, runnable: isRunnable(gate),
      state: gateState(gate, ledger),
    };
    report.gates.push(gr);
    if (!execute || !gr.runnable || gr.state === "abandoned") continue;
    if (opts.mode === "run" && gr.state === "met") continue;

    const cwd = gate.cwd ? resolve(base, gate.cwd) : base;
    out.push(`▶ ${gr.qualified}: ${gate.check}`);
    if (!existsSync(cwd)) {
      gr.ran = false; gr.note = `CWD does not exist: ${cwd}`;
      out.push(`  ✗ ${gr.note}`);
      const failed = await persist(path, gate, { checked: false, evidence: `failed at=${new Date().toISOString()} cwd-missing` });
      gr.state = "unmet"; if (failed) gr.note += `; ${failed}`;
      continue;
    }
    const r = await runCheck(gate.check!, gate.expect!, cwd, opts.timeoutS);
    gr.ran = true; gr.exit = r.exit; gr.matched = r.matched; gr.durationMs = r.durationMs;
    const pass = r.exit === 0 && r.matched && !r.timedOut && !r.overflow && !r.spawnError;
    const secs = (r.durationMs / 1000).toFixed(1);
    if (pass) {
      const evidence = formatEvidence(gate, { exit: r.exit, matched: true, combined: r.combined, cwd: relOrDot(base, cwd), shell });
      const failed = await persist(path, gate, { checked: true, evidence });
      if (failed) { gr.state = "unmet"; gr.note = failed; out.push(`  ✗ ${failed}`); }
      else { gr.state = "met"; out.push(`  ✓ exit 0, EXPECT matched (${secs}s)`); }
    } else {
      const [why, key] = r.spawnError ? [`could not start: ${safeText(r.spawnError, 200)}`, "spawn-error"]
        : r.timedOut ? [`timed out after ${opts.timeoutS}s`, `timeout=${opts.timeoutS}s`]
        : r.overflow ? [`output exceeded ${OUTPUT_CAP} bytes`, "overflow"]
        : [`exit ${r.exit}, EXPECT ${r.matched ? "matched" : "unmatched"}`, `exit=${r.exit} expect=${r.matched ? "matched" : "unmatched"}`];
      gr.note = why;
      out.push(`  ✗ ${why} (${secs}s)`, ...diag(r.combined));
      const failed = await persist(path, gate, { checked: false, evidence: `failed at=${new Date().toISOString()} ${key}` });
      gr.state = "unmet"; if (failed) gr.note += `; ${failed}`;
    }
  }

  // Re-read for the summary so what is reported is what is on disk.
  try { ledger = parseLedger(readLedger(path)); } catch { /* keep the parsed copy */ }
  if (!ledger.errors.length) {
    for (const gr of report.gates) {
      const g = ledger.gates.find((x) => x.id === gr.id);
      if (g) gr.state = gateState(g, ledger);
    }
    report.summary = summarize(ledger);
    for (const [id, reason] of ledger.abandoned) report.handoffs.push({ id, reason });
  } else report.errors = ledger.errors.slice();
  return report;
}

function relOrDot(base: string, cwd: string): string {
  const r = relative(base, cwd).replace(/\\/g, "/");
  return r === "" ? "." : r;
}

/** Write one gate's result, but only if the gate's definition on disk is still the one that
 *  ran — a CHECK edited mid-run must not receive the old command's evidence. Returns a note
 *  when the write was refused. */
async function persist(path: string, ran: Gate, result: { checked: boolean; evidence: string }): Promise<string | null> {
  let text: string;
  try { text = readLedger(path); } catch (e) { return `ledger unreadable at write time: ${(e as Error).message}`; }
  const now = parseLedger(text);
  if (now.errors.length) return "ledger became invalid while the check ran; result discarded";
  const gate = now.gates.find((g) => g.id === ran.id);
  if (!gate) return `gate ${ran.id} vanished while the check ran; result discarded`;
  if (definitionDigest(gate) !== definitionDigest(ran)) return `gate ${ran.id}'s definition changed while the check ran; result discarded — run again`;
  writeAtomic(path, applyResult(text, ran.id, result));
  return null;
}

export async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed instanceof Error) { console.error(`acceptance-check: ${parsed.message}\n\n${USAGE}`); return 2; }
  if (parsed.help) { console.log(USAGE); return 0; }
  const opts = parsed;

  if (opts.mode === "lint") return lintMain(opts);

  const out: string[] = [];
  const reports: LedgerReport[] = [];
  for (const file of opts.files) reports.push(await processLedger(file, opts, out));

  let anyError = false, anyUnmet = false, anyHandoff = false;
  const totals = { met: 0, unmet: 0, stale: 0, abandoned: 0, total: 0 };
  for (const r of reports) {
    out.push(`# ${r.path}`);
    if (r.errors.length) {
      anyError = true;
      for (const e of r.errors) out.push(`  PARSE ERROR: ${e}`);
      continue;
    }
    for (const w of r.warnings) out.push(`  warning: ${w}`);
    for (const g of r.gates) {
      const extra = g.state === "stale" ? "  (evidence does not bind the current definition)" : "";
      out.push(`  ${STATE_LABEL[g.state]} ${g.id}: ${g.title}${g.runnable ? "" : "  [manual]"}${extra}`);
    }
    for (const h of r.handoffs) out.push(`  HANDOFF ${qualify(r.path, h.id)}: ${safeText(h.reason, 300)}`);
    const s = r.summary!;
    for (const k of ["met", "unmet", "stale", "abandoned", "total"] as const) totals[k] += s[k];
    if (s.unmet + s.stale > 0) anyUnmet = true;
    if (s.abandoned > 0) anyHandoff = true;
    out.push(`  ACCEPTANCE ${r.path}: ${s.met} met, ${s.unmet} unmet, ${s.stale} stale, ${s.abandoned} abandoned (of ${s.total}; ${s.runnable} runnable, ${s.manual} manual)`);
  }
  const verdict = anyError ? "INVALID LEDGER" : anyHandoff ? "HANDOFF REQUIRED" : anyUnmet ? "NOT MET" : "ALL MET";
  const code = anyError ? 2 : anyHandoff || anyUnmet ? 1 : 0;
  out.push(verdict + (anyError ? "" : ` — ${totals.met} met, ${totals.unmet} unmet, ${totals.stale} stale, ${totals.abandoned} abandoned of ${totals.total}`));

  if (opts.json) console.log(JSON.stringify({ mode: opts.mode, verdict, exit: code, totals, ledgers: reports }, null, 2));
  else console.log(out.join("\n"));
  return code;
}

function lintMain(opts: Options): number {
  const out: string[] = [];
  let errors = 0, warnings = 0, parseFailures = 0;
  const json: { path: string; findings: ReturnType<typeof lintLedger> }[] = [];
  for (const file of opts.files) {
    let text: string;
    try { text = readLedger(file); }
    catch (e) { out.push(`# ${file}\n  cannot read: ${(e as Error).message}`); parseFailures += 1; continue; }
    const ledger = parseLedger(text);
    const findings = lintLedger(ledger);
    json.push({ path: file, findings });
    out.push(`# ${file}`);
    for (const f of findings) {
      if (f.level === "error") errors += 1; else warnings += 1;
      out.push(`  ${f.level === "error" ? "ERROR  " : "warning"} ${f.gate ? f.gate + ": " : ""}[${f.code}] ${f.message}`);
    }
    if (ledger.errors.length) parseFailures += 1;
  }
  const failed = parseFailures > 0 || errors > 0 || (opts.strict && warnings > 0);
  const marker = parseFailures > 0 ? "LINT PARSE FAILURE" : failed ? "LINT FINDINGS" : `LINT OK (${warnings} warning(s))`;
  out.push(`${marker} — ${errors} error(s), ${warnings} warning(s)`);
  if (opts.json) console.log(JSON.stringify({ mode: "lint", marker, errors, warnings, exit: parseFailures ? 2 : failed ? 1 : 0, ledgers: json }, null, 2));
  else console.log(out.join("\n"));
  return parseFailures ? 2 : failed ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
