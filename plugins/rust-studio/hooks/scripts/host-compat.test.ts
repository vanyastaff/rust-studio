import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const helper = fileURLToPath(new URL("./_lib.ts", import.meta.url));
const memory = fileURLToPath(new URL("./memory-store.ts", import.meta.url));
const state = mkdtempSync(join(tmpdir(), "rs-host-compat-"));
afterAll(() => rmSync(state, { recursive: true, force: true }));

function invoke(source: string, codex: boolean) {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: state,
    PLUGIN_ROOT: root, PLUGIN_DATA: state, CLAUDE_CONFIG_DIR: state,
    RUST_STUDIO_STOP_GUARD: "on" };
  if (!codex) delete env.PLUGIN_ROOT;
  return Bun.spawnSync([process.execPath, "-e", source], {
    cwd: state, env, stdout: "pipe", stderr: "pipe", timeout: 10_000,
  });
}

describe("current host hook contracts", () => {
  test.each(["SessionStart", "PreToolUse", "SubagentStart"])("Codex %s returns documented event context", (event) => {
    const r = invoke(`import { emitAdditionalContext } from ${JSON.stringify(helper)}; emitAdditionalContext(${JSON.stringify(event)}, "workspace rules", { sessionTitle: "Claude-only" });`, true);
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout.toString())).toEqual({ hookSpecificOutput: {
      hookEventName: event, additionalContext: "workspace rules",
    } });
  });

  test("Codex prompt context stays JSON when both host root aliases exist", () => {
    const r = invoke(`import { emitUserPromptContext } from ${JSON.stringify(helper)}; emitUserPromptContext("rules");`, true);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain('"hookEventName":"UserPromptSubmit"');
    expect(JSON.parse(r.stdout.toString()).hookSpecificOutput.additionalContext).toBe("rules");
  });

  test("Codex Stop blocks through JSON with compatibility aliases present", () => {
    const r = invoke(`import { blockStop } from ${JSON.stringify(helper)}; blockStop("unfinished ledger");`, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr.toString()).toBe("");
    expect(JSON.parse(r.stdout.toString())).toEqual({ decision: "block", reason: "unfinished ledger" });
  });

  test("Codex does not mistake the compatibility alias for Claude auto-memory", () => {
    const r = invoke(`import { resolveStore } from ${JSON.stringify(memory)}; console.log(JSON.stringify(resolveStore(process.cwd())));`, true);
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout.toString()).hostInjectsIndex).toBe(false);
  });

  test("Claude prompt and Stop behavior remains native", () => {
    const prompt = invoke(`import { emitUserPromptContext } from ${JSON.stringify(helper)}; emitUserPromptContext("rules");`, false);
    expect(prompt.exitCode).toBe(0);
    expect(prompt.stdout.toString()).toBe("rules");
    const stop = invoke(`import { blockStop } from ${JSON.stringify(helper)}; blockStop("unfinished ledger");`, false);
    expect(stop.exitCode).toBe(2);
    expect(stop.stdout.toString()).toBe("");
    expect(stop.stderr.toString()).toBe("unfinished ledger");
  });
});
