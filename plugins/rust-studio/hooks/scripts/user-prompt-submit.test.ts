// Tests for the UserPromptSubmit hook: prompt-scoped recall (which notes a prompt surfaces,
// and that a surfaced note is not repeated), the machine-prompt guard, and the user-typed
// skill detection that feeds the usage log.
import { test, expect, describe } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  pickPromptPointers,
  renderPointers,
  MIN_PROMPT_SCORE,
  readSurfaced,
  writeSurfaced,
  isMachinePrompt,
  MACHINE_PROMPT_PREFIXES,
  namesStudioSkill,
  studioSkillsNamed,
  userInvokedSkill,
} from "./user-prompt-submit.ts";
import { parseIndex } from "./memory-store.ts";

const HOOK = new URL("./user-prompt-submit.ts", import.meta.url).pathname;

const entries = parseIndex(
  [
    "- [Tokio runtime hang](tokio-runtime-hang.md) — select! loop starves the timer",
    "- [Registry cooldown](registry-cooldown.md) — global-min-publish-age = 3 days",
    "- [Guard blocks heredoc](irreversible-guard-heredoc.md) — installed hook, not working tree",
  ].join("\n"),
);

describe("pickPromptPointers", () => {
  test("a prompt naming the topic surfaces the note; unrelated notes stay silent", () => {
    const picks = pickPromptPointers(entries, "why does the tokio runtime hang after select!", new Set());
    expect(picks.map((p) => p.file)).toEqual(["tokio-runtime-hang.md"]);
    expect(picks[0].score).toBeGreaterThanOrEqual(MIN_PROMPT_SCORE);
  });
  test("one shared hook word is not a recall", () => {
    expect(pickPromptPointers(entries, "how many days until the release", new Set())).toEqual([]);
  });
  test("an already-surfaced note is not repeated; a short/stop-word prompt yields nothing", () => {
    expect(pickPromptPointers(entries, "tokio runtime hang", new Set(["tokio-runtime-hang.md"]))).toEqual([]);
    expect(pickPromptPointers(entries, "continue", new Set())).toEqual([]);
    expect(pickPromptPointers(entries, "", new Set())).toEqual([]);
  });
});

describe("renderPointers", () => {
  test("names the note, its label, hook, and absolute path", () => {
    const picks = pickPromptPointers(entries, "registry cooldown", new Set());
    const text = renderPointers("/m", picks, () => " (convention, 3d)");
    expect(text).toContain("a note matches this prompt");
    expect(text).toContain("**Registry cooldown** (convention, 3d) — global-min-publish-age = 3 days → `/m/registry-cooldown.md`");
  });
});

describe("surfaced marker", () => {
  test("round-trips per session", () => {
    const sid = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    expect(readSurfaced(sid).size).toBe(0);
    writeSurfaced(sid, new Set(["a.md", "b.md"]));
    expect([...readSurfaced(sid)]).toEqual(["a.md", "b.md"]);
  });
});

// Every sample below is the head of a real prompt from the 2026-08/09 transcripts. The
// route hint this hook used to carry fired 114 of 123 times on the first shape alone.
const MACHINE_SAMPLES: string[] = [
  '<task-notification>\n<task-id>a0d5f4e3159d3d333</task-id>\n<tool-use-id>toolu_01DvjfUH5XktiJXepDNf4QSz</tool-use-id>\n<status>completed</status>\n<summary>Agent "Rust capability baseline" finished</summary>\n<note>A task-notification fires each time this agent stops</note>\n</task-notification>',
  "<task-notification>\n<summary>Goal check-in: background work still running</summary>\n</task-notification>\n<system-reminder>\nGoal check-in: «возьми какой то новый issue в решение через /dev-task» is still active",
  '<teammate-message teammate_id="team-lead">\nRepo: /home/vanyastaff/orca/workspaces/flui/walleye (git worktree). Read-only — do not edit.\n\nAudit the **re-entrancy and interior-mutability** surface of `crates/flui-widgets/src/navigator/`',
  '<agent-message agent_id="rust-reviewer-1">Semver review of the public surface finished — NEEDS WORK, 2 blockers.</agent-message>',
  "<local-command-stdout>✔ Updated Rust Code Studio. Run /reload-plugins to apply.</local-command-stdout>",
  "[Request interrupted by user]",
  "<command-name>/clear</command-name>\n            <command-message>clear</command-message>\n            <command-args></command-args>",
  "<command-message>rust-studio:resolve-pr</command-message>\n<command-name>/rust-studio:resolve-pr</command-name>",
  "<bash-stdout></bash-stdout><bash-stderr>sudo: A terminal is required to authenticate\n</bash-stderr>",
  "<bash-stderr>error: no such command: `nextest`\n</bash-stderr>",
  "<bash-input> sudo mkdir -p -m 755 /etc/apt/keyrings && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg",
  "Stop hook feedback:\n[bun \"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop-guard.ts\"]: the final message claims done without evidence",
  "Goal check-in: «мержи 259 когда пройдёт» is still active; the last turn ended without progress on it.",
  "Base directory for this skill: /home/me/.claude/plugins/cache/vanya/rust-studio/0.52.2/skills/resolve-pr\n\n# /resolve-pr — work through PR feedback",
  "  \n<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n</task-notification>",
  "<system-reminder>\nThe user opened the file /home/me/proj/src/lib.rs in the IDE.\n</system-reminder>",
];

const HUMAN_SAMPLES: string[] = [
  "мержи 259 когда пройдёт",
  "запусти агентов снова",
  "проверь роутинг и ссылки и оркестр работу и harmess и тд",
  "/review the diff before we merge it",
  "The release binary of our small Rust CLI is 48 MB. Why, and how do we shrink it?",
  "[Image #1] верны ли данные на скрине?",
  "Here is what the notification said, is it right?\n\n<task-notification>\n<status>completed</status>\n</task-notification>",
  "This session is being continued from a previous conversation that ran out of context.",
  "continue",
];

describe("isMachinePrompt", () => {
  for (const s of MACHINE_SAMPLES) {
    test(`machine: ${JSON.stringify(s.trimStart().slice(0, 44))}…`, () => {
      expect(isMachinePrompt(s)).toBe(true);
    });
  }
  for (const s of HUMAN_SAMPLES) {
    test(`human: ${JSON.stringify(s.slice(0, 44))}…`, () => {
      expect(isMachinePrompt(s)).toBe(false);
    });
  }
  test("a non-string is not a machine prompt (nor a human one — the caller checks emptiness)", () => {
    expect(isMachinePrompt(undefined)).toBe(false);
    expect(isMachinePrompt(42)).toBe(false);
  });
  test("every prefix the guard knows is exercised by a sample", () => {
    const heads = MACHINE_SAMPLES.map((s) => s.trimStart());
    for (const p of MACHINE_PROMPT_PREFIXES) expect(heads.some((h) => h.startsWith(p))).toBe(true);
  });
});

describe("studioSkillsNamed — a typed /skill is a user invocation", () => {
  test("a slash token is a skill invocation only when it names a shipped skill, not a path", () => {
    expect(namesStudioSkill("/review the last commit")).toBe(true);
    expect(namesStudioSkill("run /rust-studio:audit-unsafe on src/raw.rs")).toBe(true);
    expect(namesStudioSkill("Review /home/me/proj/src/ffi.rs before we merge")).toBe(false);
    expect(namesStudioSkill("logs at /tmp/ci.log, and the crate is under /workspace/crates/core")).toBe(false);
    expect(namesStudioSkill("what is in /etc here")).toBe(false);
  });
  test("names are returned bare, in order, without the namespace or duplicates", () => {
    expect(studioSkillsNamed("/rust-studio:dev-task https://github.com/x/y/issues/536")).toEqual(["dev-task"]);
    expect(studioSkillsNamed("/spec then /spec-tasks, then /spec again")).toEqual(["spec", "spec-tasks"]);
    expect(studioSkillsNamed("мержи 259 когда пройдёт")).toEqual([]);
  });
  test("an invocation is a leading /name — what the host expands as a command; a mention is not", () => {
    expect(userInvokedSkill("/rust-studio:dev-task https://github.com/x/y/issues/536")).toBe("dev-task");
    expect(userInvokedSkill("  /review src/lib.rs")).toBe("review");
    expect(userInvokedSkill("/review")).toBe("review");
    expect(userInvokedSkill("вместо полного /dev-task ты сделал коммит")).toBeNull();
    expect(userInvokedSkill("/compact")).toBeNull();
    expect(userInvokedSkill("/run/media/me/STORAGE/memory тут еще есть")).toBeNull();
    expect(userInvokedSkill("/code-review high pr 1020")).toBeNull();
  });
});

/** Run the hook end to end with its own data directory; returns stdout and the usage log. */
function runHook(payload: unknown, dataDir: string): { out: string; usage: string; code: number | null } {
  const r = Bun.spawnSync(["bun", HOOK], {
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir, CLAUDE_PLUGIN_OPTION_MEMORY_RECALL: "off" },
  });
  const usagePath = join(dataDir, "usage.jsonl");
  return { out: new TextDecoder().decode(r.stdout), usage: existsSync(usagePath) ? readFileSync(usagePath, "utf8") : "", code: r.exitCode };
}

describe("the hook end to end", () => {
  test("a machine-generated prompt gets nothing, spends no nudge, logs nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "ups-"));
    const sid = `s-${Date.now()}`;
    const first = runHook({ session_id: sid, prompt: MACHINE_SAMPLES[0], cwd: dir }, dir);
    expect(first.code).toBe(0);
    expect(first.out).toBe("");
    expect(first.usage).toBe("");
    // the first HUMAN prompt of the session still carries the once-per-session nudge
    const second = runHook({ session_id: sid, prompt: "мержи 259 когда пройдёт", cwd: dir }, dir);
    expect(second.out).toContain("prefer a studio skill");
    const third = runHook({ session_id: sid, prompt: "запусти агентов снова", cwd: dir }, dir);
    expect(third.out).toBe("");
  });

  test("a typed /skill is logged as a user invocation; a mention mid-prompt is not", () => {
    const dir = mkdtempSync(join(tmpdir(), "ups-"));
    const r = runHook({ session_id: "s-log", prompt: "/rust-studio:review the diff, then /spec if it grows; /home/me is a path", cwd: "/home/me/proj" }, dir);
    expect(r.code).toBe(0);
    const rows = r.usage.trim().split("\n").map((l) => JSON.parse(l));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ session_id: "s-log", cwd: "/home/me/proj", kind: "skill", name: "review", invoker: "user" });
    expect(Number.isNaN(Date.parse(rows[0].ts))).toBe(false);
    const mention = runHook({ session_id: "s-log", prompt: "почему вместо /dev-task ты сделал коммит?", cwd: "/home/me/proj" }, dir);
    expect(mention.usage.trim().split("\n")).toHaveLength(1);
  });

  test("a /skill inside a machine-generated prompt is not a user invocation", () => {
    const dir = mkdtempSync(join(tmpdir(), "ups-"));
    const r = runHook({ session_id: "s-m", prompt: MACHINE_SAMPLES[1], cwd: dir }, dir);
    expect(r.usage).toBe("");
  });
});
