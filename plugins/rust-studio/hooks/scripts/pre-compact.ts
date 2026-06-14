#!/usr/bin/env bun
// Rust Code Studio — compaction warning (PreCompact).
//
// Compaction is about to run. additionalContext is NOT supported here, so we only
// surface a `systemMessage` to the user: any in-flight plan held solely in the
// conversation can be dropped, so the active spec/plan must already live in a
// durable file (`.rust-studio/specs/<slug>/`).
//
// Non-blocking and cheap. Never fails the session.

import { readInput, emit, watchdog } from "./_lib.ts";

const disarm = watchdog(6_000);

await readInput();
disarm();

emit({
  systemMessage:
    "Rust Code Studio: compaction is about to run — anything held only in the " +
    "conversation (an in-flight plan or spec) may be dropped. Ensure the active " +
    "spec/plan is written to a durable file under `.rust-studio/specs/<slug>/` " +
    "before continuing.",
  suppressOutput: true,
});
