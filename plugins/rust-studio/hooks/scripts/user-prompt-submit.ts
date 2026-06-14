#!/usr/bin/env bun
// Rust Code Studio — routing nudge (UserPromptSubmit).
//
// For UserPromptSubmit the documented mechanism is the simplest one: whatever the
// hook prints to stdout on exit 0 is added to the prompt context. So we emit a
// short, generic pointer — prefer a studio skill over ad-hoc steps, and /recall
// the area before implementing — without parsing the prompt or blocking it.
//
// Kept to ~1-2 lines so it doesn't bloat every turn. Never blocks (no
// decision:block) and never fails the session.

import { readInput, watchdog } from "./_lib.ts";

const disarm = watchdog(6_000);

await readInput();
disarm();

process.stdout.write(
  "Rust Code Studio: for any non-trivial task, prefer a studio skill (`/help` " +
    "for the catalog) over ad-hoc steps, and run `/recall <area>` before " +
    "implementing in a known area so prior decisions and gotchas carry forward.",
);
process.exit(0);
