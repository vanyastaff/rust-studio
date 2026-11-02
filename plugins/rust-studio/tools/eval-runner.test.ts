#!/usr/bin/env bun
// Tests for the parts of the eval runner that decide a score without spending money: the
// stream-json parser, the grader arithmetic, and the ground-truth readers. Run with `bun test`.

import { test, expect, describe, afterAll } from "bun:test";
import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { auditPrompt, bareName, caseTargets, casesForTargets, coverageReport, installedIdsFor, targetMatches, fixtureMode, gtIds, gradeRegex, gradeToolUsed, mergeTraces, parseFollowUps, parseList, parseStream, pluginName, splitFrontmatter, stagePlugin, runFixture, FIXTURE_AGENTS, FIXTURE_PROFILES, profileInstruction } from "./eval-runner.ts";
import { rmSync } from "node:fs";
import { dirname } from "node:path";
import { cleanEnv } from "./eval-runner.ts";
import { stageLiveHandoff, runLive, checkHandoffBoundary, sessionTrace, type RunTrace } from "./eval-runner.ts";

describe("native handoff lifecycle evidence", () => {
  const config = { root: resolve("fixture-root"), helperRoot: resolve("plugin-root"), reconstruction: "docs/designs/cold-handoff/reconstruction.md", packet: ".rust-studio/reviews/cold-handoff/packet.json" };
  const use = (id: string, name: string, input: unknown) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } }) + "\n";
  const result = (id: string, content: string, is_error = false) => JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content, is_error }] } }) + "\n";
  const reconstruct = use("r", "Write", { file_path: join(config.root, config.reconstruction), content: "contract and evidence" }) + result("r", "written");
  const accept = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "HANDOFF_RECONSTRUCTION_ACCEPTED" }] } }) + "\n";
  const check = use("c", "Bash", { command: `bun "${join(config.helperRoot, "scripts/design-workflow.ts")}" check "${config.root}" ".rust-studio/reviews/cold-handoff/packet.json"` });
  const current = result("c", '{"status":"CURRENT","checked":10,"changed":[],"unavailable":[]}');
  const write = use("w", "Edit", { file_path: join(config.root, "src/lib.rs"), old_string: "old", new_string: "new" }) + result("w", "edited");
  test("accepts observable reconstruction, acceptance, CURRENT, first product write in order", () => {
    expect(checkHandoffBoundary(reconstruct + accept + check + current + write, config).verified).toBe(true);
  });
  for (const [name, raw] of [
    ["dummy reconstruction after code", write + reconstruct + accept + check + current],
    ["acceptance before reconstruction completed", accept + reconstruct + check + current + write],
    ["missing CURRENT result", reconstruct + accept + check + write],
    ["stale packet", reconstruct + accept + check + result("c", '{"status":"STALE","checked":10,"changed":["src/lib.rs"],"unavailable":[]}') + write],
    ["failed check", reconstruct + accept + check + result("c", '{"status":"CURRENT","checked":10,"changed":[],"unavailable":[]}', true) + write],
    ["opaque agent", reconstruct + accept + check + current + use("a", "Agent", { prompt: "implement" }) + write],
    ["unknown shell before boundary", use("s", "Bash", { command: "python write.py" }) + reconstruct + accept + check + current + write],
    ["untrusted helper", reconstruct + accept + use("c", "Bash", { command: `bun "${join(config.root, "design-workflow.ts")}" check "${config.root}" "${config.packet}"` }) + current + write],
    ["missing trace", ""],
    ["no observed product write", reconstruct + accept + check + current],
    ["failed product write", reconstruct + accept + check + current + use("w", "Write", { file_path: join(config.root, "src/lib.rs"), content: "new" }) + result("w", "failed", true)],
    ["late CURRENT after artifact mutation", reconstruct + accept + check + use("m", "Edit", { file_path: join(config.root, "docs/designs/cold-handoff/spec.md") }) + result("m", "edited") + current + write],
    ["check while artifact write pending", reconstruct + accept + use("m", "Edit", { file_path: join(config.root, "docs/designs/cold-handoff/spec.md") }) + check + current + result("m", "edited") + write],
    ["artifact mutation while first product write pending", reconstruct + accept + check + current + use("w", "Edit", { file_path: join(config.root, "src/lib.rs") }) + use("m", "Edit", { file_path: join(config.root, "docs/designs/cold-handoff/spec.md") }) + result("m", "edited") + result("w", "edited")],
    ["artifact mutation after accepted reconstruction", reconstruct + accept + use("m", "Edit", { file_path: join(config.root, "docs/designs/cold-handoff/spec.md") }) + result("m", "edited") + check + current + write],
  ]) test(`rejects ${name}`, () => expect(checkHandoffBoundary(raw, config).verified).toBe(false));
  test("nonzero CLI process exit overrides a success-looking result event", () => {
    const trace = sessionTrace({ stdout: '{"type":"result","subtype":"success","result":"done"}', stderr: "failure", code: 1, timedOut: false });
    expect(trace.isError).toBe(true);
    expect(trace.subtype).toBe("process-exit-1");
  });
});

describe("live cold handoff staging", () => {
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), "handoff-test-"));
    const baseline = join(root, "baseline"), author = join(root, "author"), destination = join(root, "destination");
    mkdirSync(join(baseline, "src"), { recursive: true });
    writeFileSync(join(baseline, "src/lib.rs"), "pub fn baseline() {}\n");
    writeFileSync(join(baseline, "Cargo.toml"), "baseline manifest\n");
    cpSync(baseline, author, { recursive: true });
    mkdirSync(join(author, "docs/designs/cold"), { recursive: true });
    writeFileSync(join(author, "docs/designs/cold/spec.md"), "the design\n");
    return { root, baseline, author, destination };
  }
  function withFixture(fn: (f: ReturnType<typeof fixture>) => void) {
    const f = fixture();
    try { fn(f); } finally { rmSync(f.root, { recursive: true, force: true }); }
  }
  const files = ["docs/designs/cold/spec.md"];
  test("copies the immutable baseline and only exact declared artifacts", () => withFixture(f => {
    writeFileSync(join(f.author, "docs/designs/cold/transcript.jsonl"), "private conversation");
    mkdirSync(join(f.author, "target"));
    writeFileSync(join(f.author, "target/output"), "build output");
    stageLiveHandoff(f.baseline, f.author, f.destination, files);
    expect(readFileSync(join(f.destination, "src/lib.rs"), "utf8")).toBe("pub fn baseline() {}\n");
    expect(readFileSync(join(f.destination, files[0]), "utf8")).toBe("the design\n");
    expect(existsSync(join(f.destination, "docs/designs/cold/transcript.jsonl"))).toBe(false);
    expect(existsSync(join(f.destination, "target"))).toBe(false);
  }));
  for (const path of ["../escape", "/absolute", "C:/escape", "docs/designs/../secret", "docs\\designs\\spec.md", "src/lib.rs", "Cargo.toml", ".claude/transcript.jsonl"]) {
    test(`rejects unsafe/non-artifact input ${path}`, () => withFixture(f => {
      expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, [path])).toThrow();
      expect(existsSync(f.destination)).toBe(false);
    }));
  }
  test("rejects missing artifacts and directories", () => withFixture(f => {
    for (const path of ["docs/designs/missing.md", "docs/designs/cold"]) {
      expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, [path])).toThrow();
    }
  }));
  test("rejects baseline edits, deletion, and untracked additions outside artifact regions", () => {
    for (const path of ["src/lib.rs", "src/new.rs", "Cargo.toml", "AGENTS.md", "docs/hidden.md"]) withFixture(f => {
      mkdirSync(join(f.author, path, ".."), { recursive: true });
      writeFileSync(join(f.author, path), "author product mutation");
      expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, files)).toThrow(/product/);
    });
    withFixture(f => {
      rmSync(join(f.author, "src/lib.rs"));
      expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, files)).toThrow(/product/);
    });
  });
  test("cannot overwrite any baseline file through artifact declaration", () => withFixture(f => {
    mkdirSync(join(f.baseline, "docs/designs/cold"), { recursive: true });
    writeFileSync(join(f.baseline, files[0]), "baseline design");
    expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, files)).toThrow(/baseline/);
  }));
  test("rejects symlink artifact ancestry and symlink product additions", () => withFixture(f => {
    symlinkSync(join(f.author, "docs/designs/cold"), join(f.author, "docs/designs/link"), "junction");
    expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, ["docs/designs/link/spec.md"])).toThrow(/symlink/);
    rmSync(join(f.author, "docs/designs/link"));
    symlinkSync(join(f.author, "src"), join(f.author, "injected"), "junction");
    expect(() => stageLiveHandoff(f.baseline, f.author, f.destination, files)).toThrow(/symlink/);
  }));
  test("rejects destination symlink ancestry and nested roots before copying", () => withFixture(f => {
    const outside = join(f.root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(f.root, "link"), "junction");
    expect(() => stageLiveHandoff(f.baseline, f.author, join(f.root, "link/new"), files)).toThrow(/symlink/);
    expect(readdirSync(outside)).toEqual([]);
    expect(() => stageLiveHandoff(f.baseline, f.author, join(f.author, "new"), files)).toThrow(/separate/);
  }));
});

describe("live cold handoff orchestration (simulated host, not live evidence)", () => {
  async function run(mode: "good" | "author-edit" | "missing-file" | "empty-trace" | "same-session" | "author-error" | "implementation-error" | "budget" | "missing-lifecycle") {
    const out = mkdtempSync(join(tmpdir(), "handoff-result-test-"));
    const fixtureDir = join(import.meta.dir, "../benchmarks/live/cold-handoff");
    const files = parseList(splitFrontmatter(readFileSync(join(fixtureDir, "task.md"), "utf8")).fm.handoff_files);
    const calls: { cwd: string; prompt: string; followUps: string[]; budget: number; shared?: boolean }[] = [];
    let checkRan = false;
    const runtime: NonNullable<Parameters<typeof runLive>[3]> = {
      prefix: () => "test-plugin:",
      helperRoot: () => resolve("plugin-root"),
      process: async (cmd) => {
        if (cmd[0] === "bash") checkRan = true;
        return { stdout: "simulated checker", stderr: "", code: 0, timedOut: false };
      },
      conversation: async (args, followUps, shared) => {
        calls.push({ cwd: args.cwd, prompt: args.prompt, followUps, budget: args.budgetUsd, shared });
        const author = calls.length === 1;
        if (author) {
          for (const path of files) {
            if (mode === "missing-file" && path === files[0]) continue;
            mkdirSync(dirname(join(args.cwd, path)), { recursive: true });
            writeFileSync(join(args.cwd, path), `synthetic test artifact ${path}`);
          }
          writeFileSync(join(args.cwd, "docs/designs/private-transcript.jsonl"), "AUTHOR CONVERSATION MUST NOT CROSS");
          if (mode === "author-edit") writeFileSync(join(args.cwd, "src/lib.rs"), "author implemented ahead of handoff");
        } else {
          expect(args.cwd).not.toBe(calls[0].cwd);
          expect(followUps).toEqual([]);
          expect(existsSync(join(args.cwd, "docs/designs/private-transcript.jsonl"))).toBe(false);
          expect(readFileSync(join(args.cwd, "src/lib.rs"), "utf8")).toBe(readFileSync(join(fixtureDir, "crate/src/lib.rs"), "utf8"));
          expect(args.prompt).not.toContain("Reject equal exclusive endpoints");
          expect(args.prompt).toContain("/test-plugin:implement-change");
        }
        const trace: RunTrace & { raw: string } = {
          sessionId: author || mode === "same-session" ? "author-id" : "implementation-id",
          lastMessage: author ? "design complete" : "Verdict: COMPLETE", toolsUsed: ["Write"], skills: [], agents: [],
          costUsd: author ? mode === "budget" ? 4 : 1.5 : 0.75,
          turns: author ? 4 : 5, durationMs: author ? 100 : 200, isError: false, subtype: "success", stderrTail: "",
          raw: line({ type: "result", subtype: "success", result: "complete" }),
        };
        if (!author && mode !== "missing-lifecycle") {
          const call = (id: string, name: string, input: unknown) => line({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
          const done = (id: string, content: string) => line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } });
          trace.raw = call("r", "Write", { file_path: join(args.cwd, "docs/designs/cold-handoff/reconstruction.md"), content: "synthetic reconstruction" })
            + done("r", "written") + line({ type: "assistant", message: { content: [{ type: "text", text: "HANDOFF_RECONSTRUCTION_ACCEPTED" }] } })
            + call("c", "Bash", { command: `bun "${join(runtime.helperRoot(), "scripts/design-workflow.ts")}" check "${args.cwd}" ".rust-studio/reviews/cold-handoff/packet.json"` })
            + done("c", '{"status":"CURRENT","checked":10,"changed":[],"unavailable":[]}')
            + call("w", "Edit", { file_path: join(args.cwd, "src/lib.rs"), old_string: "a", new_string: "b" }) + done("w", "edited") + trace.raw;
        }
        if ((author && mode === "author-error") || (!author && mode === "implementation-error")) trace.isError = true;
        if (!author && mode === "empty-trace") trace.raw = "";
        return trace;
      },
    };
    try {
      const result = await runLive("cold-handoff", 1, {
        cases: [], targets: [], coverage: false, fixtures: [], allFixtures: false, liveTasks: [], allLive: false,
        parallel: 1, budget: 4, graderModel: "unused", out, dryRun: false, timeoutScale: 1,
      }, runtime);
      expect(existsSync(join(out, "live__cold-handoff.run1.author.stream.jsonl"))).toBe(true);
      return { result, calls, checkRan };
    } finally { rmSync(out, { recursive: true, force: true }); }
  }
  test("separates conversations, stages only declared files, and includes both phases in accounting", async () => {
    const { result, calls, checkRan } = await run("good");
    expect(result.passed).toBe(true);
    expect(checkRan).toBe(true);
    expect(calls.length).toBe(2);
    expect(calls[0].followUps.length).toBe(1);
    expect(calls[0].shared).toBe(true);
    expect(calls[1].budget).toBe(2.5);
    expect(result.trace.costUsd).toBe(2.25);
    expect(result.trace.turns).toBe(9);
    expect(result.trace.durationMs).toBe(300);
    expect(result.trace.lastMessage).toBe("Verdict: COMPLETE");
    expect(result.handoff?.authorTrace.sessionId).toBe("author-id");
    expect(result.handoff?.implementationTrace?.sessionId).toBe("implementation-id");
    expect(result.handoff?.isolation).toBe("native-fresh-conversation");
    expect(result.handoff?.behaviorPassed).toBe(true);
    expect(result.handoff?.lifecycle?.verified).toBe(true);
  });
  test("behavior pass without lifecycle trace remains an overall failure", async () => {
    const { result, checkRan } = await run("missing-lifecycle");
    expect(checkRan).toBe(true);
    expect(result.handoff?.behaviorPassed).toBe(true);
    expect(result.handoff?.lifecycle?.verified).toBe(false);
    expect(result.passed).toBe(false);
  });
  for (const mode of ["author-edit", "missing-file", "author-error", "budget"] as const) {
    test(`${mode} prevents implementation/checker but preserves author spend`, async () => {
      const { result, calls, checkRan } = await run(mode);
      expect(result.passed).toBe(false);
      expect(checkRan).toBe(false);
      expect(calls.length).toBe(1);
      expect(result.trace.costUsd).toBe(mode === "budget" ? 4 : 1.5);
      expect(result.handoff?.isolation).toBe("not-established");
      expect(result.handoff?.implementationTrace).toBeUndefined();
    });
  }
  for (const mode of ["empty-trace", "same-session", "implementation-error"] as const) {
    test(`${mode} cannot pass even if the checker would succeed`, async () => {
      const { result, checkRan } = await run(mode);
      expect(result.passed).toBe(false);
      expect(checkRan).toBe(false);
      expect(result.trace.costUsd).toBe(2.25);
      expect(result.handoff?.isolation).toBe("not-established");
      expect(result.trace.isError).toBe(true);
    });
  }
});

test("explicit subject model uses Claude's boolean force switch without changing parent env", () => {
  const previous = process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE;
  const env = cleanEnv("sonnet");
  expect(env.CLAUDE_CODE_SUBAGENT_MODEL).toBe("sonnet");
  expect(env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE).toBe("1");
  expect(process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE).toBe(previous);
  expect(env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
});

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
    expect(existsSync(join(staged.dir, "skills", "review-work", "SKILL.md"))).toBe(true);
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
    expect(models.length).toBe(5);
    expect(new Set(models)).toEqual(new Set(["inherit"]));
    expect(readFileSync(join(import.meta.dir, "../agents/implementer.md"), "utf8")).toMatch(/^model:\s*sonnet/m);
    expect(readFileSync(join(import.meta.dir, "../agents/researcher.md"), "utf8")).toMatch(/^model:\s*haiku/m);
    for (const role of ["designer", "reviewer", "verifier"]) {
      expect(readFileSync(join(import.meta.dir, `../agents/${role}.md`), "utf8")).toMatch(/^model:\s*inherit/m);
    }
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


test("migrated fixture categories retain read-only lenses and require their profile files", () => {
  for (const [category, role] of Object.entries(FIXTURE_AGENTS)) {
    expect(role).toBe(category === "scout" ? "researcher" : "reviewer");
    expect(FIXTURE_PROFILES[category]).toBeDefined();
  }
  expect(FIXTURE_PROFILES.async).toBe("async");
  expect(FIXTURE_PROFILES.docs).toBe("documentation");
  const root = mkdtempSync(join(tmpdir(), "eval-profile-"));
  cpSync(join(import.meta.dir, "../catalog.json"), join(root, "catalog.json"));
  expect(() => profileInstruction("async", root)).toThrow("required profile is missing");
  mkdirSync(join(root, "docs/profiles"), { recursive: true });
  writeFileSync(join(root, "docs/profiles/async.md"), "Async invariants");
  expect(profileInstruction("async", root)).toContain("The profile grants no additional authority");
});

test("frontmatter and follow-ups preserve Windows checkout prompts", () => {
  expect(splitFrontmatter("---\r\nkind: skill\r\ntarget: design-change\r\nmode: specification\r\n---\r\nDesign only")).toEqual({ fm: { kind: "skill", target: "design-change", mode: "specification" }, body: "Design only" });
  expect(parseFollowUps("first\r\n---\r\nsecond")).toEqual(["first", "second"]);
});


test("live agent dispatch loads its declared profile and fails before model use when missing", async () => {
  const root = mkdtempSync(join(tmpdir(), "live-profile-"));
  const out = mkdtempSync(join(tmpdir(), "live-profile-output-"));
  cpSync(join(import.meta.dir, "../catalog.json"), join(root, "catalog.json"));
  let calls = 0;
  const runtime: NonNullable<Parameters<typeof runLive>[3]> = {
    prefix: () => "test-plugin:", helperRoot: () => root,
    process: async () => ({ stdout: "simulated", stderr: "", code: 0, timedOut: false }),
    conversation: async (args) => {
      calls++;
      expect(args.prompt).toContain("subagent_type `test-plugin:implementer`");
      expect(args.prompt).toContain("implementation.md");
      expect(args.prompt).toContain("The profile grants no additional authority");
      return { raw: "synthetic", lastMessage: "Verdict: COMPLETE", toolsUsed: [], skills: [], agents: [], costUsd: 0, turns: 1, durationMs: 1, isError: false, subtype: "success", stderrTail: "" };
    },
  };
  const options: Parameters<typeof runLive>[2] = { cases: [], targets: [], coverage: false, fixtures: [], allFixtures: false, liveTasks: [], allLive: false, parallel: 1, budget: 1, graderModel: "unused", out, dryRun: false, timeoutScale: 1 };
  try {
    await expect(runLive("builder-interpolation", 1, options, runtime)).rejects.toThrow("required profile is missing");
    expect(calls).toBe(0);
    mkdirSync(join(root, "docs/profiles"), { recursive: true });
    writeFileSync(join(root, "docs/profiles/implementation.md"), "Implementation scope");
    await runLive("builder-interpolation", 1, options, runtime);
    expect(calls).toBe(1);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); }
});


test("consolidated tool graders bind operation/profile evidence to the same raw invocation", () => {
  const call = (name: string, input: unknown) => line({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
  const raw = call("Skill", { skill: "rust-studio:implement-change", args: "--mode size inspect the release binary" })
    + call("Skill", { skill: "rust-studio:review-work", args: "--mode api inspect the exported API" })
    + call("Agent", { subagent_type: "rust-studio:reviewer", prompt: "Read docs/profiles/async.md. Audit cancellation." })
    + call("Agent", { subagent_type: "rust-studio:implementer", prompt: "Use the security profile. Implement the requested fix." });
  const trace = parseStream(raw);
  const grader = (fm: Record<string, string>): Parameters<typeof gradeToolUsed>[0] => ({ file: "scope", type: "tool_used", weight: 1, body: "", fm });
  expect(gradeToolUsed(grader({ tool: "Skill", name: "implement-change", mode: "size" }), trace).score).toBe(1);
  expect(gradeToolUsed(grader({ tool: "Skill", name: "implement-change", mode: "api" }), trace).score).toBe(0);
  expect(gradeToolUsed(grader({ tool: "Skill", name: "implement-change", mode: "intermittent" }), trace).score).toBe(0);
  expect(gradeToolUsed(grader({ tool: "Agent", name: "reviewer", profile: "async" }), trace).score).toBe(1);
  expect(gradeToolUsed(grader({ tool: "Agent", name: "reviewer", profile: "security" }), trace).score).toBe(0);
  expect(trace.skillCalls?.[0]).toEqual({ name: "rust-studio:implement-change", args: "--mode size inspect the release binary" });
  expect(mergeTraces(trace, trace).agentCalls).toHaveLength(4);
  const historical = { ...trace, skillCalls: undefined, agentCalls: undefined };
  expect(gradeToolUsed(grader({ tool: "Skill", name: "implement-change", mode: "size" }), historical).score).toBe(0);
  expect(gradeToolUsed(grader({ tool: "Agent", name: "reviewer", profile: "async" }), historical).score).toBe(0);
});


describe("fixture attribution requires observed role and profile together", () => {
  async function evaluate(kind: "missing-profile" | "wrong-actor" | "valid" | "grader-error") {
    const out = mkdtempSync(join(tmpdir(), "fixture-dispatch-"));
    let graded = false;
    const calls = kind === "wrong-actor"
      ? [{ name: "test:reviewer", prompt: "Review this code" }, { name: "test:implementer", prompt: "Read docs/profiles/async.md" }]
      : [{ name: "test:reviewer", prompt: kind === "missing-profile" ? "Review this code" : "Read docs/profiles/async.md and audit cancellation." }];
    const raw = calls.map(call => line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: call.name, prompt: call.prompt } }] } })).join("")
      + line({ type: "result", subtype: "success", result: "Verdict: COMPLETE" });
    const options: Parameters<typeof runFixture>[2] = { cases: [], targets: [], coverage: false, fixtures: [], allFixtures: false, liveTasks: [], allLive: false, parallel: 1, budget: 1, graderModel: "unused", out, dryRun: false, timeoutScale: 1 };
    try {
      const result = await runFixture("async/cancel-and-block", 1, options, {
        prefix: () => "test:", helperRoot: () => resolve(import.meta.dir, ".."),
        conversation: async () => ({ ...parseStream(raw), raw }),
        grade: async () => { graded = true; return kind === "grader-error" ? { error: "grader unavailable" } : { caught: [], verdict_ok: true }; },
      });
      expect(readFileSync(join(out, "fixture__async__cancel-and-block.run1.stream.jsonl"), "utf8")).toBe(raw);
      return { result, graded };
    } finally { rmSync(out, { recursive: true, force: true }); }
  }
  test.each(["missing-profile", "wrong-actor"] as const)("%s cannot earn a role/profile score", async kind => {
    const { result, graded } = await evaluate(kind);
    expect(graded).toBe(false);
    expect(result).toMatchObject({ agent: "reviewer", profile: "async", spawned: false, recall: null, verdictOk: false });
    expect(result.caught).toEqual([]);
    expect(result.missed.length).toBe(result.gtCount);
  });
  test("valid scoped dispatch reaches grading and retains its profile", async () => {
    const { result, graded } = await evaluate("valid");
    expect(graded).toBe(true);
    expect(result).toMatchObject({ agent: "reviewer", profile: "async", spawned: true, verdictOk: true });
  });
  test("grader failure keeps the profile and does not invent a score", async () => {
    const { result, graded } = await evaluate("grader-error");
    expect(graded).toBe(true);
    expect(result).toMatchObject({ agent: "reviewer", profile: "async", spawned: true, recall: null, verdictOk: null, notes: "grader unavailable" });
  });
});


test("profile grader accepts the runtime's emitted instruction including JSON-escaped Windows paths", () => {
  const prompts = [
    profileInstruction("correctness", resolve(import.meta.dir, "..")),
    `Read the domain profile at ${JSON.stringify("D:\\rust-studio\\docs\\profiles\\correctness.md")} and apply its criteria.`,
  ];
  for (const prompt of prompts) {
    const trace = parseStream(line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "test:reviewer", prompt } }] } }));
    expect(gradeToolUsed({ file: "roundtrip", type: "tool_used", weight: 1, body: "", fm: { tool: "Agent", name: "reviewer", profile: "correctness" } }, trace).score).toBe(1);
  }
});
