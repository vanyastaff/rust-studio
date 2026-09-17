#!/usr/bin/env bun
// Tests for the parts of the eval runner that decide a score without spending money: the
// stream-json parser, the grader arithmetic, and the ground-truth readers. Run with `bun test`.

import { test, expect, describe, afterAll } from "bun:test";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { auditPrompt, bareName, caseTargets, casesForTargets, coverageReport, installedIdsFor, targetMatches, fixtureMode, gtIds, gradeRegex, gradeToolUsed, mergeTraces, parseFollowUps, parseList, parseStream, pluginName, splitFrontmatter, stagePlugin, FIXTURE_AGENTS } from "./eval-runner.ts";
import { rmSync } from "node:fs";
import { dirname } from "node:path";

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

  test("a multi-turn conversation merges into one trace: sums cost/turns, keeps the last answer", () => {
    const a = parseStream(stream);
    const b = parseStream(line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: {} }] } }) + line({ type: "result", subtype: "success", total_cost_usd: 0.5, num_turns: 2, duration_ms: 800, result: "Verdict: COMPLETE" }));
    const m = mergeTraces(a, b);
    expect(m.costUsd).toBe(1.75);
    expect(m.turns).toBe(9);
    expect(m.toolsUsed).toEqual(["Skill", "Agent", "Read"]);
    expect(m.skills).toEqual(["rust-studio:review"]);
    expect(m.lastMessage).toBe("Verdict: COMPLETE");
  });

  test("follow-ups.md splits on --- separators and drops blanks", () => {
    expect(parseFollowUps("First reply.\n\n---\n\nSecond reply,\ntwo lines.\n---\n")).toEqual(["First reply.", "Second reply,\ntwo lines."]);
    expect(parseFollowUps("")).toEqual([]);
  });
});

describe("graders", () => {
  const trace = parseStream(line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "rust-studio:bloat" } }] } }) + line({ type: "result", result: "Verdict: NEEDS WORK — see above" }));
  const g = (fm: Record<string, string>, body: string) => ({ file: "g.md", type: fm.type, weight: 1, fm, body });

  test("regex flags m/s/u pass through, unknown ones are dropped", () => {
    const multi = parseStream(line({ type: "result", result: "Findings above.\nVerdict: NEEDS WORK" }));
    expect(gradeRegex(g({ type: "regex", flags: "m" }, "^Verdict: (NEEDS WORK|BLOCKED)"), multi).score).toBe(1);
    expect(gradeRegex(g({ type: "regex" }, "^Verdict: (NEEDS WORK|BLOCKED)"), multi).score).toBe(0);
    expect(gradeRegex(g({ type: "regex", flags: "gxi" }, "verdict: needs work"), multi).score).toBe(1);
  });

  test("regex contains / not_contains", () => {
    expect(gradeRegex(g({ type: "regex" }, "\\b(NEEDS WORK|BLOCKED)\\b"), trace).score).toBe(1);
    expect(gradeRegex(g({ type: "regex", match: "not_contains", flags: "i" }, "looks good to merge"), trace).score).toBe(1);
    expect(gradeRegex(g({ type: "regex", match: "not_contains" }, "NEEDS WORK"), trace).score).toBe(0);
  });

  test("tool_used sees the studio path", () => {
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Skill" }, ""), trace).score).toBe(1);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Agent" }, ""), trace).score).toBe(0);
  });

  test("tool_used with name: pins which skill or agent fired, whatever the plugin prefix", () => {
    const t = parseStream(
      line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "rust-studio-eval:bloat" } }] } }) +
        line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "rust-studio:harsh-critic", prompt: "x" } }] } }) +
        line({ type: "result", result: "done" }),
    );
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Skill", name: "bloat" }, ""), t).score).toBe(1);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Skill", name: "/bloat" }, ""), t).score).toBe(1);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Skill", name: "flaky-hunt" }, ""), t).score).toBe(0);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Agent", name: "harsh-critic" }, ""), t).score).toBe(1);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Agent", name: "rust-reviewer" }, ""), t).score).toBe(0);
    expect(gradeToolUsed(g({ type: "tool_used", tool: "Agent", name: "harsh-critic" }, ""), t).detail).toContain("fired");
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
      expect(existsSync(join(root, f, "input.rs")) || existsSync(join(root, f, "src")) || existsSync(join(root, f, "Cargo.toml")), `${f} has neither input.rs, src/ nor Cargo.toml`).toBe(true);
    }
  });

  test("audit prompts are extracted in both shapes and ignore fixtures that state none", () => {
    const inline = auditPrompt('> Audit prompt the fixture is calibrated for: *"Review `x` before merge. End with a verdict."* Clippy is clean.');
    expect(inline).toBe("Review `x` before merge. End with a verdict.");
    const quoted = auditPrompt("Run it with an audit task — this is the prompt the fixture is calibrated for:\n\n> This crate's house rule: every entry point\n> must enforce a size limit.\n\n## The trap");
    expect(quoted).toBe("This crate's house rule: every entry point must enforce a size limit.");
    expect(auditPrompt("# Ground truth — x\n\n| id | line |\n")).toBeNull();
  });

  test("first-pass and map-recall fixtures are recognised from the title line", () => {
    expect(fixtureMode("# Ground truth — naming/self-documenting (verdict: REDO-TO-BAR)\n")).toBe("first-pass");
    expect(fixtureMode("# Ground truth — scout/trait-map (agent: `rust-scout`, mode: map-recall, verdict: COMPLETE)\n")).toBe("map-recall");
    expect(fixtures.filter((f) => fixtureMode(readFileSync(join(root, f, "ground-truth.md"), "utf8")) === "map-recall")).toEqual(["scout/trait-map"]);
    expect(fixtureMode("# Ground truth — api/x (agent: `api-design-lead`, verdict: NEEDS WORK)\n")).toBe("defect-recall");
    const firstPass = fixtures.filter((f) => fixtureMode(readFileSync(join(root, f, "ground-truth.md"), "utf8")) === "first-pass");
    expect(firstPass).toContain("architecture/wrong-crate-helper");
    expect(firstPass).toContain("reviewer/spaghetti-accretion");
  });
});

describe("plugin staging (the tree under test, not the installed copy)", () => {
  // `claude --plugin-dir` loses silently to an installed plugin of the same name, so the runner
  // measures a renamed snapshot. The snapshot must carry the tree, drop the results, and answer
  // to a name no marketplace install can shadow.
  const staged = stagePlugin();
  test("the staged copy has a distinct name and the source tree's skills", () => {
    expect(staged.name).toBe(`${pluginName()}-eval`);
    expect(staged.prefix).toBe(`${staged.name}:`);
    const manifest = JSON.parse(readFileSync(join(staged.dir, ".claude-plugin", "plugin.json"), "utf8"));
    expect(manifest.name).toBe(staged.name);
    expect(existsSync(join(staged.dir, "skills", "review", "SKILL.md"))).toBe(true);
    expect(existsSync(join(staged.dir, "hooks", "scripts", "session-start.ts"))).toBe(true);
  });
  test("eval results and node_modules are not copied", () => {
    expect(existsSync(join(staged.dir, "evals", "results"))).toBe(false);
    expect(existsSync(join(staged.dir, "node_modules"))).toBe(false);
    expect(existsSync(join(staged.dir, "evals", "routing-start", "prompt.md"))).toBe(true);
  });
  test("with inheritModels every staged agent brief runs on the subject model", () => {
    const st = stagePlugin(undefined, { inheritModels: true });
    const models = readdirSync(join(st.dir, "agents")).filter((f) => f.endsWith(".md"))
      .map((f) => /^model:\s*(\S+)/m.exec(readFileSync(join(st.dir, "agents", f), "utf8"))?.[1]);
    expect(models.length).toBeGreaterThan(30);
    expect(new Set(models)).toEqual(new Set(["inherit"]));
    // the source tree keeps its pins
    expect(readFileSync(join(process.cwd(), "agents", "api-design-lead.md"), "utf8")).toMatch(/^model:\s*sonnet/m);
    rmSync(dirname(st.dir), { recursive: true, force: true });
  });
  test("bareName strips the staged prefix and any other plugin prefix", () => {
    expect(bareName(`${staged.prefix}review`, staged.prefix)).toBe("review");
    expect(bareName("rust-studio:rust-reviewer", staged.prefix)).toBe("rust-reviewer");
    expect(bareName("review", staged.prefix)).toBe("review");
  });
  afterAll(() => rmSync(dirname(staged.dir), { recursive: true, force: true }));
});

describe("installed-copy detection", () => {
  const listing = `Installed plugins:\n\n  ❯ exa@claude-plugins-official\n    Version: 3.4.1\n\n  ❯ rust-studio@vanya\n    Version: 0.56.0\n    Status: ✔ enabled\n\n  ❯ rust-studio@other\n`;
  test("finds every install of the plugin under test and nothing else", () => {
    expect(installedIdsFor("rust-studio", listing)).toEqual(["rust-studio@vanya", "rust-studio@other"]);
    expect(installedIdsFor("exa", listing)).toEqual(["exa@claude-plugins-official"]);
    expect(installedIdsFor("nope", listing)).toEqual([]);
  });
});

describe("targets: what a case measures", () => {
  const read = (c: string) => ({
    "repair-loop-closeout": "---\nmax_turns: 24\ntargets: [skill:dev-task]\n---\nprompt",
    "async-cancel-and-block": "---\ntargets: [skill:review, agent:async-systems-lead, rule:async]\n---\nprompt",
    "legacy-no-targets": "---\nmax_turns: 15\n---\nprompt",
  })[c]!;
  const all = ["repair-loop-closeout", "async-cancel-and-block", "legacy-no-targets"];
  test("caseTargets parses the frontmatter list and tolerates its absence", () => {
    expect(caseTargets(read("async-cancel-and-block"))).toEqual(["skill:review", "agent:async-systems-lead", "rule:async"]);
    expect(caseTargets(read("legacy-no-targets"))).toEqual([]);
  });
  test("a bare or slash name matches the skill and agent kinds; a qualified id matches exactly", () => {
    expect(targetMatches("review", ["skill:review"])).toBe(true);
    expect(targetMatches("/review", ["skill:review"])).toBe(true);
    expect(targetMatches("skill:review", ["skill:review"])).toBe(true);
    expect(targetMatches("agent:review", ["skill:review"])).toBe(false);
    expect(targetMatches("async", ["rule:async"])).toBe(true);
  });
  test("--target selects the cases that name it", () => {
    expect(casesForTargets(["dev-task"], all, read)).toEqual(["repair-loop-closeout"]);
    expect(casesForTargets(["async-systems-lead", "dev-task"], all, read)).toEqual(["repair-loop-closeout", "async-cancel-and-block"]);
    expect(casesForTargets(["tdd"], all, read)).toEqual([]);
  });
  test("the coverage report names what has a case and what has none", () => {
    const r = coverageReport(all, read, { skills: ["dev-task", "review", "tdd"], agents: ["async-systems-lead", "rust-builder"], rules: ["async"] });
    expect(r).toContain("skills with a case: 2/3");
    expect(r).toContain("skills with NO case (1): tdd");
    expect(r).toContain("agents with NO case (1): rust-builder");
    expect(r).toContain("rules with a case: 1/1");
  });
});
