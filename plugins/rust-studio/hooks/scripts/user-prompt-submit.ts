#!/usr/bin/env bun
// Rust Code Studio — routing nudge (UserPromptSubmit).
//
// For UserPromptSubmit the documented mechanism is the simplest one: whatever the
// hook prints to stdout on exit 0 is added to the prompt context. So we emit a
// short, generic pointer — prefer a studio skill over ad-hoc steps, and /recall
// the area before implementing — without parsing the prompt or blocking it.
//
// Emitted ONCE per session (a tmp marker dedupes) so the same line doesn't repeat
// every turn — repeated identical tokens just accumulate and dilute attention as a
// session grows (measured by tools/context-cost.ts). Never blocks (no
// decision:block) and never fails the session.

import { readInput, watchdog, optionBool } from "./_lib.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const disarm = watchdog(6_000);

const data = await readInput<{ session_id?: string }>();
disarm();

// Opt-out: studio config `routing_nudge` (default on).
if (!optionBool("routing_nudge", true)) process.exit(0);

// Dedupe to once per session; fail-open (emit if the fs check errors).
try {
  const dir = join(tmpdir(), "rust-studio-nudge");
  const sid = (data.session_id || "nosession").replace(/[^A-Za-z0-9]/g, "_");
  const marker = join(dir, sid);
  if (existsSync(marker)) process.exit(0); // already nudged this session
  mkdirSync(dir, { recursive: true });
  writeFileSync(marker, "1");
} catch {
  /* emit anyway */
}

process.stdout.write(
  "Rust Code Studio: for any non-trivial task, prefer a studio skill (`/help` " +
    "for the catalog) over ad-hoc steps, and run `/recall <area>` before " +
    "implementing in a known area so prior decisions and gotchas carry forward.",
);
process.exit(0);
