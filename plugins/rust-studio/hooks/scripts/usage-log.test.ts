// Tests for the usage log: the row a PostToolUse payload yields (Skill, Agent, Codex
// spawn_agent, and everything that must yield nothing), the append path, the line parser,
// and the hook end to end — a malformed payload writes nothing and still exits 0.
import { test, expect, describe } from "bun:test";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rowFromPayload, appendUsage, parseUsageLine, studioName, USAGE_FILE } from "./usage-log.ts";
import { pruneState } from "./_lib.ts";

const HOOK = new URL("./usage-log.ts", import.meta.url).pathname;

/** A PostToolUse payload as Claude Code 2.1.272 builds it (fields read from the bundle). */
const base = { session_id: "abc", transcript_path: "/t.jsonl", cwd: "/home/me/proj", permission_mode: "default", hook_event_name: "PostToolUse", tool_use_id: "toolu_1", duration_ms: 12 };

describe("rowFromPayload", () => {
  test("the Skill tool: tool_input.skill, namespace dropped", () => {
    expect(rowFromPayload({ ...base, tool_name: "Skill", tool_input: { skill: "rust-studio:review", args: "src/" }, tool_response: { success: true } })).toEqual({
      session_id: "abc",
      cwd: "/home/me/proj",
      kind: "skill",
      name: "review",
      invoker: "model",
    });
    expect(rowFromPayload({ ...base, tool_name: "Skill", tool_input: { skill: "code-review" } })?.name).toBe("code-review");
  });
  test("the Agent tool: tool_input.subagent_type; a bare spawn is the general-purpose agent", () => {
    expect(rowFromPayload({ ...base, tool_name: "Agent", tool_input: { subagent_type: "rust-studio:rust-reviewer", prompt: "review it", description: "review" } })).toMatchObject({ kind: "agent", name: "rust-reviewer" });
    expect(rowFromPayload({ ...base, tool_name: "Agent", tool_input: { prompt: "look around", description: "explore" } })).toMatchObject({ kind: "agent", name: "general-purpose" });
    expect(rowFromPayload({ ...base, tool_name: "Task", tool_input: { subagent_type: "Explore" } })).toMatchObject({ kind: "agent", name: "Explore" });
  });
  test("Codex spawn_agent: tool_input.agent_type; a fork that inherits its type is skipped", () => {
    expect(rowFromPayload({ ...base, tool_name: "spawn_agent", tool_input: { agent_type: "rust-scout", message: "map it" } })).toMatchObject({ kind: "agent", name: "rust-scout" });
    expect(rowFromPayload({ ...base, tool_name: "spawn_agent", tool_input: { fork_context: true, message: "continue" } })).toBeNull();
  });
  test("anything else yields nothing: another tool, a missing or non-string name, garbage", () => {
    expect(rowFromPayload({ ...base, tool_name: "Bash", tool_input: { command: "ls" } })).toBeNull();
    expect(rowFromPayload({ ...base, tool_name: "Skill", tool_input: {} })).toBeNull();
    expect(rowFromPayload({ ...base, tool_name: "Skill", tool_input: { skill: 7 } })).toBeNull();
    expect(rowFromPayload({ ...base, tool_name: "Skill", tool_input: { skill: "  " } })).toBeNull();
    expect(rowFromPayload({ ...base, tool_name: "Skill", tool_input: { skill: 'bad "name"' } })).toBeNull();
    expect(rowFromPayload({ ...base, tool_name: "Skill" })).toBeNull();
    expect(rowFromPayload({})).toBeNull();
    expect(rowFromPayload(null)).toBeNull();
    expect(rowFromPayload("Skill")).toBeNull();
  });
  test("a payload without session_id or cwd still yields a row, with those blank", () => {
    expect(rowFromPayload({ tool_name: "Skill", tool_input: { skill: "spec" } })).toEqual({ session_id: "", cwd: "", kind: "skill", name: "spec", invoker: "model" });
  });
});

describe("studioName", () => {
  test("drops only the plugin's own namespace", () => {
    expect(studioName("rust-studio:dev-task")).toBe("dev-task");
    expect(studioName(" review ")).toBe("review");
    expect(studioName("other:review")).toBe("other:review");
  });
});

describe("appendUsage + parseUsageLine", () => {
  test("round-trips a row through the file, stamping the time", () => {
    const dir = mkdtempSync(join(tmpdir(), "usage-"));
    process.env.CLAUDE_PLUGIN_DATA = dir;
    try {
      expect(appendUsage({ session_id: "s1", cwd: "/p", kind: "skill", name: "review", invoker: "user" })).toBe(true);
      expect(appendUsage({ session_id: undefined, cwd: 3, kind: "agent", name: "rust-scout", invoker: "model" })).toBe(true);
      const lines = readFileSync(join(dir, USAGE_FILE), "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);
      const a = parseUsageLine(lines[0])!;
      expect(a).toMatchObject({ session_id: "s1", cwd: "/p", kind: "skill", name: "review", invoker: "user" });
      expect(Date.now() - Date.parse(a.ts)).toBeLessThan(60_000);
      expect(parseUsageLine(lines[1])).toMatchObject({ session_id: "", cwd: "", kind: "agent", name: "rust-scout", invoker: "model" });
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
    }
  });
  test("a malformed line parses to null rather than throwing", () => {
    expect(parseUsageLine("not json")).toBeNull();
    expect(parseUsageLine('{"ts":"nope","kind":"skill","name":"x","invoker":"model"}')).toBeNull();
    expect(parseUsageLine('{"ts":"2026-09-14T00:00:00Z","kind":"tool","name":"x","invoker":"model"}')).toBeNull();
    expect(parseUsageLine('{"ts":"2026-09-14T00:00:00Z","kind":"skill","name":"","invoker":"model"}')).toBeNull();
    expect(parseUsageLine('{"ts":"2026-09-14T00:00:00Z","kind":"skill","name":"x","invoker":"hook"}')).toBeNull();
    expect(parseUsageLine("[1,2]")).toBeNull();
  });
});

describe("the session-start sweep leaves the log alone", () => {
  test("pruneState keeps a named entry however old it is", () => {
    const dir = mkdtempSync(join(tmpdir(), "prune-"));
    const log = join(dir, USAGE_FILE);
    const marker = join(dir, "rust-studio-nudge");
    writeFileSync(log, "{}\n");
    writeFileSync(marker, "[]");
    const past = new Date(Date.now() - 30 * 24 * 3600_000);
    utimesSync(log, past, past);
    utimesSync(marker, past, past);
    expect(pruneState(dir, 7 * 24 * 3600_000, new Set([USAGE_FILE]))).toBe(1);
    expect(existsSync(log)).toBe(true);
    expect(existsSync(marker)).toBe(false);
  });
});

function runHook(stdin: string, dataDir: string): { code: number | null; out: string; usage: string } {
  const r = Bun.spawnSync(["bun", HOOK], {
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir },
  });
  const p = join(dataDir, USAGE_FILE);
  return { code: r.exitCode, out: new TextDecoder().decode(r.stdout), usage: existsSync(p) ? readFileSync(p, "utf8") : "" };
}

describe("the hook end to end", () => {
  test("a Skill payload and an Agent payload each append one row; stdout stays empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "usage-"));
    const a = runHook(JSON.stringify({ ...base, tool_name: "Skill", tool_input: { skill: "rust-studio:dev-task" } }), dir);
    expect(a.code).toBe(0);
    expect(a.out).toBe("");
    const b = runHook(JSON.stringify({ ...base, tool_name: "Agent", tool_input: { subagent_type: "rust-studio:rust-builder", prompt: "build" } }), dir);
    expect(b.code).toBe(0);
    const rows = b.usage.trim().split("\n").map((l) => JSON.parse(l));
    expect(rows.map((r) => [r.kind, r.name, r.invoker])).toEqual([
      ["skill", "dev-task", "model"],
      ["agent", "rust-builder", "model"],
    ]);
  });
  test("malformed input: no write, no throw, exit 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "usage-"));
    for (const bad of ["", "{", "[]", "null", JSON.stringify({ tool_name: "Skill", tool_input: "review" }), JSON.stringify({ ...base, tool_name: "Bash", tool_input: { command: "cargo test" } })]) {
      const r = runHook(bad, dir);
      expect(r.code).toBe(0);
      expect(r.out).toBe("");
      expect(r.usage).toBe("");
    }
  });
});
