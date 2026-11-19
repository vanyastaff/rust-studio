// Tests for the SessionStart hook end to end: which briefing lines `process_briefing` keeps.
// The hook runs at import, so it is spawned with a payload rather than imported.
import { fileURLToPath } from "node:url";
import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = fileURLToPath(new URL("./session-start.ts", import.meta.url));

/** Lines that steer a session toward the studio's own process. */
const PROCESS_LINES = ["**Protocol:**", "**Team:**", "**Start here", "**Always available:**", "**Skills first:**"];

/** A workspace crate, so the large-workspace note is in play. */
function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "ss-"));
  writeFileSync(
    join(dir, "Cargo.toml"),
    ['[workspace]', 'members = ["crates/*"]', "", "[package]", 'name = "probe"', 'edition = "2024"', 'rust-version = "1.85"', ""].join("\n"),
  );
  return dir;
}

/** Run the hook with `process_briefing` set through `env` (or unset), memory recall off and a
 *  private data dir; returns the briefing text. */
function briefing(cwd: string, env: Record<string, string>): string {
  const base = { ...process.env };
  for (const k of ["CLAUDE_PLUGIN_OPTION_PROCESS_BRIEFING", "CLAUDE_PLUGIN_OPTION_process_briefing", "RUST_STUDIO_PROCESS_BRIEFING"])
    delete base[k];
  const r = Bun.spawnSync(["bun", HOOK], {
    stdin: new TextEncoder().encode(JSON.stringify({ cwd })),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...base, CLAUDE_PLUGIN_DATA: mkdtempSync(join(tmpdir(), "ss-data-")), CLAUDE_PLUGIN_OPTION_MEMORY_RECALL: "off", ...env },
  });
  expect(r.exitCode).toBe(0);
  const out = JSON.parse(new TextDecoder().decode(r.stdout)) as { hookSpecificOutput: { additionalContext: string } };
  return out.hookSpecificOutput.additionalContext;
}

describe("process_briefing", () => {
  test("on by default: the briefing carries every process line", () => {
    const text = briefing(workspace(), {});
    for (const line of PROCESS_LINES) expect(text).toContain(line);
  });

  test("off through userConfig or the RUST_STUDIO_ escape hatch: process lines go, detected facts stay", () => {
    const cwd = workspace();
    for (const env of [{ CLAUDE_PLUGIN_OPTION_PROCESS_BRIEFING: "false" }, { RUST_STUDIO_PROCESS_BRIEFING: "off" }]) {
      const text = briefing(cwd, env);
      for (const line of PROCESS_LINES) expect(text).not.toContain(line);
      expect(text).toContain("- Crate/workspace: **probe**");
      expect(text).toContain("- Edition: 2024   MSRV (rust-version): 1.85");
      expect(text).toContain("- Domain(s):");
      expect(text).toContain("**Studio config:**");
      expect(text).toContain("**Gate intensity");
      expect(text).toContain("**Large workspace (1 member globs):**");
    }
  });

  test("off without a Cargo.toml: the routing paragraph goes, the missing-manifest fact stays", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ss-empty-"));
    expect(briefing(cwd, {})).toContain("still routes through the studio");
    const text = briefing(cwd, { RUST_STUDIO_PROCESS_BRIEFING: "off" });
    expect(text).toContain("no Cargo.toml was found at the session root.");
    expect(text).not.toContain("still routes through the studio");
    expect(text).not.toContain("Studio protocol:");
  });
});
