#!/usr/bin/env bun
// Rust Code Studio — session-wrap reminder (SessionEnd).
//
// The session is ending, so we cannot inject context for Claude — only surface a
// `systemMessage` to the USER. If the working tree has uncommitted Rust work,
// remind them to run /session-wrap so learnings get captured (via /remember) and
// spec statuses get updated before the context evaporates. Independently, list
// any leftover linked worktrees (agent-isolation leftovers accumulate fast —
// dozens of copies of the tree, eating disk and breaking repo gates that scan
// the filesystem) and point at /worktree-sweep.
//
// Non-blocking and cheap: dirty-tree and worktree checks with tight timeouts,
// and on any error (no git, slow git, not a repo) it falls back gracefully.
// Never fails the session.

import { join } from "node:path";
import { readInput, emit, done, watchdog, run, which, optionBool } from "./_lib.ts";

// Armed for the whole run — the git dirty-check child runs after stdin, so an
// early disarm would leave it unguarded. Watchdog fails open (exit 0).
//
// Budgeted for the TIGHTER host: Codex clamps a SessionEnd hook to 3s regardless
// of the declared timeout ("clamping SessionEnd hook timeout to Ns" is in its
// binary). A 10s watchdog there just means the process is killed mid-run while
// the config claims it is configured. Everything below fails open — the watchdog
// exits 0 and `dirty` defaults to true — so a tight budget degrades to "remind
// anyway", never to a hang or a missed reminder.
watchdog(2_200);

interface Input {
  cwd?: string;
}

const data = await readInput<Input>();

// Opt-out: studio config `lifecycle_notes` (default on) — also gates pre-compact.
if (!optionBool("lifecycle_notes", true)) done();

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
  const st = run(["git", "-C", cwd, "status", "--porcelain"], { timeout: 1_000 });
  if (st) dirty = st.stdout.trim().length > 0;
}

// Leftover linked worktrees: the first `git worktree list` entry is the main
// worktree; everything after it is a linked one. Agent-isolation worktrees
// (basename `agent-*`) are the usual accumulators — each is a full checkout,
// and repo scripts that scan the filesystem trip on their stale copies.
let worktreeNote = "";
if (which("git")) {
  const wt = run(["git", "-C", cwd, "worktree", "list"], { timeout: 5_000 });
  if (wt) {
    const paths = wt.stdout
      .trim()
      .split("\n")
      .map((l) => l.split(/\s+/)[0])
      .filter(Boolean);
    const extra = paths.slice(1);
    if (extra.length) {
      const agentMade = extra.filter((p) => /^agent-/.test(p.split("/").pop() ?? ""));
      worktreeNote =
        ` ${extra.length} leftover git worktree(s) detected` +
        (agentMade.length ? ` (${agentMade.length} look agent-created)` : "") +
        " — run /worktree-sweep to inspect and prune before they eat disk or " +
        "break local gates.";
    }
  }
}

if (!dirty && !worktreeNote) done();

emit({
  systemMessage:
    "Rust Code Studio: session ending." +
    (dirty
      ? " If you have uncommitted work, run /session-wrap " +
        "to capture durable learnings (via /remember) and update spec statuses before " +
        "the context is gone."
      : "") +
    worktreeNote,
  suppressOutput: true,
});
