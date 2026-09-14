#!/usr/bin/env bun
// Rust Code Studio — acceptance guard (Stop).
//
// Blocks the turn from ENDING while an acceptance ledger this session is working has gates
// that are not met. Where the phrase-matching stop-guard reads the final message for signs of
// an undisciplined ending, this one reads STATE: `.rust-studio/specs/<slug>/acceptance.md`,
// parsed through the same strict parser the checker uses. A gate is met only when the checker
// wrote definition-bound evidence for the CHECK/EXPECT that stand in the file now — so an
// edited oracle, a hand-ticked box, or a stale run all count as not met.
//
// It never executes a CHECK: line. Enforcement is the block + the exact command to run.
//
// Fires only when ALL hold:
//   * acceptance_guard userConfig is on (default ON),
//   * a ledger exists under <cwd>/.rust-studio/specs/*/acceptance.md,
//   * that ledger is BOUND to this session — its spec directory is named somewhere in this
//     session's transcript (the /spec-tasks write, a checker run, a Read). A ledger another
//     session left half-done never blocks this one; with no transcript to read, nothing binds
//     and the guard stays silent (fails open),
//   * the ledger has an unmet or stale gate, or does not parse. Abandoned gates alone do not
//     block: ABANDON is a visible handoff (BLOCKED), and the checker already refuses ALL MET,
//   * the final message CLAIMS COMPLETION — its last verdict token is COMPLETE, or it is a
//     completion summary (files changed / commands run / verification / result) with no
//     verdict. The studio's workflows stop on purpose to hand the turn to the user: the
//     /spec-tasks approval gate right after the ledger is written, a design fork, a
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
// Blocking uses exit 2 + stderr like the other studio guards; the feedback names the ids,
// the checker command, and the rule for an impossible gate.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readInput, watchdog, optionBool, pluginRoot, pluginData } from "./_lib.ts";
import { gateState, parseLedger, qualify, sha256, type GateState } from "./acceptance-ledger.ts";
import { getEvidenceGroups, lastAssistantFromTranscript } from "./stop-guard.ts";
import { asText } from "./auto-capture.ts";

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
}

/** Ledgers under <cwd>/.rust-studio/specs/<slug>/acceptance.md, bounded. */
export function discoverLedgers(cwd: string): { slug: string; abs: string; path: string }[] {
  const root = join(cwd, ".rust-studio", "specs");
  let entries: string[];
  try { entries = readdirSync(root); } catch { return []; }
  const out: { slug: string; abs: string; path: string }[] = [];
  for (const slug of entries.sort().slice(0, MAX_LEDGERS)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) continue;
    const abs = join(root, slug, "acceptance.md");
    try {
      if (!statSync(abs).isFile()) continue;
    } catch { continue; }
    out.push({ slug, abs, path: `.rust-studio/specs/${slug}/acceptance.md` });
  }
  return out;
}

/** A ledger is bound to this session when its spec directory is named in the transcript.
 *  Both separators are accepted; a JSON-escaped path in the transcript spells "/" as "\/". */
export function isBound(transcriptTail: string, slug: string): boolean {
  if (!transcriptTail) return false;
  const re = new RegExp(`specs(?:\\\\\\\\|\\\\/|/|\\\\)${escapeRe(slug)}(?![A-Za-z0-9._-])`);
  return re.test(transcriptTail);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readStatus(ledger: { slug: string; abs: string; path: string }): LedgerStatus {
  const status: LedgerStatus = { path: ledger.path, slug: ledger.slug, errors: [], states: {} };
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
  return status;
}

/** Pure decision over the bound ledgers, the previous counter, and whether the final message
 *  claims completion — the unit tests' entry. A turn that does not claim completion is allowed
 *  without touching the counter: the outstanding gates are still outstanding, and the next
 *  done-claim meets the same count. */
export function decide(ledgers: LedgerStatus[], previous: { hash: string; blocks: number } | null, maxBlocks = MAX_BLOCKS, claimsDone = true): Decision {
  const resolved: string[] = [];
  const outstanding: string[] = [];
  const handoffs: string[] = [];
  for (const l of ledgers) {
    if (l.errors.length) {
      resolved.push(`${l.slug}:PARSE=invalid`);
      outstanding.push(`${qualify(l.path, "PARSE")} ${l.errors[0]}`);
      continue;
    }
    for (const [id, state] of Object.entries(l.states)) {
      resolved.push(`${l.slug}:${id}=${state}`);
      const q = qualify(l.path, id);
      if (state === "abandoned") handoffs.push(q);
      else if (state !== "met") outstanding.push(`${q} (${state})`);
    }
  }
  const hash = sha256(resolved.sort().join("\0")).slice(0, 24);
  if (!outstanding.length) return { action: "allow", hash, blocks: 0, outstanding, handoffs };
  if (!claimsDone) return { action: "allow", hash, blocks: previous?.hash === hash ? previous.blocks : 0, outstanding, handoffs };
  const blocks = previous && previous.hash === hash ? previous.blocks + 1 : 1;
  return { action: blocks > maxBlocks ? "release" : "block", hash, blocks, outstanding, handoffs };
}

export function buildFeedback(d: Decision, ledgerPaths: string[], checkerPath: string, maxBlocks = MAX_BLOCKS): string {
  const shown = d.outstanding.slice(0, 8);
  const more = d.outstanding.length > shown.length ? `, +${d.outstanding.length - shown.length} more` : "";
  const lines = [
    `ACCEPTANCE LEDGER (Rust Code Studio): this turn reports completion while ${d.outstanding.length} gate(s) are not met — ${shown.join(", ")}${more}.`,
    "",
    "A gate is met only when the checker ran its CHECK: against the CHECK/EXPECT in the file now",
    "(exit 0 AND EXPECT matched). A ticked box, a stale run, or an edited oracle does not count.",
    "",
    "Before stopping: finish the work, then run the ledger and report the measured counts:",
    ...ledgerPaths.map((p) => `  bun "${checkerPath}" --reverify ${p}`),
    "",
    "Do not edit CHECK:/EXPECT: to make a gate pass — that is weakening the oracle. A gate that",
    "is genuinely impossible gets `ABANDON: <id> <reason>` at column 1 and the verdict BLOCKED;",
    "it never becomes COMPLETE. Report met / unmet / abandoned counts, never a bare done.",
  ];
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
  const bound = ledgers.filter((l) => isBound(tail, l.slug));
  if (!bound.length) { disarm(); process.exit(0); }

  // Only a done-claim is blocked. No readable final message → cannot tell → allow.
  const finalText = asText(input.last_assistant_message) || lastAssistantFromTranscript(tail);
  const claims = claimsCompletion(finalText);

  const sessionKey = String(input.session_id ?? input.transcript_path ?? "");
  const previous = sessionKey ? peekCounter(sessionKey) : null;
  const d = decide(bound.map(readStatus), previous, MAX_BLOCKS, claims);
  disarm();

  if (d.action === "allow") {
    if (sessionKey && !d.outstanding.length) writeCounter(sessionKey, null);
    if (d.handoffs.length) {
      process.stderr.write(`acceptance: HANDOFF REQUIRED — ${d.handoffs.length} abandoned gate(s): ${d.handoffs.slice(0, 5).join(", ")}. Not blocking; the verdict is BLOCKED, not COMPLETE.\n`);
    }
    process.exit(0);
  }
  if (sessionKey) writeCounter(sessionKey, { hash: d.hash, blocks: d.blocks });
  if (d.action === "release") {
    process.stderr.write(`acceptance: releasing after ${MAX_BLOCKS} blocks without gate progress; ${d.outstanding.length} item(s) remain (${d.outstanding.slice(0, 4).join(", ")}).\n`);
    process.exit(0);
  }
  const checker = join(pluginRoot(), "skills", "acceptance", "scripts", "acceptance-check.ts").replace(/\\/g, "/");
  process.stderr.write(buildFeedback(d, bound.map((l) => l.path), existsSync(checker) ? checker : "acceptance-check.ts"));
  process.exit(2);
}
