#!/usr/bin/env bun
// Rust Code Studio — session-wrap reminder (SessionEnd).
//
// The session is ending, so we cannot inject context for Claude — only surface a
// `systemMessage` to the USER. If the working tree has uncommitted Rust work,
// remind them to run /session-wrap so learnings get captured (via /remember) and
// spec statuses get updated before the context evaporates.
//
// Non-blocking and cheap: a dirty-tree check with a tight timeout, and on any
// error (no git, slow git, not a repo) it falls back to a plain reminder. Never
// fails the session.

import { join } from "node:path";
import { readInput, emit, done, watchdog, run, which } from "./_lib.ts";

const disarm = watchdog();

interface Input {
  cwd?: string;
}

const data = await readInput<Input>();
disarm();

const cwd = data.cwd || process.cwd();

// Only meaningful inside a Rust project; if there's no manifest, stay silent.
try {
  if (!Bun.file(join(cwd, "Cargo.toml")).size) done();
} catch {
  done();
}

// Prefer to remind only when the tree is dirty; if we can't tell, remind anyway.
let dirty = true;
if (which("git")) {
  const st = run(["git", "-C", cwd, "status", "--porcelain"], { timeout: 5_000 });
  if (st) dirty = st.stdout.trim().length > 0;
}

if (!dirty) done();

emit({
  systemMessage:
    "Rust Code Studio: session ending. If you have uncommitted work, run /session-wrap " +
    "to capture durable learnings (via /remember) and update spec statuses before " +
    "the context is gone.",
  suppressOutput: true,
});
