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
//
// Drift reconciliation: the marker makes installation one-shot, which also means a key we depend on
// can go missing later (an edit, a /statusline run, a settings rewrite) and never come back —
// `refreshInterval` disappearing leaves time-based segments frozen, because Claude Code's re-render
// triggers are all conversation events, never a clock. So when `statusLine` still points at OUR
// script, top up only the keys we manage that are absent. A statusLine pointing anywhere else is
// left strictly alone, marker or not.
// Manage or remove with /progress-bar.

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { readInput, emit, watchdog, optionBool, pluginRoot } from "./_lib.ts";

export type InstallAction = "disabled" | "skip-marker" | "skip-existing" | "install" | "reconcile";

/** Keys the studio owns on its own `statusLine` entry, with the value to restore when one is
 *  missing. `refreshInterval` is here because Claude Code re-renders the status line only on
 *  conversation events (token usage, permission mode, vim mode, model, fast mode, effort, thinking,
 *  PR status) — never on a timer. Without it the duration and rate-limit segments freeze while the
 *  session sits idle. */
export const MANAGED_KEYS: Record<string, unknown> = { refreshInterval: 10 };

/** Does this `statusLine` entry point at the studio's own script? */
export function isOurStatusLine(statusLine: any, stableScript: string): boolean {
  const cmd = String(statusLine?.command || "");
  const target = String(stableScript || "").replace(/\\/g, "/");
  return !!cmd && !!target && cmd.replace(/\\/g, "/").includes(target);
}

/** Fill in managed keys that are absent. Never overwrites a value the user chose. */
export function reconcileStatusLine(statusLine: any): { changed: boolean; next: any } {
  const next: any = { ...(statusLine || {}) };
  let changed = false;
  for (const [k, v] of Object.entries(MANAGED_KEYS)) {
    if (next[k] === undefined) {
      next[k] = v;
      changed = true;
    }
  }
  return { changed, next };
}

/** Pure decision: what should the installer do? */
export function installDecision(s: {
  enabled: boolean;
  markerExists: boolean;
  hasStatusLine: boolean;
  isOurs?: boolean;
  needsReconcile?: boolean;
}): InstallAction {
  if (!s.enabled) return "disabled";
  // Reconciliation outranks the marker — that is the whole point of it.
  if (s.hasStatusLine && s.isOurs && s.needsReconcile) return "reconcile";
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

    const ours = isOurStatusLine(settings?.statusLine, stableScript);
    const recon = ours ? reconcileStatusLine(settings.statusLine) : { changed: false, next: null as any };
    const action = installDecision({
      enabled: true,
      markerExists: existsSync(marker),
      hasStatusLine: !!settings?.statusLine,
      isOurs: ours,
      needsReconcile: recon.changed,
    });

    if (action !== "install" && action !== "reconcile") {
      // Record that we've considered settings so we don't reconsider every session.
      if (action === "skip-existing") {
        try {
          writeFileSync(marker, "existing\n");
        } catch {}
      }
      disarm();
      process.exit(0);
    }

    // Back up before any write.
    try {
      if (existed) writeFileSync(settingsPath + ".bak", readFileSync(settingsPath, "utf8"));
    } catch {}

    if (action === "reconcile") {
      // Only tops up absent managed keys; every other key the user set is carried through.
      settings.statusLine = recon.next;
    } else {
      // Add ONLY our statusLine (preserve every other key).
      settings.statusLine = {
        type: "command",
        command: `bun "${stableScript.replace(/\\/g, "/")}"`,
        ...MANAGED_KEYS,
      };
    }
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    if (action === "install") {
      try {
        writeFileSync(marker, "installed\n");
      } catch {}
    }
    disarm();
    emit({
      systemMessage:
        action === "reconcile"
          ? "Rust Code Studio: restored missing status-line settings (" +
            Object.keys(MANAGED_KEYS).join(", ") +
            ") in ~/.claude/settings.json — time-based segments were frozen without them."
          : "Rust Code Studio: installed the live status line into ~/.claude/settings.json " +
            "(it appears on the next interaction; manage or remove it with /progress-bar).",
      suppressOutput: true,
    });
  } catch {
    disarm();
    process.exit(0);
  }
}
