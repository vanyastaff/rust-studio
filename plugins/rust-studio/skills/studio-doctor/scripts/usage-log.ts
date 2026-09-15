#!/usr/bin/env bun
// Rust Code Studio — usage log (PostToolUse on Skill | Agent).
//
// One JSON line per skill invocation or sub-agent spawn, appended to
// `<plugin data>/usage.jsonl`:
//
//   {"ts":"2026-09-14T20:01:02.003Z","session_id":"…","cwd":"/home/me/proj",
//    "kind":"skill","name":"review","invoker":"model"}
//
// Why a log and not the transcripts: the question "which skills does anyone use?" took an
// audit over 1.7 GB of session files to answer once, and the answer it gave — 22 of 64 ever
// invoked — could not separate need from noise, because the hook that was supposed to route
// prompts to skills fired on sub-agent notifications. This file is the instrument for the
// next answer: `usage-report.ts` reads it in one command, per skill and per agent, per project
// and per session, with an explicit "never invoked" list against what ships on disk.
//
// Two hands write it. The model's — this hook, on the Skill tool (`tool_input.skill`) and the
// Agent tool (`tool_input.subagent_type`); both field names verified against the installed
// Claude Code bundle, not the docs. And the user's — a typed `/review` never passes through
// the Skill tool, so the UserPromptSubmit hook appends the same row with `invoker: "user"`.
// On Codex the same event carries `tool_name: "spawn_agent"` with `tool_input.agent_type`
// (schema read from the Codex binary); skills there are read, not called, so only the agent
// rows arrive.
//
// Local and private: the log stays in the plugin's data directory, is read by nothing but the
// report, and holds no prompt text — a name, a directory, a session id, a timestamp. Roughly
// a hundred bytes per row. The session-start sweep that clears stale markers leaves it alone.
//
// Fail-open like every studio hook: a malformed payload, an unwritable directory, a name that
// is not a string — nothing is written and the exit code is 0 either way.

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { pluginData, readInput, watchdog } from "./_lib.ts";

export const USAGE_FILE = "usage.jsonl";

export type UsageKind = "skill" | "agent";
export type UsageInvoker = "model" | "user";

export interface UsageRow {
  ts: string;
  session_id: string;
  cwd: string;
  kind: UsageKind;
  name: string;
  invoker: UsageInvoker;
}

/** Where the log lives: `<plugin data>/usage.jsonl`. */
export function usagePath(): string {
  return join(pluginData(), USAGE_FILE);
}

/** The plugin's own namespace is dropped (`rust-studio:review` → `review`) so a row matches a
 *  directory under `skills/` or `agents/`. Another plugin's prefix stays: `other:review` is
 *  not the studio's `review`, and the report lists it as outside the studio. */
export function studioName(raw: string): string {
  return raw.trim().replace(/^rust-studio:/, "");
}

/** The tool names that mean "a skill was invoked" or "an agent was spawned", per host. `Task`
 *  is the Agent tool's earlier name and still appears in older transcripts. */
const SKILL_TOOLS = new Set(["Skill"]);
const AGENT_TOOLS = new Set(["Agent", "Task", "spawn_agent"]);

/** Pure: the row a PostToolUse payload describes, or null when the payload is not a skill or
 *  agent call, or names nothing. An Agent call without a `subagent_type` runs the host's
 *  general-purpose agent, which is what it is recorded as. */
export function rowFromPayload(data: unknown): Omit<UsageRow, "ts"> | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { tool_name?: unknown; tool_input?: unknown; session_id?: unknown; cwd?: unknown };
  if (typeof d.tool_name !== "string") return null;
  const input = d.tool_input && typeof d.tool_input === "object" ? (d.tool_input as Record<string, unknown>) : {};
  let kind: UsageKind;
  let raw: unknown;
  if (SKILL_TOOLS.has(d.tool_name)) {
    kind = "skill";
    raw = input.skill;
  } else if (AGENT_TOOLS.has(d.tool_name)) {
    kind = "agent";
    raw = input.subagent_type ?? input.agent_type ?? (d.tool_name === "spawn_agent" ? undefined : "general-purpose");
  } else {
    return null;
  }
  if (typeof raw !== "string") return null;
  const name = studioName(raw);
  if (!name || /[\s"\\]/.test(name)) return null;
  return {
    session_id: typeof d.session_id === "string" ? d.session_id : "",
    cwd: typeof d.cwd === "string" ? d.cwd : "",
    kind,
    name,
    invoker: "model",
  };
}

/** Append one row. Returns whether it was written; never throws. */
export function appendUsage(row: Omit<UsageRow, "ts"> & { session_id?: unknown; cwd?: unknown }): boolean {
  try {
    const line: UsageRow = {
      ts: new Date().toISOString(),
      session_id: typeof row.session_id === "string" ? row.session_id : "",
      cwd: typeof row.cwd === "string" ? row.cwd : "",
      kind: row.kind,
      name: row.name,
      invoker: row.invoker,
    };
    appendFileSync(usagePath(), JSON.stringify(line) + "\n");
    return true;
  } catch {
    return false;
  }
}

/** One parsed line of the log, or null for anything that is not a well-formed row. */
export function parseUsageLine(line: string): UsageRow | null {
  try {
    const o = JSON.parse(line);
    if (!o || typeof o !== "object") return null;
    const { ts, session_id, cwd, kind, name, invoker } = o as Record<string, unknown>;
    if (typeof ts !== "string" || Number.isNaN(Date.parse(ts))) return null;
    if (kind !== "skill" && kind !== "agent") return null;
    if (invoker !== "model" && invoker !== "user") return null;
    if (typeof name !== "string" || !name) return null;
    return {
      ts,
      session_id: typeof session_id === "string" ? session_id : "",
      cwd: typeof cwd === "string" ? cwd : "",
      kind,
      name,
      invoker,
    };
  } catch {
    return null;
  }
}

const HELP = `usage-log — the PostToolUse hook that appends skill invocations and agent spawns

  bun usage-log.ts < <PostToolUse payload>

Reads one hook payload from stdin; on a Skill call (tool_input.skill), an Agent call
(tool_input.subagent_type) or a Codex spawn_agent call (tool_input.agent_type) it appends one
JSON line to <plugin data>/usage.jsonl. Anything else writes nothing. Always exits 0 and
prints nothing; usage-report.ts reads what it wrote.
`;

if (import.meta.main) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  const disarm = watchdog(5_000);
  const data = await readInput();
  const row = rowFromPayload(data);
  if (row) appendUsage(row);
  disarm();
  process.exit(0);
}
