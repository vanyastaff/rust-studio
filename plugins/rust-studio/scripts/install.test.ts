import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const installSh = resolve(import.meta.dir, "../../../install.sh");

// A PATH containing only the fake host CLIs plus the essentials install.sh needs.
function fakePath(hosts: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "install-test-"));
  for (const host of hosts) {
    const bin = join(dir, host);
    writeFileSync(bin, "#!/bin/sh\nexit 0\n");
    chmodSync(bin, 0o755);
  }
  return `${dir}:/usr/bin:/bin`;
}

function dryRun(hosts: string[]) {
  const proc = Bun.spawnSync(["bash", installSh, "--dry-run"], {
    env: { ...process.env, PATH: fakePath(hosts) },
  });
  return {
    code: proc.exitCode,
    out: proc.stdout.toString(),
    err: proc.stderr.toString(),
  };
}

describe("install.sh --dry-run", () => {
  test("installs the full studio when claude is present", () => {
    const r = dryRun(["claude"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("+ claude plugin marketplace add");
    expect(r.out).toContain("+ claude plugin install rust-studio@rust-studio");
    expect(r.out).not.toContain("+ codex");
  });

  test("installs the native plugin when codex is present", () => {
    const r = dryRun(["codex"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("+ codex plugin marketplace add");
    expect(r.out).toContain("+ codex plugin add rust-studio@rust-studio");
    expect(r.out).not.toContain("+ claude");
  });

  test("installs for both hosts when both are present", () => {
    const r = dryRun(["claude", "codex"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("+ claude plugin install rust-studio@rust-studio");
    expect(r.out).toContain("+ codex plugin add rust-studio@rust-studio");
  });

  test("falls back to the skills registry via npx", () => {
    const r = dryRun(["npx"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("+ npx skills add");
  });

  test("fails loudly when no host is found", () => {
    const r = dryRun([]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("no supported agent host");
  });

  test("uses the local clone as the marketplace source", () => {
    const r = dryRun(["claude"]);
    // install.sh lives in the repo root, so the local path is used, not the GitHub slug.
    expect(r.out).toMatch(/\+ claude plugin marketplace add \/.*rust-studio/);
  });
});
