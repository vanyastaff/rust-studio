#!/usr/bin/env bun
// Tests for the provisioning script the /env-setup skill ships. Run with `bun test`.
//
// This is the one script in the distribution whose job is to change the user's machine,
// and it is bundled into a skill an agent runs. Two properties have to hold before that is
// safe, and neither was covered: `--help` must work (a person has to be able to read what
// they are about to delegate), and `--dry-run` must actually install nothing. The second is
// asserted against a sandboxed HOME whose `.cargo/bin` must still be empty afterwards —
// see `Run.installed` for why that is the right directory to watch.

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "./env-setup.sh");

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
  /** Binaries the run left in the sandboxed `~/.cargo/bin`.
   *
   *  This, not "HOME is untouched", is the property worth asserting. Merely probing the
   *  machine with `rustup`/`cargo` makes rustup create its own `$HOME/.rustup` — a fact
   *  about rustup, not an install. Everything this script installs lands in `.cargo/bin`,
   *  so that directory staying empty is what "nothing was installed" actually means. */
  installed: string[];
}

/** Run the script with HOME pointed at a fresh empty directory and stdin closed, so an
 *  unexpected prompt fails the test instead of hanging it. */
function run(args: string[]): Run {
  const home = mkdtempSync(join(tmpdir(), "env-setup-home-"));
  const r = Bun.spawnSync(["bash", SCRIPT, ...args], {
    stdin: new Uint8Array(),
    env: { ...process.env, HOME: home, NO_COLOR: "1" },
    timeout: 120_000,
  });
  const bin = join(home, ".cargo", "bin");
  return {
    code: r.exitCode,
    stdout: new TextDecoder().decode(r.stdout),
    stderr: new TextDecoder().decode(r.stderr),
    installed: existsSync(bin) ? readdirSync(bin) : [],
  };
}

describe("env-setup.sh --help", () => {
  const r = run(["--help"]);

  test("exits 0 and documents itself", () => {
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage: env-setup.sh");
  });

  test("every flag the script accepts is documented", () => {
    // The help text is a `sed` range over the script's own header, so a flag added to the
    // parser without a header line silently stops being discoverable.
    for (const flag of ["--check", "--core", "--full", "--qol", "--nightly", "--os-deps", "--yes", "--dry-run"]) {
      expect(r.stdout).toContain(flag);
    }
  });

  test("asking for help installs nothing", () => {
    expect(r.installed).toEqual([]);
  });
});

describe("env-setup.sh argument handling", () => {
  test("an unknown flag is refused, not ignored", () => {
    // Ignoring it would silently skip a tier the caller asked for.
    const r = run(["--instal-everything"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("unknown flag");
    expect(r.installed).toEqual([]);
  });
});

describe("env-setup.sh --check", () => {
  test("reports the machine and mutates nothing", () => {
    const r = run(["--check"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("== current state ==");
    expect(r.installed).toEqual([]);
  });
});

describe("env-setup.sh --dry-run", () => {
  test("prints the mutating commands without running any of them", () => {
    // --yes so no prompt blocks on the closed stdin; --dry-run is the property under test.
    const r = run(["--core", "--dry-run", "--yes"]);
    expect(r.code).toBe(0);
    // The `+ ` prefix is what `run()` echoes before it would execute.
    expect(r.stdout).toMatch(/^\+ /m);
    // The claim in the header is "print every mutating command instead of running it".
    // An empty `.cargo/bin` is the evidence for it — and it covers the two bootstrap
    // installers (rustup, cargo-binstall) that pipe curl into a shell outside run(),
    // which are guarded by a separate `[ "$DRY_RUN" = 0 ]` branch rather than by run().
    expect(r.installed).toEqual([]);
  });
});
