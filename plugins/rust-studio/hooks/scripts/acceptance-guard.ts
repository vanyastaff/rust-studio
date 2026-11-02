#!/usr/bin/env bun
// Rust Code Studio — acceptance guard (Stop).
//
// Blocks the turn from ENDING while an acceptance ledger this session is working has gates
// that are not met. Where the phrase-matching stop-guard reads the final message for signs of
// an undisciplined ending, this one reads STATE: `docs/designs/<slug>/acceptance.md`
// and existing `.rust-studio/specs/<slug>/acceptance.md` ledgers,
// parsed through the same strict parser the checker uses. A gate is met only when the checker
// wrote definition-bound evidence for the CHECK/EXPECT that stand in the file now — so an
// edited oracle, a hand-ticked box, or a stale run all count as not met.
//
// It never executes a CHECK: line. Enforcement is the block + the exact command to run.
//
// Fires only when ALL hold:
//   * acceptance_guard userConfig is on (default ON),
//   * a ledger exists under one of the two default design roots,
//   * that ledger is BOUND to this session — its spec directory is named somewhere in this
//     session's transcript (the /dev-task plan write, a checker run, a Read, or a mention of a
//     path inside it). A ledger another session left half-done CAN block this one, and repairing
//     it belongs to its owner: re-running a peer's checker ticks gates for work this session
//     never did. With no transcript to read, nothing binds and the guard stays silent (fails open),
//   * the ledger has an unmet or stale gate, does not parse, or fails the oracle audit the
//     checker ships (`--lint`'s error class: a CHECK that prints a fixed result, an EXPECT that
//     matches empty output). A gate like that is met by construction, so a met box is not
//     evidence and the guard does not treat it as one. Abandoned gates alone do not
//     block: ABANDON is a visible handoff (BLOCKED), and the checker already refuses ALL MET,
//   * the final message CLAIMS COMPLETION — its last verdict token is COMPLETE, or it is a
//     completion summary (files changed / commands run / verification / result) with no
//     verdict. The studio's workflows stop on purpose to hand the turn to the user: the
//     /dev-task planning checkpoint right after the ledger is written, a design fork, a
//     /grill-me question, an honest NEEDS WORK or BLOCKED report. None of those claims the
//     work is done, and none is blocked. The guard reads the message only to tell those
//     apart; the *state* it enforces is the ledger's.
//
// Loop guard, from unlazy's design: the block count is keyed to a hash of the RESOLVED gate
// states, not the file bytes. Re-running the checker and turning a gate green changes the
// hash and rearms the guard; rewording a title, reflowing a line, or the checker rewriting a
// timestamp does not. After MAX_BLOCKS consecutive stops with no state change the guard
// releases — a wedged agent gets its turn back with the outstanding ids named.
//
// HARD RULE (every studio hook): never freeze the session. Watchdog fails OPEN (exit 0).
// `blockStop` selects Claude's exit-2 feedback or Codex's JSON decision. The feedback names the
// ids, checker command, and rule for an impossible gate.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { blockStop, readInput, watchdog, optionBool, pluginRoot, pluginData } from "./_lib.ts";
import { gateState, lintLedger, parseLedger, qualify, sha256, type GateState } from "./acceptance-ledger.ts";
import { getEvidenceGroups, lastAssistantFromTranscript } from "./stop-guard.ts";
import { asText } from "./auto-capture.ts";
import { DESIGN_ROOTS } from "./design-paths.ts";

export const MAX_BLOCKS = 4;
const MAX_LEDGERS = 64;
const MAX_LEDGER_BYTES = 8 * 1024 * 1024;
const TRANSCRIPT_TAIL = 4 * 1024 * 1024;

export interface LedgerStatus {
  /** Path as reported to the agent (repo-relative). */
  path: string;
  slug: string;
  /** Parse errors — an invalid ledger is outstanding until it parses. */
  errors: string[];
  /** id -> resolved state (empty when the ledger did not parse). */
  states: Record<string, GateState>;
  /** Oracle defects of the error class: a gate whose CHECK cannot fail passes whether or not the
   *  work was done, so a met box is not evidence. Warnings are reported by --lint, not here. */
  oracle: string[];
}

/** Does the final message claim the work is done? The last verdict token decides; with no
 *  verdict, a completion summary (>= 2 of the studio's evidence groups) is a claim too. A
 *  question, a plan presented for approval, or an honest NEEDS WORK / BLOCKED is not. */
export function claimsCompletion(text: string): boolean {
  const t = String(text ?? "");
  if (!t.trim()) return false;
  const verdicts = [...t.matchAll(/\b(COMPLETE|NEEDS WORK|BLOCKED|REDO-TO-BAR)\b/g)];
  if (verdicts.length) return verdicts[verdicts.length - 1][1] === "COMPLETE";
  return getEvidenceGroups(t).length >= 2;
}

export interface Decision {
  action: "allow" | "block" | "release";
  /** Hash of the resolved state that the block counter is keyed to. */
  hash: string;
  blocks: number;
  outstanding: string[];
  handoffs: string[];
  /** Oracle defects (error class) across the bound ledgers — blocking, counted, hashed. */
  oracle: string[];
}

/** Ledgers under both default design roots, sharing one bounded discovery budget. */
export function discoverLedgers(cwd: string): { slug: string; abs: string; path: string }[] {
  const out: { slug: string; abs: string; path: string }[] = [];
  let scanned = 0;
  for (const base of DESIGN_ROOTS) {
    const root = join(cwd, base);
    let entries: string[];
    try { entries = readdirSync(root); } catch { continue; }
    for (const slug of entries.sort().slice(0, MAX_LEDGERS - scanned)) {
      scanned++;
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) continue;
      const abs = join(root, slug, "acceptance.md");
      try {
        const rel = relative(realpathSync(cwd), realpathSync(abs));
        if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || !statSync(abs).isFile()) continue;
      } catch { continue; }
      out.push({ slug, abs, path: `${base}/${slug}/acceptance.md` });
    }
  }
  return out;
}

/** Bind an artifact reference to this repository, rather than a matching path suffix.
 * Both separators and JSON-escaped paths are accepted. Slug-only calls retain legacy matching. */
export function isBound(transcriptTail: string, slug: string, cwd = process.cwd()): boolean {
  if (!transcriptTail) return false;
  if (slug.includes("/") || slug.includes("\\")) {
    const dir = slug.replace(/\\/g, "/").replace(/\/acceptance\.md$/, "");
    const normalize = (path: string) => path.replace(/\\+/g, "/").replace(/\/+/g, "/");
    const normalized = normalize(transcriptTail);
    const root = normalize(isAbsolute(cwd) || /^[A-Za-z]:[\\/]/.test(cwd) ? cwd : resolve(cwd)).replace(/\/$/, "");
    // A slash is deliberately not a token boundary: archive/docs/designs and another
    // repository's absolute path must not bind a local artifact by their shared suffix.
    const boundary = "(?:^|[\\s\"'`(<\\[{=])";
    const paths = `(?:\\./)?${escapeRe(dir)}|${escapeRe(`${root}/${dir}`)}`;
    return new RegExp(`${boundary}(?:${paths})(?![A-Za-z0-9._-])`, process.platform === "win32" ? "i" : "").test(normalized);
  }
  // Compatibility for callers testing legacy shorthand; the hook passes a full artifact path.
  const re = new RegExp(`specs(?:\\\\\\\\|\\\\/|/|\\\\)${escapeRe(slug)}(?![A-Za-z0-9._-])`);
  return re.test(transcriptTail);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readStatus(ledger: { slug: string; abs: string; path: string }): LedgerStatus {
  const status: LedgerStatus = { path: ledger.path, slug: ledger.slug, errors: [], states: {}, oracle: [] };
  let text: string;
  try {
    if (statSync(ledger.abs).size > MAX_LEDGER_BYTES) { status.errors.push("ledger larger than 8 MiB"); return status; }
    text = readFileSync(ledger.abs, "utf8");
  } catch (e) {
    status.errors.push(`unreadable: ${(e as Error).message}`);
    return status;
  }
  const doc = parseLedger(text);
  if (doc.errors.length) { status.errors = doc.errors.slice(0, 3); return status; }
  for (const g of doc.gates) status.states[g.id] = gateState(g, doc);
  // The oracle audit is the same one `acceptance-check.ts --lint` runs; the guard reads it for
  // the error class only. A gate whose CHECK prints a fixed result, or whose EXPECT matches empty
  // output, is met by construction — the checker runs it, writes definition-bound evidence, and
  // the tick is still worth nothing. Until this ran on a live ledger the audit only ever saw the
  // shipped template. Warnings stay warnings: they are advice, and the guard blocks on facts.
  for (const f of lintLedger(doc)) {
    if (f.level !== "error" || f.code === "parse") continue;
    status.oracle.push(`${qualify(status.path, f.gate ?? "oracle")} [${f.code}] ${f.message}`);
  }
  return status;
}

/** Pure decision over the bound ledgers, the previous counter, and whether the final message
 *  claims completion — the unit tests' entry. A turn that does not claim completion is allowed
 *  without touching the counter: the outstanding gates are still outstanding, and the next
 *  done-claim meets the same count. A ledger whose gates are all met but whose oracle has an
 *  error is not allowed either: the state says done, the audit says the check cannot tell.
 *  Both enter the hash, so repairing either one rearms the guard. */
export function decide(ledgers: LedgerStatus[], previous: { hash: string; blocks: number } | null, maxBlocks = MAX_BLOCKS, claimsDone = true): Decision {
  const resolved: string[] = [];
  const outstanding: string[] = [];
  const handoffs: string[] = [];
  const oracle: string[] = [];
  const counts = new Map<string, number>();
  for (const l of ledgers) counts.set(l.slug, (counts.get(l.slug) ?? 0) + 1);
  for (const l of ledgers) {
    const qualified = (id: string) => counts.get(l.slug)! > 1 ? `${l.path}:${id}` : qualify(l.path, id);
    if (l.errors.length) {
      resolved.push(`${l.path}:PARSE=invalid`);
      outstanding.push(`${qualified("PARSE")} ${l.errors[0]}`);
      continue;
    }
    for (const [id, state] of Object.entries(l.states)) {
      resolved.push(`${l.path}:${id}=${state}`);
      const q = qualified(id);
      if (state === "abandoned") handoffs.push(q);
      else if (state !== "met") outstanding.push(`${q} (${state})`);
    }
    for (const o of l.oracle) {
      resolved.push(`${l.path}:oracle=${o}`);
      oracle.push(counts.get(l.slug)! > 1 ? `${l.path}: ${o}` : o);
    }
  }
  const hash = sha256(resolved.sort().join("\0")).slice(0, 24);
  if (!outstanding.length && !oracle.length) return { action: "allow", hash, blocks: 0, outstanding, handoffs, oracle };
  if (!claimsDone) return { action: "allow", hash, blocks: previous?.hash === hash ? previous.blocks : 0, outstanding, handoffs, oracle };
  const blocks = previous && previous.hash === hash ? previous.blocks + 1 : 1;
  return { action: blocks > maxBlocks ? "release" : "block", hash, blocks, outstanding, handoffs, oracle };
}

export function buildFeedback(d: Decision, ledgerPaths: string[], checkerPath: string, maxBlocks = MAX_BLOCKS): string {
  const shown = d.outstanding.slice(0, 8);
  const more = d.outstanding.length > shown.length ? `, +${d.outstanding.length - shown.length} more` : "";
  // A ledger whose gates are all met can still be blocked, on the oracle alone. The opening line
  // has to say which of the two it is, or the agent reads "not met" about gates that are met.
  const header = d.outstanding.length
    ? `ACCEPTANCE LEDGER (Rust Code Studio): this turn reports completion while ${d.outstanding.length} gate(s) are not met — ${shown.join(", ")}${more}.`
    : `ACCEPTANCE LEDGER (Rust Code Studio): this turn reports completion, but ${d.oracle.length} gate(s) cannot fail — the ledger's oracle does not hold.`;
  const lines = [
    header,
    "",
    "A gate is met only when the checker ran its CHECK: against the CHECK/EXPECT in the file now",
    "(exit 0 AND EXPECT matched). A ticked box, a stale run, or an edited oracle does not count.",
  ];
  if (d.oracle.length) {
    const oShown = d.oracle.slice(0, 5);
    lines.push(
      "",
      "The oracle audit (the checker's own `--lint`, error class) rejects these gates:",
      ...oShown.map((o) => `  ${o}`),
      ...(d.oracle.length > oShown.length ? [`  +${d.oracle.length - oShown.length} more`] : []),
      "",
      "A CHECK that prints a fixed result, or an EXPECT that matches empty output, passes whether",
      "or not the work was done: the checker runs it, writes evidence, and the evidence is worth",
      "nothing. Repair the gate so it can fail — assert the real result instead of printing one.",
      "Re-running it, or ticking the box, does not clear this.",
    );
  }
  lines.push(
    "",
    "Before stopping: finish the work, then run the ledger and report the measured counts:",
    ...ledgerPaths.map((p) => `  bun "${checkerPath}" --reverify ${p}`),
    "",
    "Do not edit CHECK:/EXPECT: to make a gate pass — that is weakening the oracle. A gate that",
    "is genuinely impossible gets `ABANDON: <id> <reason>` at column 1 and the verdict BLOCKED;",
    "it never becomes COMPLETE. Report met / unmet / abandoned counts, never a bare done.",
  );
  if (d.handoffs.length) lines.push("", `HANDOFF REQUIRED: ${d.handoffs.length} abandoned — ${d.handoffs.slice(0, 5).join(", ")}.`);
  lines.push("", `(block ${d.blocks} of ${maxBlocks} without gate progress; the guard releases after that)`);
  return lines.join("\n");
}

function counterFile(sessionKey: string): string {
  return join(pluginData(), `acceptance-${sessionKey.replace(/[^A-Za-z0-9]/g, "_")}.json`);
}
export function peekCounter(sessionKey: string): { hash: string; blocks: number } | null {
  try {
    const v = JSON.parse(readFileSync(counterFile(sessionKey), "utf8"));
    if (typeof v?.hash === "string" && Number.isInteger(v?.blocks)) return { hash: v.hash, blocks: v.blocks };
  } catch { /* absent or corrupt → no history */ }
  return null;
}
export function writeCounter(sessionKey: string, c: { hash: string; blocks: number } | null): void {
  try {
    if (c) writeFileSync(counterFile(sessionKey), JSON.stringify({ ...c, ts: Date.now() }));
    else writeFileSync(counterFile(sessionKey), JSON.stringify({ hash: "", blocks: 0, ts: Date.now() }));
  } catch { /* non-fatal */ }
}

interface Input {
  cwd?: string;
  session_id?: string;
  transcript_path?: string;
  stop_hook_active?: boolean;
  /** Authoritative final assistant text (Claude Code >= 2.1.47, Codex); transcript fallback. */
  last_assistant_message?: unknown;
}

async function transcriptTail(path: string | undefined): Promise<string> {
  if (!path) return "";
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return "";
    const size = file.size;
    if (size <= TRANSCRIPT_TAIL) return await file.text();
    return await file.slice(size - TRANSCRIPT_TAIL, size).text();
  } catch {
    return "";
  }
}

if (import.meta.main) {
  const disarm = watchdog(10_000);
  if (!optionBool("acceptance_guard", true)) { disarm(); process.exit(0); }

  const input = await readInput<Input>(3_000);
  const cwd = input.cwd || process.cwd();
  const ledgers = discoverLedgers(cwd);
  if (!ledgers.length) { disarm(); process.exit(0); }

  // Binding: only ledgers this session named. No transcript → nothing binds → allow.
  const tail = await transcriptTail(input.transcript_path);
  const bound = ledgers.filter((l) => isBound(tail, l.path, cwd));
  if (!bound.length) { disarm(); process.exit(0); }

  // Only a done-claim is blocked. No readable final message → cannot tell → allow.
  const finalText = asText(input.last_assistant_message) || lastAssistantFromTranscript(tail);
  const claims = claimsCompletion(finalText);

  const sessionKey = String(input.session_id ?? input.transcript_path ?? "");
  const previous = sessionKey ? peekCounter(sessionKey) : null;
  const d = decide(bound.map(readStatus), previous, MAX_BLOCKS, claims);
  disarm();

  if (d.action === "allow") {
    // The counter is cleared only for a ledger that is clean on both counts: a done-claim that is
    // not blocked because oracle defects remain is not a clean state, and clearing it would forget
    // the blocks already spent. The hash still rearms on repair — the defects are in it.
    if (sessionKey && !d.outstanding.length && !d.oracle.length) writeCounter(sessionKey, null);
    if (d.handoffs.length) {
      process.stderr.write(`acceptance: HANDOFF REQUIRED — ${d.handoffs.length} abandoned gate(s): ${d.handoffs.slice(0, 5).join(", ")}. Not blocking; the verdict is BLOCKED, not COMPLETE.\n`);
    }
    process.exit(0);
  }
  if (sessionKey) writeCounter(sessionKey, { hash: d.hash, blocks: d.blocks });
  if (d.action === "release") {
    const counts = [
      d.outstanding.length ? `${d.outstanding.length} unmet/stale gate(s)` : "",
      d.oracle.length ? `${d.oracle.length} oracle defect(s)` : "",
    ].filter(Boolean).join(" and ");
    const named = [...d.outstanding.slice(0, 4), ...d.oracle.slice(0, 2)];
    process.stderr.write(`acceptance: releasing after ${MAX_BLOCKS} blocks without gate progress; ${counts} remain (${named.join(", ")}).\n`);
    process.exit(0);
  }
  const checker = join(pluginRoot(), "skills", "verify-work", "scripts", "acceptance-check.ts").replace(/\\/g, "/");
  blockStop(buildFeedback(d, bound.map((l) => l.path), existsSync(checker) ? checker : "acceptance-check.ts"));
}
