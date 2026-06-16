#!/usr/bin/env bun
// Tests for the SubagentStop verdict detector. Run with: `bun test` (from the
// plugin root) or `bun test hooks/scripts/subagent-stop.test.ts`.
//
// Regression anchor: the live chief-architect agent ended turns with
// `VERDICT: COMPLETE`, a bare leading `COMPLETE`, and `## Verdict\n\n**ARCH-GATE:
// COMPLETE**`, yet the old byte-window detector fired "NO explicit studio verdict
// detected" on every one of 5 consecutive turns. These cases lock that shut.

import { test, expect, describe } from "bun:test";
import {
  hasVerdict,
  assistantTexts,
  verdictPresent,
} from "./subagent-stop.ts";

// --- transcript fixtures ----------------------------------------------------

/** One Claude Code JSONL line for an assistant text message. */
function asstLine(text: string): string {
  return JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });
}
/** One JSONL line for a human prompt (role=user, content is plain text). */
function userLine(text: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
  });
}
/** One JSONL line for a tool_result (role=user, content is tool_result list).
 *  These are internal turn boundaries between tool-call round-trips, NOT human prompts. */
function toolResultLine(content = "ok"): string {
  return JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content }],
    },
  });
}

// --- token-level matching ---------------------------------------------------

describe("hasVerdict — token shapes the detector must accept", () => {
  // The exact strings the architect emitted that used to be missed, plus the
  // other studio verdict forms (label-prefixed, bold, heading, role gate).
  const accept = [
    "VERDICT: COMPLETE",
    "COMPLETE", // first / only token of the message
    "## Verdict\n\n**ARCH-GATE: COMPLETE**", // heading + label + markdown bold
    "**ARCH-GATE: COMPLETE**",
    "ARCH-GATE: COMPLETE",
    "VERDICT: REDO-TO-BAR",
    "**RESHAPE NEEDED**",
    "Result: NEEDS WORK — see notes below",
    "Build is BLOCKED on the failing migration.",
    "API-GATE: MERGE-READY",
    "ACCEPTABLE",
    "NEEDS\nWORK", // line-wrapped two-word verdict
  ];
  for (const s of accept) {
    test(`matches ${JSON.stringify(s)}`, () => {
      expect(hasVerdict(s)).toBe(true);
    });
  }

  const reject = [
    "The work looks done and ready to ship.",
    "I finished the refactor and it builds clean.",
    "Everything compiles; all tests pass.",
    "This is still incomplete", // INCOMPLETE must not satisfy COMPLETE (word boundary)
    "",
  ];
  for (const s of reject) {
    test(`does not match ${JSON.stringify(s)}`, () => {
      expect(hasVerdict(s)).toBe(false);
    });
  }
});

// --- transcript-level detection --------------------------------------------

describe("verdictPresent — over a JSONL transcript", () => {
  test("verdict in the final assistant message is found", () => {
    const raw = [
      userLine("Design the credential cascade."),
      asstLine("Mapping the boundaries..."),
      asstLine("## Verdict\n\n**ARCH-GATE: COMPLETE**\n\nThe boundary holds."),
    ].join("\n");
    expect(verdictPresent(raw)).toBe(true);
  });

  test("REGRESSION: verdict at the TOP of a >60k-char final ADR is found", () => {
    // The precise failure mode: architect opens with the verdict, then writes a
    // long ADR body. The old tail-only scan (last 60k chars) never saw the
    // leading verdict and nagged every turn.
    const body = "x".repeat(120_000);
    const finalMsg = `VERDICT: COMPLETE\n\n## ADR-9999 — Topology\n\n${body}`;
    const raw = [userLine("Write the ADR."), asstLine(finalMsg)].join("\n");
    // Prove the verdict genuinely sits outside the old 60k tail window.
    expect(raw.slice(-60_000).includes("COMPLETE")).toBe(false);
    expect(verdictPresent(raw)).toBe(true);
  });

  test("bare leading COMPLETE as the whole final message is found", () => {
    const raw = [
      userLine("Gate this change."),
      asstLine("COMPLETE\n\nThe architecture is sound; no source touched (ADR only)."),
    ].join("\n");
    expect(verdictPresent(raw)).toBe(true);
  });

  test("genuinely verdict-less sub-agent still fires the nag", () => {
    const raw = [
      userLine("Explore the crate."),
      asstLine("The module lives in src/foo.rs and is large."),
      asstLine("That's the summary — tell me if you want more detail."),
    ].join("\n");
    expect(verdictPresent(raw)).toBe(false);
  });

  test("a stray verdict word far back does not count once newer messages exist", () => {
    // The stale BLOCKED appears before the human prompt that starts the actual task.
    // verdictPresent stops at the human-prompt boundary and only sees text after it.
    const raw = [
      asstLine("Earlier the build was BLOCKED, then I unblocked it."),
      userLine("Now finish the task."),             // human prompt — hard stop
      asstLine("More work..."),
      toolResultLine(),
      asstLine("Another step..."),
      toolResultLine(),
      asstLine("Final summary, with no verdict token at all."),
    ].join("\n");
    expect(verdictPresent(raw)).toBe(false);
  });

  test("REGRESSION: verdict in an earlier text block of the final work block is found", () => {
    // A single agent response produces multiple JSONL text-block entries (one per
    // content block). The verdict may appear in an earlier block (e.g., the summary)
    // while a later block (e.g., a trailing snippet) contains no verdict token.
    // All text since the last human prompt must be checked together.
    const raw = [
      userLine("Implement the fix."),
      asstLine("## Summary\n\nCOMPLETE\n\nFiles changed: subagent-stop.ts"),
      toolResultLine(),                            // internal tool round-trip (pass-through)
      asstLine("Tests: 26/26 pass, 0 fail."),     // no verdict in THIS block
    ].join("\n");
    expect(verdictPresent(raw)).toBe(true);
  });

  test("REGRESSION: verdict is found even when next response is already streaming", () => {
    // SubagentStop fires while the next response is already being streamed into the
    // transcript. The in-progress text has no verdict yet; the verdict lives in the
    // earlier work block. tool_result entries between them are pass-throughs; only
    // a human-prompt entry (userLine) is a hard stop.
    const raw = [
      userLine("Gate this."),
      asstLine("Analysis complete. COMPLETE"),     // has verdict
      toolResultLine(),                            // internal boundary — pass-through
      asstLine("The hook is still firing..."),     // in-progress next response, no verdict yet
    ].join("\n");
    expect(verdictPresent(raw)).toBe(true);
  });

  test("stale verdict before the human prompt that starts the task does not count", () => {
    // A verdict from a prior conversation (before the task-starting human prompt)
    // must not satisfy the check. The human-prompt boundary is the hard cutoff.
    const raw = [
      asstLine("Prior work: COMPLETE"),            // before the human prompt — excluded
      userLine("Now do this new task."),           // human prompt — hard stop
      asstLine("Working on it..."),
      toolResultLine(),
      asstLine("Final summary, no verdict."),
    ].join("\n");
    expect(verdictPresent(raw)).toBe(false);
  });

  test("fallback: non-JSONL transcript is still scanned (no regression)", () => {
    expect(verdictPresent("plain text transcript ... VERDICT: COMPLETE")).toBe(true);
    expect(verdictPresent("plain text transcript, nothing conclusive here")).toBe(false);
  });

  test("empty transcript -> no verdict", () => {
    expect(verdictPresent("")).toBe(false);
  });
});

// --- parser unit ------------------------------------------------------------

describe("assistantTexts — JSONL parsing", () => {
  test("extracts assistant text, ignores user/tool lines and bad JSON", () => {
    const raw = [
      userLine("a question"),
      "not json at all",
      asstLine("first answer"),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "t1" }] } }),
      asstLine("VERDICT: COMPLETE"),
    ].join("\n");
    expect(assistantTexts(raw)).toEqual(["first answer", "VERDICT: COMPLETE"]);
  });

  test("tolerates a raw message shape without the Claude Code wrapper", () => {
    const raw = JSON.stringify({ role: "assistant", content: "VERDICT: COMPLETE" });
    expect(assistantTexts(raw)).toEqual(["VERDICT: COMPLETE"]);
  });
});
