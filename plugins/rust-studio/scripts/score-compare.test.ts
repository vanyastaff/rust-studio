#!/usr/bin/env bun
// Tests for the score compare /evolve decides with. Run with `bun test`.
//
// The contract is the exit code: a regression on any judged metric is 1 whatever else
// improved, an improvement with no regression is 0 and says which keys moved, equality is 0
// and says so, and a malformed line is 2 rather than a silently skipped metric. `info` rows are
// recorded and never judged; a key on one side only is never judged either.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "./score-compare.sh");
const dir = mkdtempSync(join(tmpdir(), "score-compare-"));

function scores(name: string, rows: [string, string, string][]): string {
  const p = join(dir, name);
  writeFileSync(p, rows.map((r) => r.join("\t")).join("\n") + "\n");
  return p;
}
function run(args: string[]) {
  const r = Bun.spawnSync(["bash", SCRIPT, ...args], { stdin: new Uint8Array(), timeout: 30_000 });
  return { code: r.exitCode, stdout: new TextDecoder().decode(r.stdout), stderr: new TextDecoder().decode(r.stderr) };
}

const base = scores("baseline.tsv", [["dup", "50", "min"], ["cycles", "24", "min"], ["tests", "100", "max"], ["lines", "31153", "info"]]);

describe("score-compare.sh <before> <after>", () => {
  test("improvement with no regression exits 0 and names the keys", () => {
    const r = run([base, scores("round-1.tsv", [["dup", "40", "min"], ["cycles", "24", "min"], ["tests", "102", "max"], ["lines", "31000", "info"]])]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("IMPROVED: dup,tests");
  });
  test("a regression exits 1 even when other metrics improved", () => {
    const r = run([base, scores("round-2.tsv", [["dup", "40", "min"], ["cycles", "30", "min"], ["tests", "102", "max"], ["lines", "31000", "info"]])]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("REGRESSION: cycles");
  });
  test("an info metric moving either way is never judged", () => {
    const r = run([base, scores("round-3.tsv", [["dup", "50", "min"], ["cycles", "24", "min"], ["tests", "100", "max"], ["lines", "99999", "info"]])]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("NO CHANGE");
  });
  test("a key on one side only is reported, not judged", () => {
    const r = run([base, scores("round-4.tsv", [["dup", "50", "min"], ["cycles", "24", "min"], ["tests", "100", "max"], ["mutants", "80", "max"]])]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("new (not judged)");
    expect(r.stdout).toContain("gone (not judged)");
  });
  test("a malformed line exits 2", () => {
    const r = run([base, scores("bad.tsv", [["dup", "abc", "min"]])]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("malformed line");
  });
  test("--help prints usage and exits 0", () => {
    const r = run(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("score-compare.sh <before> <after>");
    expect(r.stdout).toContain("--table");
  });
  test("usage errors exit 2", () => {
    expect(run([]).code).toBe(2);
    expect(run([base, join(dir, "missing.tsv")]).code).toBe(2);
  });
});

describe("score-compare.sh --table", () => {
  test("renders one column per file with the best judged value in bold", () => {
    const r1 = scores("r1.tsv", [["dup", "40", "min"], ["cycles", "24", "min"], ["tests", "102", "max"], ["lines", "31000", "info"]]);
    const r = run(["--table", base, r1]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("| metric | baseline | r1 |");
    expect(r.stdout).toContain("| dup | 50 | **40** |");
    expect(r.stdout).toContain("| cycles | **24** | **24** |");
    expect(r.stdout).toContain("| lines | 31153 | 31000 |");
  });
});
