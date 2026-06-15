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
/** One JSONL line for a user / tool message (never carries the verdict). */
function userLine(text: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
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
    const raw = [
      asstLine("Earlier the build was BLOCKED, then I unblocked it."),
      asstLine("More work..."),
      asstLine("Another step..."),
      asstLine("Final summary, with no verdict token at all."),
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
