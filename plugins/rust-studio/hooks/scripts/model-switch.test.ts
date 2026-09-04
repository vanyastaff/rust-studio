#!/usr/bin/env bun
// Tests for the PostModelSwitch note. Run with `bun test` from the plugin root.

import { describe, expect, test } from "bun:test";
import { modelLabel, switchNote } from "./model-switch.ts";

describe("modelLabel", () => {
  test("canonical ids become family + version", () => {
    expect(modelLabel("claude-opus-4-8")).toBe("Opus 4.8");
    expect(modelLabel("claude-opus-5")).toBe("Opus 5");
    expect(modelLabel("claude-fable-5-1")).toBe("Fable 5.1");
    expect(modelLabel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });
  test("unknown shapes pass through, empty is marked", () => {
    expect(modelLabel("my-gateway-model")).toBe("my-gateway-model");
    expect(modelLabel(undefined)).toBe("(unknown)");
  });
});

describe("switchNote", () => {
  test("main session: names the moved gates and the way back", () => {
    const n = switchNote({ from_model: "claude-fable-5-1", to_model: "claude-opus-4-8" });
    expect(n).toContain("Fable 5.1 → Opus 4.8");
    expect(n).toContain("rust-reviewer");
    expect(n).toContain("`/model claude-fable-5-1`");
  });
  test("inside a sub-agent: tells the agent to finish and record the model in its evidence", () => {
    const n = switchNote({
      from_model: "claude-opus-5",
      to_model: "claude-opus-4-8",
      agent_id: "abc",
      agent_type: "security-auditor",
    });
    expect(n).toContain("`security-auditor`");
    expect(n).toContain("Opus 5 → Opus 4.8");
    expect(n).toMatch(/state that model/);
    expect(n).not.toContain("/model");
    expect(n).not.toContain("/eval-agents");
  });
  test("main session: eval results are bound to the model that measured them, too", () => {
    const n = switchNote({ from_model: "claude-fable-5-1", to_model: "claude-opus-4-8" });
    expect(n).toContain("/eval-agents");
    expect(n).toContain("`claude plugin eval`");
    expect(n).toContain("early access");
  });
  test("no-op switches say nothing", () => {
    expect(switchNote({ from_model: "claude-opus-5", to_model: "claude-opus-5" })).toBe("");
    expect(switchNote({})).toBe("");
  });
});
