// Tests for the acceptance-ledger parser, state model, evidence binding and lint.
// Behavior-asserting and able to fail (docs/integrity-and-evidence.md): each test pins a
// concrete parse result, state, or finding — never merely "it ran".
import { test, expect, describe } from "bun:test";
import {
  applyResult, compileExpect, definitionDigest, formatEvidence, gateState, lintLedger,
  matchExpect, parseEvidence, parseLedger, qualify, safeText, summarize,
} from "./acceptance-ledger.ts";

const LEDGER = `# Acceptance: rate limiter

Spec: spec.md

- [ ] G1: the third request in a window is throttled
  CHECK: cargo nextest run -p limiter -E 'test(third_request_is_throttled)'
  EXPECT: /1 tests? run: 1 passed/
  EVIDENCE: pending

- [ ] G2: the crate is clippy-clean under the project gate
  CHECK: cargo clippy --all-targets -- -D warnings
  EXPECT: Finished
  CWD: crates/limiter
  EVIDENCE: pending

- [ ] G3: the retry-after wording matches the product decision
  EVIDENCE: pending
`;

describe("parse: strict structure", () => {
  test("a valid ledger yields three gates with the right shapes", () => {
    const l = parseLedger(LEDGER);
    expect(l.errors).toEqual([]);
    expect(l.title).toBe("Acceptance: rate limiter");
    expect(l.gates.map((g) => g.id)).toEqual(["G1", "G2", "G3"]);
    expect(l.gates[0].check).toContain("cargo nextest");
    expect(l.gates[1].cwd).toBe("crates/limiter");
    expect(l.gates[2].check).toBeUndefined();
    expect(l.eol).toBe("\n");
  });

  test("an empty ledger is an error, not ALL MET", () => {
    const l = parseLedger("# Acceptance: nothing\n\nSpec: spec.md\n");
    expect(l.errors.some((e) => /no gates/.test(e))).toBe(true);
  });

  test("a duplicate id is an error", () => {
    const l = parseLedger("- [ ] G1: a\n  EVIDENCE: pending\n- [ ] G1: b\n  EVIDENCE: pending\n");
    expect(l.errors.some((e) => /duplicate gate id G1/.test(e))).toBe(true);
  });

  test("a gate with CHECK but no EXPECT is malformed", () => {
    const l = parseLedger("- [ ] G1: a\n  CHECK: cargo test\n  EVIDENCE: pending\n");
    expect(l.errors.some((e) => /both CHECK: and EXPECT:/.test(e))).toBe(true);
  });

  test("an unindented CHECK: is diagnosed instead of silently making the gate manual", () => {
    const l = parseLedger("- [ ] G1: a\nCHECK: cargo test\nEXPECT: ok\n  EVIDENCE: pending\n");
    expect(l.errors.some((e) => /must be indented/.test(e))).toBe(true);
    expect(l.gates[0].check).toBeUndefined();
  });

  test("an attribute after prose is orphaned, not attached to the previous gate", () => {
    const l = parseLedger("- [ ] G1: a\n  EVIDENCE: pending\n\nSome prose here.\n  CHECK: echo hi\n  EXPECT: hi\n");
    expect(l.errors.some((e) => /not attached to a gate/.test(e))).toBe(true);
  });

  test("an invalid regular expression in EXPECT is a parse error", () => {
    const l = parseLedger("- [ ] G1: a\n  CHECK: cargo test\n  EXPECT: /[unclosed/\n  EVIDENCE: pending\n");
    expect(l.errors.some((e) => /EXPECT: is not a valid regular expression/.test(e))).toBe(true);
  });

  test("an absolute or traversing CWD is rejected", () => {
    const abs = parseLedger("- [ ] G1: a\n  CHECK: ls\n  EXPECT: x\n  CWD: /etc\n  EVIDENCE: pending\n");
    const up = parseLedger("- [ ] G1: a\n  CHECK: ls\n  EXPECT: x\n  CWD: ../other\n  EVIDENCE: pending\n");
    expect(abs.errors.some((e) => /repository-relative/.test(e))).toBe(true);
    expect(up.errors.some((e) => /repository-relative/.test(e))).toBe(true);
  });

  test("gates inside fenced code and HTML comments are documentation", () => {
    const text = [
      "- [ ] G1: real", "  EVIDENCE: pending", "",
      "```markdown", "- [ ] G9: example", "  CHECK: echo hi", "  EXPECT: hi", "```", "",
      "~~~", "- [ ] G8: example", "~~~", "",
      "<!--", "- [ ] G7: in a comment", "  CHECK: rm -rf /", "  EXPECT: gone", "-->", "",
    ].join("\n");
    const l = parseLedger(text);
    expect(l.errors).toEqual([]);
    expect(l.gates.map((g) => g.id)).toEqual(["G1"]);
  });

  test("a shorter nested fence does not close a longer opener", () => {
    const text = "````\n```\n- [ ] G9: still inside\n```\n````\n- [ ] G1: real\n  EVIDENCE: pending\n";
    const l = parseLedger(text);
    expect(l.gates.map((g) => g.id)).toEqual(["G1"]);
  });

  test("CRLF is detected and preserved by applyResult", () => {
    const crlf = "- [ ] G1: a\r\n  CHECK: echo\r\n  EXPECT: x\r\n  EVIDENCE: pending\r\n";
    const l = parseLedger(crlf);
    expect(l.eol).toBe("\r\n");
    const out = applyResult(crlf, "G1", { checked: true, evidence: "manual: reviewed" });
    expect(out.split("\r\n").length).toBe(crlf.split("\r\n").length);
    expect(out.startsWith("- [x] G1: a\r\n")).toBe(true);
  });
});

describe("ABANDON: terminal handoff", () => {
  test("a valid abandonment resolves to the abandoned state", () => {
    const l = parseLedger(LEDGER + "\nABANDON: G3 product owner unavailable; tracked in #12\n");
    expect(l.errors).toEqual([]);
    expect(l.abandoned.get("G3")).toBe("product owner unavailable; tracked in #12");
    expect(gateState(l.gates[2], l)).toBe("abandoned");
    expect(summarize(l).abandoned).toBe(1);
  });

  test("an unknown id is an error — a typo must not let a gate pass unseen", () => {
    const l = parseLedger(LEDGER + "\nABANDON: G9 whatever\n");
    expect(l.errors.some((e) => /unknown gate G9/.test(e))).toBe(true);
  });

  test("a blank reason is an error", () => {
    const l = parseLedger(LEDGER + "\nABANDON: G3   \n");
    expect(l.errors.some((e) => /has no reason/.test(e))).toBe(true);
  });

  test("an indented ABANDON: is diagnosed, not ignored", () => {
    const l = parseLedger(LEDGER + "\n  ABANDON: G3 reason\n");
    expect(l.errors.some((e) => /column 1/.test(e))).toBe(true);
    expect(l.abandoned.size).toBe(0);
  });
});

describe("state: met requires bound evidence", () => {
  const gate = () => parseLedger(LEDGER).gates[0];

  test("an unchecked gate is unmet", () => {
    expect(gateState(gate(), { abandoned: new Map() })).toBe("unmet");
  });

  test("a hand-ticked runnable gate with prose evidence is stale", () => {
    const g = gate(); g.checked = true; g.evidence = "ran it, looked fine";
    expect(gateState(g, { abandoned: new Map() })).toBe("stale");
  });

  test("checker evidence for the current definition is met", () => {
    const g = gate();
    g.evidence = formatEvidence(g, { exit: 0, matched: true, combined: "1 test run: 1 passed", cwd: ".", shell: "sh" });
    g.checked = true;
    expect(gateState(g, { abandoned: new Map() })).toBe("met");
    const ev = parseEvidence(g.evidence)!;
    expect(ev.def).toBe(definitionDigest(g));
    expect(ev.exit).toBe(0);
    expect(ev.bytes).toBe(20);
  });

  test("editing CHECK after the run makes the evidence stale", () => {
    const g = gate();
    g.evidence = formatEvidence(g, { exit: 0, matched: true, combined: "x", cwd: ".", shell: "sh" });
    g.checked = true;
    g.check = "cargo nextest run -p limiter";
    expect(gateState(g, { abandoned: new Map() })).toBe("stale");
  });

  test("editing EXPECT or CWD also invalidates the digest", () => {
    const g = gate();
    const before = definitionDigest(g);
    expect(definitionDigest({ ...g, expect: "/2 passed/" })).not.toBe(before);
    expect(definitionDigest({ ...g, cwd: "crates/x" })).not.toBe(before);
  });

  test("a forged nonzero exit in evidence never counts as met", () => {
    const g = gate();
    g.evidence = formatEvidence(g, { exit: 1, matched: true, combined: "x", cwd: ".", shell: "sh" });
    g.checked = true;
    expect(gateState(g, { abandoned: new Map() })).toBe("stale");
  });

  test("a manual gate needs human evidence; 'pending' and machine evidence do not attest", () => {
    const manual = parseLedger(LEDGER).gates[2];
    manual.checked = true;
    manual.evidence = "pending";
    expect(gateState(manual, { abandoned: new Map() })).toBe("stale");
    manual.evidence = formatEvidence(manual, { exit: 0, matched: true, combined: "", cwd: ".", shell: "sh" });
    expect(gateState(manual, { abandoned: new Map() })).toBe("stale");
    manual.evidence = "reviewed with the PM on 2026-09-14: wording matches ADR-0007";
    expect(gateState(manual, { abandoned: new Map() })).toBe("met");
  });

  test("a checker-written failure line on a manual gate is not an attestation either", () => {
    // The weaken-the-oracle path: CHECK failed, so CHECK/EXPECT were deleted and the box ticked.
    const text = "- [x] G1: it works\n  EVIDENCE: failed at=2026-09-14T10:00:00Z exit=1 expect=unmatched\n";
    const l = parseLedger(text);
    expect(gateState(l.gates[0], l)).toBe("stale");
    expect(summarize(l).met).toBe(0);
  });
});

describe("EXPECT matching", () => {
  test("plain text is a substring; slashes make a regular expression", () => {
    expect(matchExpect("1 passed", "test result: ok. 1 passed; 0 failed")).toBe(true);
    expect(matchExpect("2 passed", "test result: ok. 1 passed; 0 failed")).toBe(false);
    expect(matchExpect("/[1-9]\\d* passed/", "0 passed")).toBe(false);
    expect(matchExpect("/[1-9]\\d* passed/", "12 passed")).toBe(true);
    expect(matchExpect("/OK/i", "everything ok")).toBe(true);
  });

  test("invalid flags and over-long expectations are errors", () => {
    expect(compileExpect("/x/q")).toBeInstanceOf(Error);
    expect(compileExpect("/x/ii")).toBeInstanceOf(Error);
    expect(compileExpect("a".repeat(600))).toBeInstanceOf(Error);
  });

  test("a slash-wrapped path with an inner slash is warned, since it is read as a pattern", () => {
    const l = parseLedger("- [ ] G1: a\n  CHECK: ls\n  EXPECT: /etc/app/conf/\n  EVIDENCE: pending\n");
    expect(l.errors).toEqual([]);
    expect(l.warnings.some((w) => /unescaped inner slash/.test(w))).toBe(true);
  });
});

describe("applyResult", () => {
  test("flips the box and rewrites the evidence line in place", () => {
    const out = applyResult(LEDGER, "G2", { checked: true, evidence: "rs-acceptance/v1 def=0000000000000000 exit=0 expect=matched out=0000000000000000:0" });
    const l = parseLedger(out);
    expect(l.gates[1].checked).toBe(true);
    expect(l.gates[1].evidence).toContain("rs-acceptance/v1");
    expect(l.gates[0].checked).toBe(false); // neighbours untouched
    expect(out.split("\n").length).toBe(LEDGER.split("\n").length);
  });

  test("inserts a missing EVIDENCE line beneath the gate's last attribute", () => {
    const text = "- [ ] G1: a\n  CHECK: echo\n  EXPECT: x\n\n- [ ] G2: b\n  EVIDENCE: pending\n";
    const out = applyResult(text, "G1", { checked: false, evidence: "failed at=now exit=1 expect=unmatched" });
    expect(out.split("\n")[3]).toBe("  EVIDENCE: failed at=now exit=1 expect=unmatched");
    expect(parseLedger(out).errors).toEqual([]);
  });
});

describe("lint: oracles that cannot fail", () => {
  const codes = (text: string) => lintLedger(parseLedger(text)).map((f) => `${f.level}:${f.code}`);

  test("echo / printf / true / inline eval are errors", () => {
    for (const cmd of ["echo verification passed", "printf ok", "true", "node -e \"console.log('ok')\"", "bun -e 'console.log(1)'"]) {
      expect(codes(`- [ ] G1: invoices reconcile\n  CHECK: ${cmd}\n  EXPECT: verification passed\n  EVIDENCE: pending\n`)).toContain("error:fixed-output");
    }
  });

  test("an expectation that matches empty output is an error", () => {
    expect(codes("- [ ] G1: it works\n  CHECK: cargo build\n  EXPECT: /.*/\n  EVIDENCE: pending\n")).toContain("error:trivial-expect");
  });

  test("cargo test without a pinned nonzero count is the zero-tests trap", () => {
    const unpinned = "- [ ] G1: throttling holds\n  CHECK: cargo nextest run -E 'test(throttle)'\n  EXPECT: test result: ok\n  EVIDENCE: pending\n";
    expect(codes(unpinned)).toContain("warning:cargo-zero-tests");
    const pinned = "- [ ] G1: throttling holds\n  CHECK: cargo nextest run -E 'test(throttle)'\n  EXPECT: /1 tests? run: 1 passed/\n  EVIDENCE: pending\n";
    expect(codes(pinned)).not.toContain("warning:cargo-zero-tests");
    const plain = "- [ ] G1: the suite is green\n  CHECK: cargo test --workspace\n  EXPECT: /[1-9][0-9]* passed/\n  EVIDENCE: pending\n";
    expect(codes(plain)).not.toContain("warning:cargo-zero-tests");
    const nextestRun = "- [ ] G1: the suite is green\n  CHECK: cargo nextest run\n  EXPECT: /[1-9][0-9]* tests? run/\n  EVIDENCE: pending\n";
    expect(codes(nextestRun)).not.toContain("warning:cargo-zero-tests");
  });

  test("weak vocabulary, activity titles and unmeasured numbers are warnings", () => {
    const text = [
      "- [ ] G1: run the benchmarks", "  CHECK: cargo bench -p x", "  EXPECT: ok", "  EVIDENCE: pending", "",
      "- [ ] G2: p99 latency stays under 20 ms", "  EVIDENCE: pending", "",
    ].join("\n");
    const c = codes(text);
    expect(c).toContain("warning:activity-title");
    expect(c).toContain("warning:weak-expect");
    expect(c).toContain("warning:unmeasured-number");
  });

  test("a mostly manual ledger is flagged; a clean ledger is not", () => {
    const manual = [
      "- [ ] G1: a", "  EVIDENCE: pending", "- [ ] G2: b", "  EVIDENCE: pending",
      "- [ ] G3: c", "  CHECK: cargo build", "  EXPECT: Finished", "  EVIDENCE: pending",
    ].join("\n");
    expect(codes(manual)).toContain("warning:mostly-manual");
    expect(lintLedger(parseLedger(LEDGER)).filter((f) => f.code !== "weak-expect")).toEqual([]);
  });

  test("parse errors surface as lint errors", () => {
    expect(codes("# nothing\n")).toContain("error:parse");
  });
});

describe("helpers", () => {
  test("qualify uses the spec slug for acceptance.md and the stem otherwise", () => {
    expect(qualify(".rust-studio/specs/rate-limiter/acceptance.md", "G1")).toBe("rate-limiter:G1");
    expect(qualify("/abs/path/specs/x/acceptance.md", "G2")).toBe("x:G2");
    expect(qualify("GATES.md", "G3")).toBe("GATES:G3");
  });

  test("safeText strips terminal controls and bidi overrides and caps length", () => {
    expect(safeText("\x1b[31mred\x1b[0m ‮done")).toBe("red done");
    expect(safeText("x".repeat(300), 10)).toHaveLength(10);
  });
});
