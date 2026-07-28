#!/usr/bin/env bun
// Rust Code Studio — compaction warning (PreCompact).
//
// Compaction is about to run. additionalContext is NOT supported here, so we only
// surface a `systemMessage` to the user: any in-flight plan held solely in the
// conversation can be dropped, so the active spec/plan must already live in a
// durable file (`.rust-studio/specs/<slug>/`).
//
// It also re-arms rule injection. inject-rules announces each standard once per
// session and then stays quiet; compaction is the moment that announcement can
// actually leave the context, so clearing its markers here re-announces the rules
// exactly when they were lost — rather than on a fixed schedule or per file.
//
// Non-blocking and cheap. Never fails the session.

import { readInput, emit, watchdog, optionBool } from "./_lib.ts";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const disarm = watchdog(6_000);

const data = await readInput<{ session_id?: string }>();
disarm();

// Re-arm before the opt-out check: `lifecycle_notes` silences the NOTICE below,
// not the studio's standards. Fail-open — a tmp error just leaves rules quiet.
if (data.session_id) {
  try {
    const dir = join(tmpdir(), "rust-studio-rules");
    const prefix = `${String(data.session_id).replace(/[^A-Za-z0-9]/g, "_")}__rule__`;
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (f.startsWith(prefix)) rmSync(join(dir, f), { force: true });
      }
    }
  } catch {
    /* non-fatal */
  }
}

// Opt-out: studio config `lifecycle_notes` (default on) — also gates session-end.
if (!optionBool("lifecycle_notes", true)) process.exit(0);

emit({
  systemMessage:
    "Rust Code Studio: compaction is about to run — anything held only in the " +
    "conversation (an in-flight plan or spec) may be dropped. Ensure the active " +
    "spec/plan is written to a durable file under `.rust-studio/specs/<slug>/` " +
    "before continuing.",
  suppressOutput: true,
});
