#!/usr/bin/env bun
// Rust Code Studio — progress status-file writer.
//
// Orchestrating skills call this at phase boundaries (only when `progress_tracking` is on) so the
// opt-in `/progress-bar` status line can show the live phase. Writes
// `<project>/.rust-studio/progress.json`. Best-effort: never blocks the skill on failure.
//
//   bun progress.ts set "<phase>" ["<step>"] ["<note>"]
//   bun progress.ts clear
//
// <project> = $CLAUDE_PROJECT_DIR if set, else the current working directory.

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dir = join(root, ".rust-studio");
const file = join(dir, "progress.json");
const [cmd, phase, step, note] = process.argv.slice(2);

try {
  if (cmd === "clear") {
    rmSync(file, { force: true });
  } else if (cmd === "set" && phase) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ phase, step: step || "", note: note || "", ts: Date.now() }),
    );
  } else {
    process.stderr.write("usage: progress.ts set <phase> [step] [note] | clear\n");
    process.exit(1);
  }
} catch (e) {
  // Visibility is a nicety — never fail the orchestration because of it.
  process.stderr.write("progress.ts: " + (e as Error).message + "\n");
  process.exit(1);
}
