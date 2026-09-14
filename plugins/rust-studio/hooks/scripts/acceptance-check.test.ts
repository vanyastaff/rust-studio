// Tests for the acceptance checker CLI. Real commands run in a temp project: the point of
// the checker is what it does to the ledger on disk, so the assertions read the file back.
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultCwd, main, parseArgs, runCheck, DEFAULT_TIMEOUT_S, LINGER_GRACE_MS } from "./acceptance-check.ts";
import { parseLedger, gateState } from "./acceptance-ledger.ts";

let tmp: string;
let specDir: string;
let ledger: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "rs-acc-"));
  specDir = join(tmp, ".rust-studio", "specs", "demo");
  mkdirSync(specDir, { recursive: true });
  ledger = join(specDir, "acceptance.md");
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function write(text: string): void {
  writeFileSync(ledger, text);
}
function states(): Record<string, string> {
  const l = parseLedger(readFileSync(ledger, "utf8"));
  return Object.fromEntries(l.gates.map((g) => [g.id, gateState(g, l)]));
}

/** Run main() with stdout captured. */
async function cli(...argv: string[]): Promise<{ code: number; out: string }> {
  const chunks: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { chunks.push(a.map(String).join(" ")); };
  try {
    const code = await main(argv);
    return { code, out: chunks.join("\n") };
  } finally {
    console.log = orig;
  }
}

const MARKER = (name: string) => join(tmp, `${name}.touched`);
const LEDGER = (extra = "") => `# Acceptance: demo

- [ ] G1: the greeting prints its marker
  CHECK: touch "${MARKER("g1")}" && printf 'greeting-ok\\n'
  EXPECT: greeting-ok
  EVIDENCE: pending

- [ ] G2: a nonzero exit fails even when the marker is printed
  CHECK: printf 'marker-present\\n'; exit 3
  EXPECT: marker-present
  EVIDENCE: pending

- [ ] G3: zero tests matched is not a pass
  CHECK: printf 'running 0 tests\\ntest result: ok. 0 passed\\n'
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: pending

- [ ] G4: the decision is reviewed by its owner
  EVIDENCE: pending

- [ ] G5: CWD is resolved beneath the project root
  CHECK: pwd
  EXPECT: specs/demo
  CWD: .rust-studio/specs/demo
  EVIDENCE: pending
${extra}`;

describe("argument parsing", () => {
  test("no mode means --status; modes are exclusive; unknown options are usage errors", () => {
    const o = parseArgs(["x.md"]);
    expect(o).not.toBeInstanceOf(Error);
    expect((o as any).mode).toBe("status");
    expect((o as any).timeoutS).toBe(DEFAULT_TIMEOUT_S);
    expect(parseArgs(["--run", "--reverify", "x.md"])).toBeInstanceOf(Error);
    expect(parseArgs(["--bogus", "x.md"])).toBeInstanceOf(Error);
    expect(parseArgs(["--run"])).toBeInstanceOf(Error);
    expect(parseArgs(["--timeout", "0", "x.md"])).toBeInstanceOf(Error);
    expect(parseArgs(["--timeout", "9", "x.md"])).not.toBeInstanceOf(Error);
  });

  test("every positional after -- is a file, option order does not drop the first file", () => {
    const o = parseArgs(["a.md", "--run", "b.md", "--", "--weird.md"]) as any;
    expect(o.files).toEqual(["a.md", "b.md", "--weird.md"]);
    expect(o.mode).toBe("run");
  });

  test("--help exits 0 and prints usage", async () => {
    const r = await cli("--help");
    expect(r.code).toBe(0);
    expect(r.out).toContain("usage: acceptance-check.ts");
  });
});

describe("working directory", () => {
  test("a ledger under .rust-studio/ anchors at the project root; elsewhere at its own dir", () => {
    expect(defaultCwd(ledger)).toBe(tmp);
    const loose = join(tmp, "GATES.md");
    expect(defaultCwd(loose)).toBe(tmp);
    const nested = join(tmp, "sub", "GATES.md");
    expect(defaultCwd(nested)).toBe(join(tmp, "sub"));
  });
});

describe("--status never executes and never writes", () => {
  test("a command with a side effect is not run under --status", async () => {
    write(LEDGER());
    const before = readFileSync(ledger, "utf8");
    const r = await cli("--status", ledger);
    expect(r.code).toBe(1);
    expect(existsSync(MARKER("g1"))).toBe(false);
    expect(readFileSync(ledger, "utf8")).toBe(before);
    expect(r.out).toContain("NOT MET");
    expect(r.out).toContain("UNMET     G4: the decision is reviewed by its owner  [manual]");
  });

  test("a ledger that does not parse exits 2 with INVALID LEDGER", async () => {
    write("# Acceptance: broken\n\n- [ ] G1: a\n  CHECK: ls\n  EVIDENCE: pending\n");
    const r = await cli(ledger);
    expect(r.code).toBe(2);
    expect(r.out).toContain("INVALID LEDGER");
    expect(r.out).toContain("PARSE ERROR");
  });
});

describe("--run", () => {
  test("met needs exit 0 AND EXPECT; evidence binds the definition; manual gates untouched", async () => {
    write(LEDGER());
    const r = await cli("--run", ledger);
    expect(r.code).toBe(1);
    expect(existsSync(MARKER("g1"))).toBe(true);
    expect(states()).toEqual({ G1: "met", G2: "unmet", G3: "unmet", G4: "unmet", G5: "met" });
    const text = readFileSync(ledger, "utf8");
    expect(text).toMatch(/- \[x\] G1:[\s\S]*?EVIDENCE: rs-acceptance\/v1 def=[0-9a-f]{16} exit=0 expect=matched out=[0-9a-f]{16}:12 cwd=\. shell=sh/);
    expect(text).toMatch(/- \[ \] G2:[\s\S]*?EVIDENCE: failed at=\S+ exit=3 expect=matched/);
    expect(text).toMatch(/- \[ \] G3:[\s\S]*?EVIDENCE: failed at=\S+ exit=0 expect=unmatched/);
    expect(text).toMatch(/- \[ \] G4:[\s\S]*?EVIDENCE: pending/);
    expect(text).toMatch(/cwd=\.rust-studio\/specs\/demo shell=sh/);
    // Raw output is never persisted — only its fingerprint.
    for (const ev of text.match(/EVIDENCE: .*/g)!) {
      expect(ev).not.toContain("marker-present");
      expect(ev).not.toContain("running 0 tests");
    }
    expect(r.out).toContain("ACCEPTANCE");
    expect(r.out).toContain("2 met, 3 unmet, 0 stale, 0 abandoned (of 5; 4 runnable, 1 manual)");
  });

  test("a met gate is skipped by --run and re-executed by --reverify, which demotes on failure", async () => {
    write(LEDGER());
    await cli("--run", ledger);
    rmSync(MARKER("g1"));
    const r1 = await cli("--run", ledger);
    expect(existsSync(MARKER("g1"))).toBe(false); // met → not rerun
    expect(r1.out).not.toContain("▶ demo:G1");
    const r2 = await cli("--reverify", ledger);
    expect(existsSync(MARKER("g1"))).toBe(true); // reverify reran it
    expect(r2.out).toContain("▶ demo:G1");
    // Now break G1's oracle: the definition changes, the old evidence goes stale, reverify demotes.
    const text = readFileSync(ledger, "utf8").replace("EXPECT: greeting-ok", "EXPECT: greeting-changed");
    write(text);
    const s = await cli("--status", ledger);
    expect(s.out).toContain("STALE     G1");
    const r3 = await cli("--reverify", ledger);
    expect(r3.code).toBe(1);
    expect(states().G1).toBe("unmet");
  });

  test("an ABANDON is a terminal handoff: exit 1, HANDOFF REQUIRED, and the reason is shown", async () => {
    write(LEDGER("\nABANDON: G4 owner unavailable until Q4; tracked in issue 12\n"));
    // Make everything else pass so the handoff is the only thing standing.
    const text = readFileSync(ledger, "utf8")
      .replace("printf 'marker-present\\n'; exit 3", "printf 'marker-present\\n'")
      .replace("EXPECT: /[1-9][0-9]* passed/", "EXPECT: 0 passed");
    write(text);
    const r = await cli("--run", ledger);
    expect(r.code).toBe(1);
    expect(r.out).toContain("HANDOFF REQUIRED");
    expect(r.out).toContain("HANDOFF demo:G4: owner unavailable until Q4; tracked in issue 12");
    expect(states()).toEqual({ G1: "met", G2: "met", G3: "met", G4: "abandoned", G5: "met" });
  });

  test("ALL MET exits 0 only when every gate is met", async () => {
    write(`# Acceptance: tiny\n\n- [ ] G1: prints\n  CHECK: printf 'fine\\n'\n  EXPECT: fine\n  EVIDENCE: pending\n\n- [x] G2: reviewed\n  EVIDENCE: reviewed against ADR-0007 on 2026-09-14\n`);
    const r = await cli("--run", ledger);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ALL MET — 2 met, 0 unmet, 0 stale, 0 abandoned of 2");
  });

  test("an overflowing gate records `overflow` in its evidence, not a timeout", async () => {
    write(`# Acceptance: big\n\n- [ ] G1: prints a lot\n  CHECK: head -c 5000000 /dev/zero | tr '\\0' a; echo MARKER\n  EXPECT: MARKER\n  EVIDENCE: pending\n`);
    const r = await cli("--run", ledger);
    expect(r.code).toBe(1);
    expect(r.out).toContain("output exceeded");
    expect(readFileSync(ledger, "utf8")).toMatch(/EVIDENCE: failed at=\S+ overflow/);
  });

  test("a missing CWD fails the gate without running the command", async () => {
    write(`# Acceptance: cwd\n\n- [ ] G1: x\n  CHECK: touch "${MARKER("nope")}"\n  EXPECT: /.*/\n  CWD: does/not/exist\n  EVIDENCE: pending\n`);
    const r = await cli("--run", ledger);
    expect(r.code).toBe(1);
    expect(existsSync(MARKER("nope"))).toBe(false);
    expect(r.out).toContain("CWD does not exist");
  });

  test("a definition edited while its check ran is not credited", async () => {
    // The check itself rewrites the ledger's EXPECT mid-run; the result must be discarded.
    const self = ledger.replace(/'/g, "'\\''");
    write(`# Acceptance: race\n\n- [ ] G1: racy\n  CHECK: sed -i 's/EXPECT: before/EXPECT: after/' '${self}'; printf 'before\\n'\n  EXPECT: before\n  EVIDENCE: pending\n`);
    const r = await cli("--run", ledger);
    expect(r.code).toBe(1);
    expect(r.out).toContain("definition changed while the check ran");
    expect(states().G1).toBe("unmet");
  });

  test("--json reports the same verdict machine-readably", async () => {
    write(LEDGER());
    const r = await cli("--run", "--json", ledger);
    const j = JSON.parse(r.out);
    expect(j.verdict).toBe("NOT MET");
    expect(j.exit).toBe(1);
    expect(j.totals).toEqual({ met: 2, unmet: 3, stale: 0, abandoned: 0, total: 5 });
    expect(j.ledgers[0].gates.find((g: any) => g.id === "G2")).toMatchObject({ state: "unmet", exit: 3, matched: true });
  });
});

describe("runCheck", () => {
  test("a hung command settles at the timeout with a nonzero exit and no leftover children", async () => {
    const t0 = Date.now();
    const r = await runCheck("sleep 20; echo late", "late", tmp, 1);
    expect(r.timedOut).toBe(true);
    expect(r.exit).not.toBe(0);
    expect(r.matched).toBe(false);
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  test("output past the cap is cut off at the cap, labelled overflow (not timeout), and settles at once", async () => {
    const t0 = Date.now();
    // 300 KiB against a 64 KiB cap; without the cut the command would run on for 20 s.
    const r = await runCheck("head -c 300000 /dev/zero | tr '\\0' a; echo MARKER; sleep 20", "MARKER", tmp, 30, { cap: 64 * 1024 });
    expect(r.overflow).toBe(true);
    expect(r.timedOut).toBe(false);
    expect(r.matched).toBe(false);
    expect(Buffer.byteLength(r.combined)).toBeLessThanOrEqual(64 * 1024);
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  test("a check whose descendant keeps the pipe open still matches on what it printed, and the descendant is reaped", async () => {
    const t0 = Date.now();
    const r = await runCheck("echo MARKER; sleep 40 & exit 0", "MARKER", tmp, 30);
    expect(r.exit).toBe(0);
    expect(r.matched).toBe(true);
    expect(r.combined).toContain("MARKER");
    expect(Date.now() - t0).toBeLessThan(LINGER_GRACE_MS + 2_000);
    const left = Bun.spawnSync(["pgrep", "-f", "^sleep 40$"], { timeout: 5_000 });
    expect(new TextDecoder().decode(left.stdout).trim()).toBe("");
  });

  test("stdout and stderr are both visible to EXPECT", async () => {
    const r = await runCheck("echo out; echo err 1>&2", "err", tmp, 5);
    expect(r.exit).toBe(0);
    expect(r.matched).toBe(true);
    expect(r.combined).toBe("out\n\nerr\n");
  });
});

describe("--lint", () => {
  test("errors fail, warnings pass unless --strict, parse failures exit 2", async () => {
    write("# Acceptance: lint\n\n- [ ] G1: invoices reconcile\n  CHECK: echo verification passed\n  EXPECT: verification passed\n  EVIDENCE: pending\n");
    const e = await cli("--lint", ledger);
    expect(e.code).toBe(1);
    expect(e.out).toContain("LINT FINDINGS");
    expect(e.out).toContain("[fixed-output]");

    write("# Acceptance: lint\n\n- [ ] G1: run the suite\n  CHECK: cargo nextest run\n  EXPECT: /[1-9][0-9]* passed/\n  EVIDENCE: pending\n");
    const w = await cli("--lint", ledger);
    expect(w.code).toBe(0);
    expect(w.out).toContain("LINT OK (1 warning(s))");
    const s = await cli("--lint", "--strict", ledger);
    expect(s.code).toBe(1);

    write("# Acceptance: lint\n");
    const p = await cli("--lint", ledger);
    expect(p.code).toBe(2);
    expect(p.out).toContain("LINT PARSE FAILURE");
  });
});

describe("shipped-script contract", () => {
  test("the CLI answers --help with exit 0 as a subprocess", () => {
    const r = Bun.spawnSync(["bun", join(import.meta.dir, "acceptance-check.ts"), "--help"], { timeout: 10_000 });
    expect(r.exitCode).toBe(0);
    expect(new TextDecoder().decode(r.stdout)).toContain("--reverify");
  });
});
