#!/usr/bin/env bun
// Tests for the SubagentStart brief. Run with: `bun test` (from the plugin root) or
// `bun test hooks/scripts/subagent-start.test.ts`.
//
// The failure this hook exists for: a `rust-builder` spawned into a workspace whose
// `justfile` lints default features ran `cargo clippy --all-features` and reported green,
// because nothing in its empty window said a gate existed. The brief must name the gate
// files that are there, say plainly when none are, and stay silent for built-in agents.

import { test, expect, describe } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBrief, gateCandidates, wantsBrief } from "./subagent-start.ts";
import { summarizeManifest } from "./cargo-manifest.ts";

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "subagent-start-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

const CARGO = `[package]\nname = "acme"\nedition = "2024"\nrust-version = "1.85"\n\n[dependencies]\ntokio = "1"\n`;

describe("gate discovery", () => {
  test("names every mechanism present, in project-gate.md's order", () => {
    const dir = project({
      "Cargo.toml": CARGO,
      justfile: "check:\n\tcargo clippy -- -D warnings\n",
      "xtask/Cargo.toml": "[package]\nname = \"xtask\"\n",
      ".github/workflows/ci.yml": "on: push\n",
      ".github/workflows/release.yml": "on: push\n",
    });
    expect(gateCandidates(dir)).toEqual([
      "justfile",
      "xtask/ (cargo xtask)",
      ".github/workflows/ (ci.yml, release.yml)",
    ]);
  });

  test("an empty project has no gate", () => {
    expect(gateCandidates(project({ "Cargo.toml": CARGO }))).toEqual([]);
  });

  test("a stray xtask/ directory without a manifest is not a gate", () => {
    const dir = project({ "Cargo.toml": CARGO, "xtask/README.md": "todo" });
    expect(gateCandidates(dir)).toEqual([]);
  });
});

describe("who gets a brief", () => {
  const roster = new Set(["rust-builder", "rust-reviewer", "chief-architect"]);
  test("roster agents, with or without the plugin namespace", () => {
    expect(wantsBrief("rust-builder", roster)).toBe(true);
    expect(wantsBrief("rust-studio:rust-reviewer", roster)).toBe(true);
  });
  test("built-in and unknown agents are left alone", () => {
    expect(wantsBrief("Explore", roster)).toBe(false);
    expect(wantsBrief("general-purpose", roster)).toBe(false);
    expect(wantsBrief("someone-elses-agent", roster)).toBe(false);
    expect(wantsBrief(undefined, roster)).toBe(false);
  });
  test("an unreadable roster means no brief — a wrong brief costs more than a missing one", () => {
    expect(wantsBrief("rust-builder", null)).toBe(false);
  });
});

describe("the brief", () => {
  const base = {
    agentType: "rust-builder",
    cwd: "/w/acme",
    gateIntensity: "full",
    testRunner: "nextest",
    docsDir: "/plugin/docs",
    memory: null,
  };

  test("names the gate files and points at the doctrine, not a paraphrase of it", () => {
    const dir = project({ "Cargo.toml": CARGO, justfile: "x:\n\ttrue\n" });
    const brief = buildBrief({ ...base, manifest: summarizeManifest(dir), gates: gateCandidates(dir) });
    expect(brief).toContain("**Project gate found:** `justfile`");
    expect(brief).toContain("/plugin/docs/project-gate.md");
    expect(brief).toContain("**acme**");
    expect(brief).toContain("edition 2024");
    expect(brief).toContain("MSRV 1.85");
    expect(brief).toContain("async/web");
    expect(brief).toContain("COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED");
    // Facts, not doctrine: the brief stays short enough to read before the task prompt.
    expect(brief.split("\n").length).toBeLessThanOrEqual(8);
  });

  test("says plainly when there is no gate, so the fallback is a stated choice", () => {
    const dir = project({ "Cargo.toml": CARGO });
    const brief = buildBrief({ ...base, manifest: summarizeManifest(dir), gates: [] });
    expect(brief).toContain("**No project gate found**");
    expect(brief).toContain("Studio defaults apply");
  });

  test("a workspace root without [package] and a directory without Cargo.toml both read sensibly", () => {
    const ws = project({ "Cargo.toml": "[workspace]\nmembers = [\"crates/*\", \"xtask\"]\n" });
    const wsBrief = buildBrief({ ...base, manifest: summarizeManifest(ws), gates: [] });
    expect(wsBrief).toContain("(workspace, 2 member globs)");
    const none = buildBrief({ ...base, manifest: null, gates: [] });
    expect(none).toContain("No `Cargo.toml`");
  });

  test("memory is a pointer to the store, never its contents", () => {
    const brief = buildBrief({ ...base, manifest: null, gates: [], memory: { dir: "/m/acme/memory", notes: 7 } });
    expect(brief).toContain("7 note(s) in `/m/acme/memory`");
    expect(brief).toContain("never write the store yourself");
  });
});

describe("end to end", () => {
  const HOOK = new URL("./subagent-start.ts", import.meta.url).pathname;
  const root = new URL("../..", import.meta.url).pathname;
  const run = (payload: Record<string, unknown>) => {
    const r = Bun.spawnSync(["bun", HOOK], {
      stdin: Buffer.from(JSON.stringify(payload)),
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
    });
    return new TextDecoder().decode(r.stdout).trim();
  };

  test("a studio agent gets the brief with the discovered gate", () => {
    const dir = project({ "Cargo.toml": CARGO, Makefile: "lint:\n\tcargo clippy\n" });
    const out = run({ session_id: "s1", cwd: dir, agent_id: "a1", agent_type: "rust-builder" });
    const ctx = JSON.parse(out).hookSpecificOutput;
    expect(ctx.hookEventName).toBe("SubagentStart");
    expect(ctx.additionalContext).toContain("`Makefile`");
    expect(ctx.additionalContext).toContain("brief for `rust-builder`");
  });

  test("a built-in agent gets nothing", () => {
    const dir = project({ "Cargo.toml": CARGO });
    expect(run({ session_id: "s1", cwd: dir, agent_id: "a2", agent_type: "Explore" })).toBe("");
  });

  test("garbage input never breaks the spawn", () => {
    const r = Bun.spawnSync(["bun", HOOK], {
      stdin: Buffer.from("not json"),
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
    });
    expect(r.exitCode).toBe(0);
  });
});
