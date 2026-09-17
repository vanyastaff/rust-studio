#!/usr/bin/env bun
// Tests for the slop audit the /tech-debt, /adopt and /refactor skills ship. Run with `bun test`.
//
// The script's contract is "run what is installed, name what is missing, exit 0": an agent on
// a machine without similarity-rs or cargo-modules must still get a report, and a report must
// say which section it could not fill. The fixture crate plants one orphan file, one sibling
// module cycle and a non-`pub` `pub` item so that, where cargo-modules and clippy are present,
// the detection paths are exercised on real output rather than on the script's own strings.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "./slop-audit.sh");

function has(cmd: string[]): boolean {
  const r = Bun.spawnSync(cmd, { stdout: "ignore", stderr: "ignore" });
  return r.exitCode === 0;
}
const hasCargo = has(["cargo", "--version"]);
const hasModules = hasCargo && has(["cargo", "modules", "--version"]);

interface Run { code: number | null; stdout: string; stderr: string }
function run(args: string[], cwd: string): Run {
  const r = Bun.spawnSync(["bash", SCRIPT, ...args], {
    cwd,
    stdin: new Uint8Array(),
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 600_000,
  });
  return { code: r.exitCode, stdout: new TextDecoder().decode(r.stdout), stderr: new TextDecoder().decode(r.stderr) };
}

/** A one-crate fixture: `a` and `b` use each other (a sibling cycle), `orphan.rs` is never
 *  `mod`-linked, and `b` is private while `b::fb` is `pub` (an `unreachable_pub` hit). */
function fixtureCrate(): string {
  const dir = mkdtempSync(join(tmpdir(), "slop-audit-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "Cargo.toml"), '[package]\nname = "probe"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n');
  writeFileSync(join(dir, "src/lib.rs"), "pub mod a;\nmod b;\n");
  writeFileSync(join(dir, "src/a.rs"), "use crate::b::fb;\npub fn fa() -> u32 { fb() + 1 }\n");
  writeFileSync(join(dir, "src/b.rs"), "use crate::a::fa;\npub fn fb() -> u32 { fa() }\n");
  writeFileSync(join(dir, "src/orphan.rs"), "pub fn never_linked() {}\n");
  return dir;
}

describe("slop-audit.sh --help", () => {
  const r = run(["--help"], tmpdir());
  test("exits 0 and documents every flag", () => {
    expect(r.code).toBe(0);
    for (const flag of ["-p <package>", "--path <dir>", "--skip <list>"]) expect(r.stdout).toContain(flag);
  });
});

describe("slop-audit.sh outside a cargo project", () => {
  test("refuses with exit 2 and says where to run", () => {
    const r = run([], mkdtempSync(join(tmpdir(), "slop-audit-empty-")));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("no Cargo.toml");
  });
  test("rejects an unknown flag", () => {
    const r = run(["--bogus"], tmpdir());
    expect(r.code).toBe(2);
  });
});

describe.skipIf(!hasCargo)("slop-audit.sh on the fixture crate", () => {
  const dir = fixtureCrate();
  // clippy and deny are the slow / network-shaped sections; the report contract is the same
  // with them skipped, and the skip must be visible in the tool table.
  const r = run(["--skip", "clippy,deny"], dir);

  test("exits 0 and is one Markdown report", () => {
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("# Slop audit — probe —");
    for (const heading of [
      "## Lints beyond the project gate",
      "## Unused dependencies",
      "## Dependency policy",
      "## Near-duplicate functions",
      "## Module graph",
      "## Size",
      "## Read next",
    ]) expect(r.stdout).toContain(heading);
  });

  test("names a skipped section and a missing tool instead of failing", () => {
    expect(r.stdout).toContain("| `cargo clippy` | skipped (--skip) |");
    expect(r.stdout).toContain("| `cargo deny` | skipped (--skip) |");
    // Every tool row is one of exactly three states; a fourth would be a silent failure.
    const rows = r.stdout.split("\n").filter((l) => l.startsWith("| `"));
    for (const row of rows) expect(row).toMatch(/\| (available|not installed|skipped \(--skip\)) \|$/);
  });

  test("rejects a package that is not a workspace member", () => {
    const bad = run(["-p", "nope"], dir);
    expect(bad.code).toBe(2);
    expect(bad.stderr).toContain("not a workspace member");
  });

  test.skipIf(!hasModules)("finds the orphan file and the sibling cycle", () => {
    expect(r.stdout).toContain("orphan");
    expect(r.stdout).toContain("cycle: probe::b <-> probe::a");
  });
});
