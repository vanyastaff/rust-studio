// Regression tests for the shared helpers + cross-script contracts fixed in the
// hooks audit. Each test pins a bug that shipped:
//   1. run() mapped a timeout-killed child to exitCode 1 ("check failed") instead
//      of null ("couldn't check") — fmt-check then nagged on every slow workspace.
//   2. pathMatches ^-anchored relative dir globs (src/**/*.rs) so they could never
//      match an absolute tool path.
//   3. The SubagentStop VERDICT regex rejected harsh-critic's prescribed verdict
//      vocabulary, so the hook nagged that agent on every run.

import { describe, expect, test } from "bun:test";
import { run } from "./_lib.ts";
import { pathMatches } from "./inject-rules.ts";
import { hasVerdict } from "./subagent-stop.ts";

describe("run() timeout mapping", () => {
  test("a timed-out child returns null, not a failure exit code", () => {
    // 2s sleep vs 300ms budget → killed by timeout → must be null ("couldn't check").
    const r = run(["sleep", "2"], { timeout: 300 });
    expect(r).toBeNull();
  });

  test("a real non-zero exit is still reported", () => {
    const r = run(["false"]);
    expect(r).not.toBeNull();
    expect(r!.exitCode).not.toBe(0);
  });

  test("a clean exit reports 0 and stdout", () => {
    const r = run(["echo", "ok"]);
    expect(r).not.toBeNull();
    expect(r!.exitCode).toBe(0);
    expect(r!.stdout.trim()).toBe("ok");
  });
});

describe("pathMatches relative globs", () => {
  const abs = "/home/user/proj/src/net/client.rs";

  test("relative dir glob matches an absolute path", () => {
    expect(pathMatches("src/**/*.rs", abs)).toBe(true);
  });

  test("bare filename glob matches anywhere", () => {
    expect(pathMatches("Cargo.toml", "/home/user/proj/crates/a/Cargo.toml")).toBe(true);
  });

  test("**-anchored glob still matches", () => {
    expect(pathMatches("**/*.rs", abs)).toBe(true);
  });

  test("non-matching glob stays false", () => {
    expect(pathMatches("benches/**", abs)).toBe(false);
  });
});

describe("VERDICT vocabulary", () => {
  test("harsh-critic verdicts are recognized", () => {
    expect(hasVerdict("**VERDICT: SURVIVES** — but barely.")).toBe(true);
    expect(hasVerdict("VERDICT: DOESN'T SURVIVE AS WRITTEN — two blockers.")).toBe(true);
    expect(hasVerdict("VERDICT: INSUFFICIENT INFO — need the spec.")).toBe(true);
  });

  test("standard studio verdicts still match", () => {
    expect(hasVerdict("**COMPLETE**")).toBe(true);
    expect(hasVerdict("REDO-TO-BAR")).toBe(true);
    expect(hasVerdict("no verdict here")).toBe(false);
  });
});
