#!/usr/bin/env bun
// Tests for the trajectory report over real session transcripts. Run with `bun test`.
//
// A synthetic session and sub-agent transcript in the shapes Claude Code writes: the parser
// has to tell a human prompt from a hook's feedback, a completion notice and a hand-back,
// attribute a skill episode's verdict to the last assistant text before the next human
// prompt, and read an agent's verdict from its SubagentHandback call.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeAgent, analyzeSession, bare, errorKey } from "./trajectory-report.ts";

const line = (o: unknown) => JSON.stringify(o) + "\n";
const asst = (content: unknown[], ts: string) => line({ type: "assistant", timestamp: ts, message: { content } });
const user = (content: unknown, ts: string) => line({ type: "user", timestamp: ts, message: { content } });

describe("session analysis", () => {
  const dir = mkdtempSync(join(tmpdir(), "traj-"));
  const p = join(dir, "s1.jsonl");
  writeFileSync(p,
    user("please review crates/x", "2026-09-15T10:00:00Z") +
    asst([{ type: "tool_use", name: "Skill", input: { skill: "rust-studio:review" } }], "2026-09-15T10:00:01Z") +
    user([{ type: "text", text: "Base directory for this skill: /x/skills/review\n# /review" }], "2026-09-15T10:00:02Z") +
    asst([{ type: "tool_use", name: "Agent", input: { subagent_type: "rust-studio:rust-reviewer", run_in_background: false } }], "2026-09-15T10:00:03Z") +
    user([{ type: "tool_result", is_error: true, content: "Exit code 101\nerror[E0308]: mismatched types" }], "2026-09-15T10:00:04Z") +
    user([{ type: "text", text: "<task-notification>\n<task-id>x</task-id>\n</task-notification>" }], "2026-09-15T10:00:05Z") +
    asst([{ type: "text", text: "That's the reviewer's completion event — already folded in above." }], "2026-09-15T10:00:06Z") +
    user("Stop hook feedback:\n[bun \"/x/hooks/scripts/auto-capture.ts\"]: capture the learning", "2026-09-15T10:00:07Z") +
    asst([{ type: "text", text: "Findings above. Verdict: NEEDS WORK" }], "2026-09-15T10:00:08Z") +
    user("thanks, now fix it", "2026-09-15T10:00:09Z") +
    asst([{ type: "tool_use", name: "Skill", input: { skill: "rust-studio:dev-task" } }], "2026-09-15T10:00:10Z") +
    user("[Request interrupted by user]", "2026-09-15T10:00:11Z") +
    asst([{ type: "text", text: "Stopping here." }], "2026-09-15T10:00:12Z"),
  );
  const s = analyzeSession(p, "demo")!;
  test("counts human prompts, not hook feedback, notices or skill bodies", () => {
    expect(s.prompts).toBe(2);
    expect(s.notifications).toBe(1);
    expect(s.guardBlocks).toEqual({ "auto-capture": 1 });
    expect(s.interruptions).toBe(1);
    expect(s.noticeReplies).toBe(1);
  });
  test("attributes a skill episode's verdict and interruption", () => {
    expect(s.skills.map((e) => [e.name, e.endsWithVerdict, e.interrupted])).toEqual([["review", true, false], ["dev-task", false, true]]);
    expect(s.spawns).toEqual([{ type: "rust-reviewer", background: false }]);
  });
  test("categorizes tool errors by their first line", () => {
    expect(Object.keys(s.errors)).toEqual(["Exit code N"]);
  });
  test("--since drops a session that started before the date", () => {
    expect(analyzeSession(p, "demo", "2026-09-16")).toBeNull();
    expect(analyzeSession(p, "demo", "2026-09-15")).not.toBeNull();
  });
});

describe("agent analysis", () => {
  const dir = mkdtempSync(join(tmpdir(), "traj-agent-"));
  mkdirSync(join(dir, "subagents"));
  const p = join(dir, "subagents", "agent-a1.jsonl");
  writeFileSync(p.replace(/\.jsonl$/, ".meta.json"), JSON.stringify({ agentType: "rust-studio:rust-reviewer", requestShape: "background" }));
  writeFileSync(p,
    asst([{ type: "tool_use", name: "Read", input: { file_path: "/x/a.rs" } }], "2026-09-15T10:00:00Z") +
    asst([{ type: "text", text: "MEMORY: the parser trims twice." }, { type: "tool_use", name: "Edit", input: { file_path: "/x/a.rs" } }], "2026-09-15T10:03:00Z") +
    asst([{ type: "tool_use", name: "SubagentHandback", input: { message: "Two findings.\n\nVerdict: REDO-TO-BAR" } }], "2026-09-15T10:04:00Z"),
  );
  const a = analyzeAgent(p, "s1", "demo")!;
  test("reads type, shape, turns, duration, verdict, writes and MEMORY lines", () => {
    expect(a.type).toBe("rust-reviewer");
    expect(a.shape).toBe("background");
    expect(a.turns).toBe(3);
    expect(a.seconds).toBe(240);
    expect(a.handback).toBe(true);
    expect(a.verdict).toBe("REDO-TO-BAR");
    expect(a.wrote).toBe(true);
    expect(a.memoryLines).toBe(1);
  });
});

describe("helpers", () => {
  test("bare strips any plugin prefix", () => {
    expect(bare("rust-studio:review")).toBe("review");
    expect(bare("rust-studio-eval:harsh-critic")).toBe("harsh-critic");
    expect(bare("Explore")).toBe("Explore");
  });
  test("errorKey blanks paths, ids and numbers and keeps the first line", () => {
    expect(errorKey("File does not exist. Note: your current working directory is /home/u/x\nmore")).toBe("File does not exist. Note: your current working directory is <path>");
    expect(errorKey("Exit code 101")).toBe("Exit code N");
  });
});
