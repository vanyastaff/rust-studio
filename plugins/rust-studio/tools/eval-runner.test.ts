#!/usr/bin/env bun
// Tests for the parts of the eval runner that decide a score without spending money: the
// stream-json parser, the grader arithmetic, and the ground-truth readers. Run with `bun test`.

import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { auditPrompt, fixtureMode, gtIds, gradeRegex, gradeToolUsed, parseList, parseStream, splitFrontmatter, FIXTURE_AGENTS } from "./eval-runner.ts";

const line = (o: unknown) => JSON.stringify(o) + "\n";

describe("stream-json parsing", () => {
  const stream =
    line({ type: "system", subtype: "init" }) +
    line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "rust-studio:review" } }] } }) +
    line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "rust-studio:rust-reviewer", prompt: "x" } }] } }) +
    line({ type: "assistant", message: { content: [{ type: "text", text: "interim" }] } }) +
    "not json at all\n" +
    line({ type: "result", subtype: "success", total_cost_usd: 1.25, num_turns: 7, duration_ms: 4200, result: "final: NEEDS WORK" });

  test("collects tool names, skills, agents, cost and the final message", () => {
    const t = parseStream(stream);
    expect(t.toolsUsed).toEqual(["Skill", "Agent"]);
    expect(t.skills).toEqual(["rust-studio:review"]);
    expect(t.agents).toEqual(["rust-studio:rust-reviewer"]);
    expect(t.costUsd).toBe(1.25);
    expect(t.turns).toBe(7);
    expect(t.lastMessage).toBe("final: NEEDS WORK");
  });

  test("falls back to the last assistant text when no result arrives (timeout / kill)", () => {
    const cut = stream.split("\n").filter((l) => !l.includes('"result"')).join("\n");
    expect(parseStream(cut).lastMessage).toBe("interim");
  });
});

describe("graders", () => {
  const trace = parseStream(line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "rust-studio:bloat" } }] } }) + line({ type: "result", result: "Verdict: NEEDS WORK — see above" }));
  const g = (fm: Record<string, string>, body: string) => ({ file: "g.md", type: fm.type, weight: 1, fm, body });

  test("regex contains / not_contains", () => {
    expect(gradeRegex(g({ type: "regex" }, "\\b(NEEDS WORK|BLOCKED)\\b"), trace).score).toBe(1);
    expect(gradeRegex(g({ type: "regex", match: "not_contains", flags: "i" }, "looks good to merge"), trace).score).toBe(1);
    expect(gradeRegex(g({ type: "regex", match: "not_contains" }, "NEEDS WORK"), trace).score).toBe(0);
  });

  test("tool_used sees the studio path", () => {
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Skill" }, ""), trace).score).toBe(1);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Agent" }, ""), trace).score).toBe(0);
  });

  test("frontmatter and list parsing match the eval prompt format", () => {
    const { fm, body } = splitFrontmatter("---\nmax_turns: 15\nallowed_tools: [Read, Glob, Grep, Skill, Agent]\n---\nDo the thing.\n");
    expect(fm.max_turns).toBe("15");
    expect(parseList(fm.allowed_tools)).toEqual(["Read", "Glob", "Grep", "Skill", "Agent"]);
    expect(body.trim()).toBe("Do the thing.");
  });
});

describe("ground-truth readers, against every shipped fixture", () => {
  const root = join(import.meta.dir, "..", "benchmarks", "fixtures");
  const fixtures: string[] = [];
  for (const folder of readdirSync(root)) {
    if (!statSync(join(root, folder)).isDirectory()) continue;
    for (const c of readdirSync(join(root, folder))) if (existsSync(join(root, folder, c, "ground-truth.md"))) fixtures.push(`${folder}/${c}`);
  }

  test("every fixture folder maps to an agent the roster ships", () => {
    const agents = new Set(readdirSync(join(import.meta.dir, "..", "agents")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")));
    for (const f of fixtures) {
      const agent = FIXTURE_AGENTS[f.split("/")[0]];
      expect(agent, `${f} has no agent mapping`).toBeDefined();
      expect(agents.has(agent), `${f} maps to unknown agent ${agent}`).toBe(true);
    }
  });

  test("every ground truth has GT rows and a source to hand the agent", () => {
    for (const f of fixtures) {
      const gt = readFileSync(join(root, f, "ground-truth.md"), "utf8");
      expect(gtIds(gt).length, `${f} has no GT-n rows`).toBeGreaterThan(0);
      expect(existsSync(join(root, f, "input.rs")) || existsSync(join(root, f, "src")), `${f} has neither input.rs nor src/`).toBe(true);
    }
  });

  test("audit prompts are extracted in both shapes and ignore fixtures that state none", () => {
    const inline = auditPrompt('> Audit prompt the fixture is calibrated for: *"Review `x` before merge. End with a verdict."* Clippy is clean.');
    expect(inline).toBe("Review `x` before merge. End with a verdict.");
    const quoted = auditPrompt("Run it with an audit task — this is the prompt the fixture is calibrated for:\n\n> This crate's house rule: every entry point\n> must enforce a size limit.\n\n## The trap");
    expect(quoted).toBe("This crate's house rule: every entry point must enforce a size limit.");
    expect(auditPrompt("# Ground truth — x\n\n| id | line |\n")).toBeNull();
  });

  test("first-pass fixtures are recognised from the title line", () => {
    expect(fixtureMode("# Ground truth — naming/self-documenting (verdict: REDO-TO-BAR)\n")).toBe("first-pass");
    expect(fixtureMode("# Ground truth — api/x (agent: `api-design-lead`, verdict: NEEDS WORK)\n")).toBe("defect-recall");
    const firstPass = fixtures.filter((f) => fixtureMode(readFileSync(join(root, f, "ground-truth.md"), "utf8")) === "first-pass");
    expect(firstPass).toContain("architecture/wrong-crate-helper");
    expect(firstPass).toContain("reviewer/spaghetti-accretion");
  });
});
