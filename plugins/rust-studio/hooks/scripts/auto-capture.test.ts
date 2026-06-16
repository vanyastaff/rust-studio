// Tests for the auto-capture nudge (Stop). Behavior-asserting and able to fail
// (per docs/integrity-and-evidence.md): each test pins a concrete nudge/allow
// decision or a concrete detection, not merely "it ran".
import { test, expect, describe } from "bun:test";
import {
  shouldNudge,
  capturedSignal,
  lastBlockRaw,
  buildCaptureFeedback,
  type CaptureSignals,
} from "./auto-capture.ts";

const sig = (over: Partial<CaptureSignals> = {}): CaptureSignals => ({
  stopHookActive: false,
  evidenceGroups: 2,
  gitDirty: true,
  captured: false,
  ...over,
});

describe("shouldNudge", () => {
  test("nudges on a completed, dirty, uncaptured turn", () => {
    expect(shouldNudge(sig())).toBe(true);
  });

  test("stop_hook_active suppresses the nudge (loop-breaker)", () => {
    expect(shouldNudge(sig({ stopHookActive: true }))).toBe(false);
  });

  test("an already-captured turn is not re-nudged", () => {
    expect(shouldNudge(sig({ captured: true }))).toBe(false);
  });

  test("a clean tree (nothing to capture from) does not nudge", () => {
    expect(shouldNudge(sig({ gitDirty: false }))).toBe(false);
  });

  test("a turn without a real completion summary (<2 evidence groups) does not nudge", () => {
    expect(shouldNudge(sig({ evidenceGroups: 1 }))).toBe(false);
    expect(shouldNudge(sig({ evidenceGroups: 0 }))).toBe(false);
  });

  test("exactly the minimum evidence threshold nudges", () => {
    expect(shouldNudge(sig({ evidenceGroups: 2 }), 2)).toBe(true);
    expect(shouldNudge(sig({ evidenceGroups: 2 }), 3)).toBe(false);
  });
});

describe("capturedSignal", () => {
  test("detects a /remember Skill tool_use", () => {
    const blk = JSON.stringify({
      role: "assistant",
      message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "remember" } }] },
    });
    expect(capturedSignal(blk)).toBe(true);
  });

  test("detects a /session-wrap Skill tool_use", () => {
    const blk = JSON.stringify({ input: { skill: "session-wrap" } });
    expect(capturedSignal(blk)).toBe(true);
  });

  test("detects an obsidian note write", () => {
    expect(capturedSignal('"name":"note_create"')).toBe(true);
    expect(capturedSignal('"name":"mcp__obsidian__note_write"')).toBe(true);
  });

  test("detects a /remember slash command in assistant text", () => {
    expect(capturedSignal("I will run /remember for the borrow gotcha.")).toBe(true);
  });

  test("a plain completion summary with no capture is not a signal", () => {
    expect(capturedSignal("Files changed: a.rs. Result: COMPLETE. Remembered to run tests.")).toBe(false);
  });
});

describe("lastBlockRaw", () => {
  test("returns lines after the last human prompt; tool_result is not a boundary", () => {
    const raw = [
      JSON.stringify({ role: "user", content: "do the task" }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "working on it" }] } }),
      JSON.stringify({ role: "user", content: [{ type: "tool_result", content: "ok" }] }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "Result: COMPLETE" }] } }),
    ].join("\n");
    const block = lastBlockRaw(raw);
    expect(block).toContain("working on it");
    expect(block).toContain("Result: COMPLETE");
    expect(block).toContain("tool_result"); // tool_result round-trip stays inside the block
    expect(block).not.toContain("do the task"); // the human prompt is the boundary, excluded
  });

  test("an earlier human prompt does not leak into the current block", () => {
    const raw = [
      JSON.stringify({ role: "user", content: "first request" }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "first answer" }] } }),
      JSON.stringify({ role: "user", content: "second request" }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "second answer" }] } }),
    ].join("\n");
    const block = lastBlockRaw(raw);
    expect(block).toContain("second answer");
    expect(block).not.toContain("first answer");
    expect(block).not.toContain("first request");
  });
});

describe("buildCaptureFeedback", () => {
  test("tells the agent to run /remember", () => {
    const fb = buildCaptureFeedback();
    expect(fb).toContain("/remember");
    expect(fb.toLowerCase()).toContain("durable");
  });
});
