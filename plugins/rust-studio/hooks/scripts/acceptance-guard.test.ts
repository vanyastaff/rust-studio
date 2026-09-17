// Tests for the acceptance guard (Stop). Two directions matter: a guard that lets a
// half-done ledger through enforces nothing, and a guard that blocks a session which never
// touched the ledger — or blocks forever — gets disabled. Both are pinned.
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MAX_BLOCKS, buildFeedback, claimsCompletion, decide, discoverLedgers, isBound, readStatus, type LedgerStatus,
} from "./acceptance-guard.ts";
import { formatEvidence } from "./acceptance-ledger.ts";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "rs-accg-")); });
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function ledgerAt(slug: string, text: string): string {
  const dir = join(tmp, ".rust-studio", "specs", slug);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "acceptance.md");
  writeFileSync(p, text);
  return p;
}

const st = (slug: string, states: Record<string, any>, errors: string[] = [], oracle: string[] = []): LedgerStatus => ({
  path: `.rust-studio/specs/${slug}/acceptance.md`, slug, states, errors, oracle,
});

/** An error-class oracle finding, spelled the way `readStatus` reports it. */
const FIXED = (slug: string, id: string) =>
  `${slug}:${id} [fixed-output] CHECK prints a fixed result; it cannot fail, so it proves nothing`;

describe("decide", () => {
  test("all met → allow, counter cleared", () => {
    const d = decide([st("a", { G1: "met", G2: "met" })], { hash: "old", blocks: 3 });
    expect(d.action).toBe("allow");
    expect(d.blocks).toBe(0);
  });

  test("an unmet or stale gate blocks; abandoned alone does not", () => {
    expect(decide([st("a", { G1: "unmet" })], null).action).toBe("block");
    expect(decide([st("a", { G1: "met", G2: "stale" })], null).action).toBe("block");
    const d = decide([st("a", { G1: "met", G2: "abandoned" })], null);
    expect(d.action).toBe("allow");
    expect(d.handoffs).toEqual(["a:G2"]);
  });

  test("a gate whose CHECK cannot fail blocks even when every gate is met", () => {
    const d = decide([st("a", { G1: "met" }, [], [FIXED("a", "G1")])], null);
    expect(d.action).toBe("block");
    expect(d.outstanding).toEqual([]);
    expect(d.oracle).toEqual([FIXED("a", "G1")]);
  });

  test("an oracle defect enters the hash: repairing the gate rearms the counter", () => {
    const bad = [st("a", { G1: "met" }, [], [FIXED("a", "G1")])];
    const first = decide(bad, null);
    expect(first.blocks).toBe(1);
    const same = decide(bad, { hash: first.hash, blocks: first.blocks });
    expect(same.blocks).toBe(2);
    expect(same.hash).toBe(first.hash);
    // The gate is still met; only the oracle changed. That is progress, so the count resets.
    const repaired = decide([st("a", { G1: "met" })], { hash: same.hash, blocks: same.blocks });
    expect(repaired.action).toBe("allow");
    expect(repaired.blocks).toBe(0);
    expect(repaired.hash).not.toBe(first.hash);
  });

  test("a turn that does not claim completion is allowed with an oracle defect and keeps the count", () => {
    const bad = [st("a", { G1: "met" }, [], [FIXED("a", "G1")])];
    const first = decide(bad, null);
    expect(first.action).toBe("block");
    const question = decide(bad, { hash: first.hash, blocks: 1 }, MAX_BLOCKS, false);
    expect(question.action).toBe("allow");
    expect(question.blocks).toBe(1);
    expect(question.oracle).toEqual([FIXED("a", "G1")]);
  });

  test("a ledger that does not parse is outstanding, not an empty pipeline", () => {
    const d = decide([st("a", {}, ["line 3: gate G1 has no outcome text"])], null);
    expect(d.action).toBe("block");
    expect(d.outstanding[0]).toContain("a:PARSE");
  });

  test("the counter is keyed to resolved state: no progress counts up, progress resets", () => {
    const first = decide([st("a", { G1: "unmet", G2: "unmet" })], null);
    expect(first.blocks).toBe(1);
    const same = decide([st("a", { G1: "unmet", G2: "unmet" })], { hash: first.hash, blocks: first.blocks });
    expect(same.blocks).toBe(2);
    expect(same.hash).toBe(first.hash);
    const progressed = decide([st("a", { G1: "met", G2: "unmet" })], { hash: same.hash, blocks: same.blocks });
    expect(progressed.blocks).toBe(1);
    expect(progressed.hash).not.toBe(first.hash);
  });

  test(`releases after ${MAX_BLOCKS} blocks without progress and names what remains`, () => {
    let prev: { hash: string; blocks: number } | null = null;
    let d = decide([st("a", { G1: "unmet" })], prev);
    for (let i = 1; i <= MAX_BLOCKS; i++) {
      expect(d.action).toBe("block");
      expect(d.blocks).toBe(i);
      prev = { hash: d.hash, blocks: d.blocks };
      d = decide([st("a", { G1: "unmet" })], prev);
    }
    expect(d.action).toBe("release");
    expect(d.outstanding).toEqual(["a:G1 (unmet)"]);
  });

  test("a turn that does not claim completion is allowed and leaves the counter alone", () => {
    const first = decide([st("a", { G1: "unmet" })], null);
    expect(first.action).toBe("block");
    const question = decide([st("a", { G1: "unmet" })], { hash: first.hash, blocks: 1 }, MAX_BLOCKS, false);
    expect(question.action).toBe("allow");
    expect(question.blocks).toBe(1);
    expect(question.outstanding).toEqual(["a:G1 (unmet)"]);
    const claim = decide([st("a", { G1: "unmet" })], { hash: first.hash, blocks: 1 }, MAX_BLOCKS, true);
    expect(claim.action).toBe("block");
    expect(claim.blocks).toBe(2);
  });

  test("qualified ids carry the spec slug", () => {
    const d = decide([st("rate-limiter", { G3: "unmet" })], null);
    expect(d.outstanding).toEqual(["rate-limiter:G3 (unmet)"]);
  });
});

describe("what counts as a completion claim", () => {
  test("the last verdict token decides", () => {
    expect(claimsCompletion("Files changed: a.rs. Commands run: cargo nextest run. Result: COMPLETE")).toBe(true);
    expect(claimsCompletion("G2 is still unmet; the throttling path needs the rollover fix. Verdict: NEEDS WORK")).toBe(false);
    expect(claimsCompletion("The PM decision is missing. BLOCKED")).toBe(false);
    // The studio's own vocabulary line ends in BLOCKED and is not a claim.
    expect(claimsCompletion("Every step ends in COMPLETE / NEEDS WORK / BLOCKED.")).toBe(false);
  });

  test("a completion summary without a verdict is a claim; a question or plan is not", () => {
    expect(claimsCompletion("Files changed: src/limiter.rs — rollover. Verification: 12 passed.")).toBe(true);
    expect(claimsCompletion("Here is the task list for rate-limiter (4 tasks, critical path 1 → 3). Approve to start, or tell me what to change?")).toBe(false);
    expect(claimsCompletion("Which retry-after wording do you want: seconds or an ISO timestamp?")).toBe(false);
    expect(claimsCompletion("")).toBe(false);
  });
});

describe("binding: only ledgers this session named", () => {
  test("plain, JSON-escaped and Windows spellings of the spec path all bind", () => {
    expect(isBound('{"file_path":"/repo/.rust-studio/specs/demo/acceptance.md"}', "demo")).toBe(true);
    expect(isBound('.rust-studio\\/specs\\/demo\\/acceptance.md', "demo")).toBe(true);
    expect(isBound('.rust-studio\\\\specs\\\\demo\\\\acceptance.md', "demo")).toBe(true);
    expect(isBound("run /acceptance on specs/demo please", "demo")).toBe(true);
  });

  test("a different slug, a slug prefix, or no transcript does not bind", () => {
    expect(isBound("specs/other/acceptance.md", "demo")).toBe(false);
    expect(isBound("specs/demo-v2/acceptance.md", "demo")).toBe(false);
    expect(isBound("", "demo")).toBe(false);
  });
});

describe("discovery and status", () => {
  test("finds acceptance.md under each spec, ignores other files and bad slugs", () => {
    ledgerAt("alpha", "- [ ] G1: a\n  EVIDENCE: pending\n");
    ledgerAt("beta", "- [x] G1: b\n  EVIDENCE: reviewed\n");
    mkdirSync(join(tmp, ".rust-studio", "specs", "..weird"), { recursive: true });
    writeFileSync(join(tmp, ".rust-studio", "specs", "alpha", "spec.md"), "# spec");
    const found = discoverLedgers(tmp);
    expect(found.map((l) => l.slug)).toEqual(["alpha", "beta"]);
    expect(found[0].path).toBe(".rust-studio/specs/alpha/acceptance.md");
    expect(readStatus(found[0]).states).toEqual({ G1: "unmet" });
    expect(readStatus(found[1]).states).toEqual({ G1: "met" });
  });

  test("no .rust-studio/ means no ledgers", () => {
    expect(discoverLedgers(tmp)).toEqual([]);
  });

  test("a malformed ledger reports errors and no states", () => {
    const p = ledgerAt("gamma", "- [ ] G1: a\n  CHECK: ls\n  EVIDENCE: pending\n");
    const s = readStatus({ slug: "gamma", abs: p, path: "x" });
    expect(s.errors.length).toBeGreaterThan(0);
    expect(s.states).toEqual({});
  });

  test("the oracle audit reports the error class and leaves the warnings to --lint", () => {
    const p = ledgerAt("delta", [
      "- [ ] G1: prints",
      "  CHECK: echo ok",
      "  EXPECT: ok",
      "  EVIDENCE: pending",
      "",
      "- [ ] G2: the counter advances",
      "  CHECK: cargo run -- status",
      "  EXPECT: /^/",
      "  EVIDENCE: pending",
      "",
      "- [ ] G3: the suite passes",
      "  CHECK: cargo nextest run",
      "  EXPECT: 1 passed",
      "  EVIDENCE: pending",
    ].join("\n") + "\n");
    const s = readStatus({ slug: "delta", abs: p, path: ".rust-studio/specs/delta/acceptance.md" });
    expect(s.errors).toEqual([]);
    // G1: `echo` cannot fail (and its EXPECT is the weak "ok" and sits inside the command —
    // both warnings, neither of which blocks). G2: `/^/` matches empty output. G3 is clean.
    expect(s.oracle.map((o) => /\[([\w-]+)\]/.exec(o)![1])).toEqual(["fixed-output", "trivial-expect"]);
    expect(s.oracle[0]).toContain("delta:G1");
    expect(s.oracle[1]).toContain("delta:G2");
  });
});

describe("feedback", () => {
  test("names the ids, the exact reverify command, the ABANDON rule and the block count", () => {
    const d = decide([st("demo", { G1: "unmet", G2: "stale", G3: "abandoned" })], null);
    const text = buildFeedback(d, [".rust-studio/specs/demo/acceptance.md"], "/plugin/skills/acceptance/scripts/acceptance-check.ts");
    expect(text).toContain("demo:G1 (unmet), demo:G2 (stale)");
    expect(text).toContain('bun "/plugin/skills/acceptance/scripts/acceptance-check.ts" --reverify .rust-studio/specs/demo/acceptance.md');
    expect(text).toContain("ABANDON: <id> <reason>");
    expect(text).toContain("HANDOFF REQUIRED: 1 abandoned — demo:G3");
    expect(text).toContain(`(block 1 of ${MAX_BLOCKS}`);
  });

  test("an oracle-only block names the defect and never says a gate is unmet", () => {
    const d = decide([st("demo", { G1: "met" }, [], [FIXED("demo", "G1")])], null);
    const text = buildFeedback(d, [".rust-studio/specs/demo/acceptance.md"], "/plugin/skills/acceptance/scripts/acceptance-check.ts");
    expect(text).toContain("1 gate(s) cannot fail");
    expect(text).not.toContain("gate(s) are not met");
    expect(text).toContain("[fixed-output]");
    expect(text).toContain("Repair the gate so it can fail");
  });
});

describe("end to end (subprocess, real stdin payload)", () => {
  const hook = join(import.meta.dir, "acceptance-guard.ts");
  const run = (payload: object, env: Record<string, string> = {}) =>
    Bun.spawnSync(["bun", hook], {
      stdin: new TextEncoder().encode(JSON.stringify(payload)),
      env: { ...process.env, CLAUDE_PLUGIN_DATA: join(tmp, "data"), ...env },
      timeout: 15_000,
    });

  const DONE = "Files changed: src/x.rs. Commands run: cargo nextest run. Verification: 3 passed. Result: COMPLETE";

  test("a done-claim on a bound, half-done ledger blocks with exit 2; a stranger session passes; the option turns it off", () => {
    ledgerAt("demo", "- [ ] G1: prints\n  CHECK: true\n  EXPECT: x\n  EVIDENCE: pending\n");
    const transcript = join(tmp, "t.jsonl");
    writeFileSync(transcript, '{"type":"user","message":{"role":"user","content":"edit .rust-studio/specs/demo/acceptance.md"}}\n');
    const blocked = run({ cwd: tmp, session_id: "s1", transcript_path: transcript, last_assistant_message: DONE });
    expect(blocked.exitCode).toBe(2);
    expect(new TextDecoder().decode(blocked.stderr)).toContain("demo:G1 (unmet)");

    const other = join(tmp, "t2.jsonl");
    writeFileSync(other, '{"type":"user","message":{"role":"user","content":"unrelated work"}}\n');
    expect(run({ cwd: tmp, session_id: "s2", transcript_path: other, last_assistant_message: DONE }).exitCode).toBe(0);
    expect(run({ cwd: tmp, session_id: "s3", last_assistant_message: DONE }).exitCode).toBe(0); // no transcript → nothing binds

    const off = run({ cwd: tmp, session_id: "s1", transcript_path: transcript, last_assistant_message: DONE }, { CLAUDE_PLUGIN_OPTION_ACCEPTANCE_GUARD: "false" });
    expect(off.exitCode).toBe(0);
  });

  test("the /spec-tasks approval checkpoint and an honest NEEDS WORK pass; the same ledger blocks a COMPLETE", () => {
    ledgerAt("demo", "- [ ] G1: prints\n  CHECK: true\n  EXPECT: x\n  EVIDENCE: pending\n");
    const transcript = join(tmp, "t.jsonl");
    writeFileSync(transcript, "wrote .rust-studio/specs/demo/acceptance.md\n");
    const approval = run({ cwd: tmp, session_id: "s4", transcript_path: transcript, last_assistant_message: "Task list and ledger written (G1). Approve to start task 1, or tell me what to change?" });
    expect(approval.exitCode).toBe(0);
    const honest = run({ cwd: tmp, session_id: "s4", transcript_path: transcript, last_assistant_message: "G1 is unmet: the marker never prints. Verdict: NEEDS WORK" });
    expect(honest.exitCode).toBe(0);
    const claim = run({ cwd: tmp, session_id: "s4", transcript_path: transcript, last_assistant_message: DONE });
    expect(claim.exitCode).toBe(2);
    expect(new TextDecoder().decode(claim.stderr)).toContain("reports completion while 1 gate(s) are not met");
  });

  test("the final message is read from the transcript when the payload carries none", () => {
    ledgerAt("demo", "- [ ] G1: prints\n  CHECK: true\n  EXPECT: x\n  EVIDENCE: pending\n");
    const transcript = join(tmp, "t.jsonl");
    writeFileSync(transcript, [
      '{"type":"user","message":{"role":"user","content":"work on .rust-studio/specs/demo/acceptance.md"}}',
      `{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":${JSON.stringify(DONE)}}]}}`,
    ].join("\n") + "\n");
    expect(run({ cwd: tmp, session_id: "s5", transcript_path: transcript }).exitCode).toBe(2);
  });

  test("a met ledger whose CHECK cannot fail blocks a COMPLETE, but not an honest report", () => {
    const check = "echo ok";
    const marker = "ok";
    ledgerAt("demo", [
      "- [x] G1: the marker prints",
      `  CHECK: ${check}`,
      `  EXPECT: ${marker}`,
      `  EVIDENCE: ${formatEvidence({ check, expect: marker }, { exit: 0, matched: true, combined: "ok\n", cwd: tmp, shell: "bash" })}`,
    ].join("\n") + "\n");
    const transcript = join(tmp, "t.jsonl");
    writeFileSync(transcript, "specs/demo\n");
    const blocked = run({ cwd: tmp, session_id: "oracle", transcript_path: transcript, last_assistant_message: DONE });
    expect(blocked.exitCode).toBe(2);
    const err = new TextDecoder().decode(blocked.stderr);
    expect(err).toContain("1 gate(s) cannot fail");
    expect(err).toContain("[fixed-output]");
    expect(err).not.toContain("gate(s) are not met");

    const honest = run({ cwd: tmp, session_id: "oracle", transcript_path: transcript, last_assistant_message: "G1's CHECK cannot fail, so the tick proves nothing. Verdict: NEEDS WORK" });
    expect(honest.exitCode).toBe(0);
  });

  test("the loop cap holds across done-claims of one session", () => {
    ledgerAt("demo", "- [ ] G1: prints\n  CHECK: true\n  EXPECT: x\n  EVIDENCE: pending\n");
    const transcript = join(tmp, "t.jsonl");
    writeFileSync(transcript, "specs/demo\n");
    const codes: number[] = [];
    for (let i = 0; i < MAX_BLOCKS + 1; i++) codes.push(run({ cwd: tmp, session_id: "loop", transcript_path: transcript, last_assistant_message: DONE }).exitCode ?? -1);
    expect(codes).toEqual([...Array(MAX_BLOCKS).fill(2), 0]);
  });
});
