#!/usr/bin/env bun
// Rust Code Studio — status-line auto-install (SessionStart).
//
// A plugin may NOT ship a top-level `statusLine` (only `agent` + `subagentStatusLine`), so to make
// the rich studio status line ON BY DEFAULT this hook installs it into the user's
// `~/.claude/settings.json` ONCE: it copies `statusline.ts` to a stable path and points
// `settings.statusLine` there. Safeguards:
//   * gated by the `statusline` userConfig flag (default on),
//   * NEVER clobbers an existing `statusLine` (yours wins),
//   * writes a one-time marker so it never re-edits settings after the first handling,
//   * backs up settings.json before writing, and refuses to write if settings is malformed,
//   * fail-open: any error exits 0, never breaking the session.
// Manage or remove with /progress-bar.

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { readInput, emit, watchdog, optionBool, pluginRoot } from "./_lib.ts";

export type InstallAction = "disabled" | "skip-marker" | "skip-existing" | "install";

/** Pure decision: what should the installer do? */
export function installDecision(s: {
  enabled: boolean;
  markerExists: boolean;
  hasStatusLine: boolean;
}): InstallAction {
  if (!s.enabled) return "disabled";
  if (s.markerExists) return "skip-marker";
  if (s.hasStatusLine) return "skip-existing";
  return "install";
}

if (import.meta.main) {
  const disarm = watchdog(8000);
  try {
    if (!optionBool("statusline", true)) {
      disarm();
      process.exit(0);
    }
    await readInput(1500);

    const home = homedir();
    const stableDir = join(home, ".claude", "rust-studio");
    const stableScript = join(stableDir, "statusline.ts");
    const marker = join(stableDir, ".statusline-handled");
    const settingsPath = join(home, ".claude", "settings.json");

    // Keep the stable copy fresh across plugin updates (cheap, harmless even if unused).
    try {
      mkdirSync(stableDir, { recursive: true });
      copyFileSync(join(pluginRoot(), "scripts", "statusline.ts"), stableScript);
    } catch {
      /* ignore copy errors */
    }

    // Read settings — but if it exists and is malformed, NEVER touch it (avoid data loss).
    let settings: any = {};
    let existed = false;
    if (existsSync(settingsPath)) {
      existed = true;
      try {
        settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      } catch {
        disarm();
        process.exit(0); // malformed → leave it strictly alone
      }
    }

    const action = installDecision({
      enabled: true,
      markerExists: existsSync(marker),
      hasStatusLine: !!settings?.statusLine,
    });

    if (action !== "install") {
      // Record that we've considered settings so we don't reconsider every session.
      if (action === "skip-existing") {
        try {
          writeFileSync(marker, "existing\n");
        } catch {}
      }
      disarm();
      process.exit(0);
    }

    // Back up, then add ONLY our statusLine (preserve every other key).
    try {
      if (existed) writeFileSync(settingsPath + ".bak", readFileSync(settingsPath, "utf8"));
    } catch {}
    settings.statusLine = {
      type: "command",
      command: `bun "${stableScript.replace(/\\/g, "/")}"`,
      refreshInterval: 10,
    };
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    try {
      writeFileSync(marker, "installed\n");
    } catch {}
    disarm();
    emit({
      systemMessage:
        "Rust Code Studio: installed the live status line into ~/.claude/settings.json " +
        "(it appears on the next interaction; manage or remove it with /progress-bar).",
      suppressOutput: true,
    });
  } catch {
    disarm();
    process.exit(0);
  }
}
