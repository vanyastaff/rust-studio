#!/usr/bin/env bun
// Rust Code Studio — auto-capture nudge (Stop).
//
// When a turn finishes a real unit of work but nothing was persisted to project
// memory, nudge the agent ONCE to run /remember for any durable learning. A command
// hook has no MCP access, so it cannot write the obsidian note itself — it blocks the
// stop (exit 2 + stderr) so the agent, which DOES have MCP, continues and captures.
//
// Fires only when ALL hold:
//   * auto_capture userConfig is on (default ON),
//   * this is a Rust project (Cargo.toml at cwd),
//   * the final message carries >= 2 completion-evidence groups — a genuine
//     "I finished a unit" summary (Files changed / Commands run / Verification /
//     Result), reusing the stop-guard evidence detector,
//   * the working tree is dirty (real uncommitted work that may hold a learning),
//   * no /remember or /session-wrap (or obsidian note write) already ran this turn,
//   * stop_hook_active is false — the loop-breaker: after we block once, Claude
//     continues and the next Stop carries stop_hook_active=true, so we never re-block.
//
// Philosophy: nudge once, never trap. If the agent ignores the nudge and stops again,
// stop_hook_active is true and we allow — a missed capture beats a wedged turn.
//
// HARD RULE (every studio hook): never freeze the session. Watchdog fails OPEN
// (exit 0 = allow). Mechanism note: since Claude Code v2.1.163 a Stop hook MAY return
// hookSpecificOutput.additionalContext to hand the model text and continue the turn, but
// we deliberately keep exit 2 + stderr — we want to *block* the stop once (forcing the
// agent to act on the nudge), not merely append context it can ignore.

import { join } from "node:path";
import { readInput, watchdog, optionBool, run, which } from "./_lib.ts";
import { getEvidenceGroups, lastAssistantFromTranscript } from "./stop-guard.ts";

const MIN_EVIDENCE = 2;
const TAIL_BYTES = 200_000;

/** Strong signals that a capture already happened in this work block: a /remember or
 *  /session-wrap invocation, or an obsidian note write (note_create / note_write /
 *  note_patch / note_insert — /remember uses patch/insert to update an existing note).
 *  No leading word boundary on note_* so the MCP-prefixed form (mcp__obsidian__note_write)
 *  still matches. Best-effort — on no match we nudge (safe: the agent simply confirms
 *  there is nothing to add rather than silently dropping a learning). */
const CAPTURE_SIGNAL =
  /("skill"\s*:\s*"(remember|session-wrap)")|(note_(create|write|patch|insert)\b)|((^|[\s>])\/(remember|session-wrap)\b)/i;

export function capturedSignal(blockRaw: string): boolean {
  return CAPTURE_SIGNAL.test(blockRaw);
}

/** Normalize the harness-provided `last_assistant_message` (string | content-block
 *  array | block object) to plain text. Prefer this over re-parsing the transcript:
 *  it is the authoritative final assistant text (Claude Code ≥ 2.1.47). */
export function asText(m: unknown): string {
  if (!m) return "";
  if (typeof m === "string") return m;
  if (Array.isArray(m)) {
    return m
      .map((p: any) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  const o = m as any;
  if (typeof o.text === "string") return o.text;
  if (typeof o.content === "string") return o.content;
  return "";
}

/** Raw transcript lines since the last GENUINE human prompt. tool_result user entries
 *  are internal tool-call round-trips, not turn boundaries (mirrors subagent-stop's
 *  boundary handling), so the scan is scoped to exactly this turn's work block. */
export function lastBlockRaw(raw: string): string {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    let o: any;
    try {
      o = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const msg = o?.message ?? o;
    const role = msg?.role ?? o?.type;
    if (role !== "user") continue;
    const content = msg?.content;
    const isToolResult =
      Array.isArray(content) && content.length > 0 && content[0]?.type === "tool_result";
    if (!isToolResult) {
      start = i + 1; // first entry AFTER the human prompt
      break;
    }
  }
  return lines.slice(start).join("\n");
}

export interface CaptureSignals {
  stopHookActive: boolean;
  evidenceGroups: number;
  gitDirty: boolean;
  captured: boolean;
}

/** Pure decision: should we nudge the agent to capture a learning? */
export function shouldNudge(s: CaptureSignals, minEvidence = MIN_EVIDENCE): boolean {
  if (s.stopHookActive) return false; // already nudged this continuation — loop-breaker
  if (s.captured) return false; // a learning was already persisted this turn
  if (!s.gitDirty) return false; // no uncommitted work that could hold a learning
  return s.evidenceGroups >= minEvidence; // a real completed-unit summary
}

export function buildCaptureFeedback(): string {
  return [
    "CAPTURE CHECK (Rust Code Studio): you finished a unit of work but nothing was",
    "persisted to project memory this turn.",
    "",
    "Before stopping: decide if anything NON-OBVIOUS and DURABLE was learned — a",
    "decision and its rationale, a gotcha that cost time, a convention the codebase",
    "follows, or a non-trivial fix. For each, run /remember now (it writes the note to",
    "the Obsidian vault). Skip anything the code, git history, or Cargo.toml already",
    "makes obvious.",
    "",
    "If there is genuinely nothing durable to capture, say 'nothing to capture' and stop.",
  ].join("\n");
}

interface Input {
  cwd?: string;
  stop_hook_active?: boolean;
  transcript_path?: string;
  /** Authoritative final assistant text (Claude Code ≥ 2.1.47) — preferred over
   *  parsing the transcript tail. */
  last_assistant_message?: unknown;
}

function gitDirty(cwd: string): boolean {
  if (!which("git")) return false; // can't tell → don't nudge (fail quiet)
  const st = run(["git", "-C", cwd, "status", "--porcelain"], { timeout: 5_000 });
  if (!st) return false;
  return st.stdout.trim().length > 0;
}

if (import.meta.main) {
  // Watchdog fails OPEN (exit 0 = allow) so the nudge can never hang the turn.
  const disarm = watchdog(10_000);

  if (!optionBool("auto_capture", true)) {
    disarm();
    process.exit(0);
  }

  const input = await readInput<Input>(3_000);
  const cwd = input.cwd || process.cwd();

  // Rust-project scope: stay silent outside a crate.
  let inRustProject = false;
  try {
    inRustProject = Bun.file(join(cwd, "Cargo.toml")).size > 0;
  } catch {
    inRustProject = false;
  }
  if (!inRustProject) {
    disarm();
    process.exit(0);
  }

  // Loop-breaker: if we already blocked once in this continuation, allow now.
  if (input.stop_hook_active) {
    disarm();
    process.exit(0);
  }

  let raw = "";
  if (typeof input.transcript_path === "string" && input.transcript_path) {
    try {
      const file = Bun.file(input.transcript_path);
      if (await file.exists()) {
        const full = await file.text();
        raw = full.length > TAIL_BYTES ? full.slice(-TAIL_BYTES) : full;
      }
    } catch {
      /* raw stays "" → nothing to judge → allow */
    }
  }

  // Prefer the harness-provided final assistant text (≥ 2.1.47); fall back to the
  // transcript tail. (raw is still read above — capturedSignal needs the work block.)
  const lastText = asText(input.last_assistant_message) || lastAssistantFromTranscript(raw);
  if (!lastText.trim()) {
    disarm();
    process.exit(0); // nothing to judge — allow
  }

  const signals: CaptureSignals = {
    stopHookActive: Boolean(input.stop_hook_active),
    evidenceGroups: getEvidenceGroups(lastText).length,
    gitDirty: gitDirty(cwd),
    captured: capturedSignal(lastBlockRaw(raw)),
  };
  disarm();

  if (shouldNudge(signals)) {
    process.stderr.write(buildCaptureFeedback());
    process.exit(2); // block the stop; stderr becomes feedback to Claude
  }
  process.exit(0);
}
