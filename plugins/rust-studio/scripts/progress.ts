#!/usr/bin/env bun
// Rust Code Studio — progress status-file writer.
//
// Orchestrating skills call this at phase boundaries (only when `progress_tracking` is on) so the
// opt-in `/progress-bar` status line can show the live phase + task count. Writes
// `<project>/.rust-studio/progress.json`. Best-effort — never blocks the skill on failure.
//
//   bun progress.ts set --phase <name> [--step <n/total>] [--tasks <n/total>] [--note "..."]
//   bun progress.ts clear
//
// <project> = $CLAUDE_PROJECT_DIR if set, else the current working directory.

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dir = join(root, ".rust-studio");
const file = join(dir, "progress.json");
const cmd = process.argv[2];

try {
  if (cmd === "clear") {
    rmSync(file, { force: true });
  } else if (cmd === "set") {
    const phase = flag("phase");
    if (!phase) {
      process.stderr.write("progress.ts: `set` requires --phase\n");
      process.exit(1);
    }
    mkdirSync(dir, { recursive: true });
    const rec: Record<string, unknown> = { phase, ts: Date.now() };
    const step = flag("step");
    if (step) rec.step = step;
    const tasks = flag("tasks");
    if (tasks) rec.tasks = tasks;
    const note = flag("note");
    if (note) rec.note = note;
    writeFileSync(file, JSON.stringify(rec));
  } else {
    process.stderr.write(
      "usage: progress.ts set --phase <name> [--step n/total] [--tasks n/total] [--note ..] | clear\n",
    );
    process.exit(1);
  }
} catch (e) {
  // Visibility is a nicety — never fail the orchestration because of it.
  process.stderr.write("progress.ts: " + (e as Error).message + "\n");
  process.exit(1);
}
