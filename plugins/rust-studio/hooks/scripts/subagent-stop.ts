#!/usr/bin/env bun
// Rust Code Studio — sub-agent verdict presence check (SubagentStop).
//
// Fires when a studio sub-agent finishes. Studio convention: every agent ends in
// an explicit verdict — COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED (or the
// pre-code ACCEPTABLE / RESHAPE NEEDED) — backed by evidence. This hook reads the
// sub-agent's transcript tail: if a verdict token is present, it stays silent; if
// none is found, it injects an escalated reminder to treat the result as
// unverified and demand a verdict before advancing.
//
// It deliberately does NOT hard-block (no top-level `decision:block`): a false
// block would wedge a legitimate non-studio / built-in sub-agent (Explore, Plan,
// general-purpose) that never speaks in studio verdicts. additionalContext is the
// safe escalation. Never fails the session — on any error it exits 0 silently.

import { readFileSync } from "node:fs";
import { readInput, emit, done, watchdog } from "./_lib.ts";

const disarm = watchdog();

interface Input {
  agent_type?: string;
  transcript_path?: string;
}

const VERDICT =
  /\b(COMPLETE|NEEDS WORK|REDO-TO-BAR|BLOCKED|ACCEPTABLE|RESHAPE NEEDED|MERGE-READY)\b/;

const data = await readInput<Input>();
disarm();

const who = data.agent_type ? `\`${data.agent_type}\`` : "the sub-agent";

// Read the transcript tail and look for an explicit verdict token. If we find one
// we assume the agent closed properly and stay quiet (no nagging). If we can read
// the transcript and there is clearly NO verdict, escalate. If we cannot read it,
// fall back to the plain reminder.
let verdictSeen = false;
let couldRead = false;
try {
  if (data.transcript_path) {
    const raw = readFileSync(data.transcript_path, "utf8");
    couldRead = true;
    const tail = raw.length > 60_000 ? raw.slice(-60_000) : raw;
    verdictSeen = VERDICT.test(tail);
  }
} catch {
  /* couldRead stays false -> plain reminder */
}

if (verdictSeen) done(); // proper verdict present — nothing to nag about

const lead = couldRead
  ? `⚠️ Sub-agent finished (${who}) with NO explicit studio verdict detected in its output. `
  : `Sub-agent finished (${who}). `;

emit({
  hookSpecificOutput: {
    hookEventName: "SubagentStop",
    additionalContext:
      lead +
      "Treat the result as UNVERIFIED until it carries an explicit verdict — " +
      "**COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED** (or a pre-code " +
      "**ACCEPTABLE / RESHAPE NEEDED**) — with evidence (commands run, files " +
      "touched). A `REDO-TO-BAR` means the work compiles but the shape must be " +
      "reshaped to the maintainer bar before it is accepted; a `BLOCKED` verdict " +
      "halts its dependents until the blocker clears. If no verdict was given, ask " +
      "for one rather than advancing on an unverified result.",
  },
});
