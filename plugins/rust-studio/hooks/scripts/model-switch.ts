#!/usr/bin/env bun
// Rust Code Studio — model-switch note (PostModelSwitch, Claude Code ≥ 2.1.251).
//
// Fires after the session (or a sub-agent) changes model: a `/model` call, or the
// automatic fallback when a safety classifier flags a request (Fable → Opus 5 / Opus 4.8,
// Opus 5 → Opus 4.8). The studio's model policy (docs/claude-5-compat.md) is that a gate
// never judges below the model that wrote the code, and that the judgment-heavy agents
// `inherit` the session model — so a silent switch moves every gate with it. This hook
// makes the switch visible to the model doing the work and says what to do about it.
//
// PostModelSwitch honors plain-text stdout as context for the model (no
// additionalContext, no blocking). Inside a sub-agent (`agent_id` present) the note
// reaches that sub-agent; in the main session it reaches the orchestrator. Rare event,
// two sentences, never fails the session.

import { readInput, watchdog, optionBool } from "./_lib.ts";

export interface Input {
  from_model?: string;
  to_model?: string;
  agent_id?: string;
  agent_type?: string;
}

/** Human-readable model family from a canonical id (`claude-opus-4-8` → `Opus 4.8`). */
export function modelLabel(id?: string): string {
  const s = String(id ?? "").trim();
  if (!s) return "(unknown)";
  const m = /claude-([a-z]+)-(\d+)(?:-(\d+))?/i.exec(s);
  if (!m) return s;
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  return `${family} ${m[2]}${m[3] ? "." + m[3] : ""}`;
}

/** Pure: the note to inject, or "" when there is nothing worth saying. */
export function switchNote(input: Input): string {
  const from = modelLabel(input.from_model);
  const to = modelLabel(input.to_model);
  if (!input.to_model || input.from_model === input.to_model) return "";
  const who = input.agent_type ? `\`${input.agent_type}\`` : "this sub-agent";
  if (input.agent_id) {
    return (
      `Rust Code Studio: ${who} switched model ${from} → ${to} mid-task (a classifier ` +
      `fallback or a model pin). Finish the task on ${to} and state that model next to ` +
      `your verdict's evidence, so the orchestrator knows which model judged.`
    );
  }
  return (
    `Rust Code Studio: session model switched ${from} → ${to}. Agents that inherit the ` +
    `session model (directors, harsh-critic, rust-reviewer, unsafe-auditor) now judge on ` +
    `${to}. If this was a classifier fallback, finish the current unit here, then ` +
    `\`/model ${input.from_model}\` to return; re-run any review or audit verdict that ` +
    `was issued on the weaker model before treating it as a gate pass.`
  );
}

if (import.meta.main) {
  const disarm = watchdog(4_000);
  const data = await readInput<Input>();
  disarm();
  if (!optionBool("lifecycle_notes", true)) process.exit(0);
  const note = switchNote(data);
  if (note) process.stdout.write(note);
  process.exit(0);
}
