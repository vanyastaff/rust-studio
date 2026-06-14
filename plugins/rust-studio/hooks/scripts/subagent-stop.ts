#!/usr/bin/env bun
// Rust Code Studio — sub-agent verdict reminder (SubagentStop).
//
// Fires when a studio sub-agent finishes. Studio convention: every agent ends in
// an explicit verdict — COMPLETE / NEEDS WORK / BLOCKED — backed by evidence.
// This hook nudges the orchestrator to confirm that verdict before advancing,
// and to honor a BLOCKED verdict (don't proceed past the blocked dependency).
//
// It deliberately does NOT hard-block (no top-level `decision:block`): a false
// block would wedge orchestration. additionalContext is the safe nudge. Never
// fails the session — on any error it exits 0 silently.

import { readInput, emit, watchdog } from "./_lib.ts";

const disarm = watchdog();

interface Input {
  agent_type?: string;
}

const data = await readInput<Input>();
disarm();

const who = data.agent_type ? `\`${data.agent_type}\`` : "the sub-agent";

emit({
  hookSpecificOutput: {
    hookEventName: "SubagentStop",
    additionalContext:
      `Sub-agent finished (${who}). Before advancing: confirm it returned an ` +
      "explicit studio verdict — **COMPLETE / NEEDS WORK / BLOCKED** — with " +
      "evidence (commands run, files touched). If the verdict is **BLOCKED**, do " +
      "NOT proceed past the blocked dependency; resolve or escalate it first. If " +
      "no verdict was given, treat the result as unverified and ask for one.",
  },
});
