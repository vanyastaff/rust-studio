#!/usr/bin/env bun
// Rust Code Studio — formatting nudge (Stop).
//
// When Claude finishes a turn, if any .rs files changed and they are not
// rustfmt-clean, surface a non-blocking systemMessage suggesting /lint.
//
// HARD RULE: this runs on the hot path (end of every turn), so it must never
// block the session. Every child process has a tight timeout; on cargo/git
// being slow or absent it bails silently. The earlier Python version ran
// `cargo fmt --all --check` with a 90s budget — on a cold/large workspace that
// froze the turn for up to a minute and a half. That is the bug this fixes.

import { join } from "node:path";
import { readInput, emit, done, watchdog, run, which } from "./_lib.ts";

const disarm = watchdog(12_000);

interface Input {
  cwd?: string;
}

const data = await readInput<Input>();
disarm();

const cwd = data.cwd || process.cwd();

// Cheap gate first: is this even a Rust project with cargo + git available?
try {
  if (!Bun.file(join(cwd, "Cargo.toml")).size) done();
} catch {
  done();
}
if (!which("cargo") || !which("git")) done();

// Did any .rs file change? Fast git queries, tight timeouts.
function changedRs(): boolean {
  const diff = run(["git", "-C", cwd, "diff", "--name-only", "HEAD"], { timeout: 5_000 });
  const others = run(["git", "-C", cwd, "ls-files", "--others", "--exclude-standard"], { timeout: 5_000 });
  if (!diff && !others) return false;
  const names = (diff?.stdout || "") + "\n" + (others?.stdout || "");
  return names.split("\n").some((l) => l.trim().endsWith(".rs"));
}

if (!changedRs()) done();

// Format check, hard-capped at 8s. If it times out (null), stay silent — better
// a missed nudge than a frozen turn. /lint and CI remain the real gate.
const res = run(["cargo", "fmt", "--all", "--check"], { cwd, timeout: 8_000 });
if (res && res.exitCode !== 0) {
  emit({
    systemMessage:
      "Rust Code Studio: some changed .rs files are not rustfmt-clean. " +
      "Run /lint (or `cargo fmt`) before committing.",
    suppressOutput: true,
  });
}
done();
