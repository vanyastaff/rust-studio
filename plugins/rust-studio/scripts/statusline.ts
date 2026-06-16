#!/usr/bin/env bun
// Rust Code Studio — main status line (OPT-IN).
//
// A plugin may NOT ship a top-level `statusLine` (only `agent` + `subagentStatusLine`), so this
// is wired into the user's settings.json by the `/progress-bar` skill. It shows
// model · context% · and, when a studio orchestration is running, the current phase read from
// `<project>/.rust-studio/progress.json` (written by orchestrating skills via progress.ts).
//
// Input: session JSON on stdin (model.display_name, context_window.used_percentage,
// workspace.{current_dir,project_dir}, cwd). Output: one short line. Never throws.

import { join } from "node:path";

interface Progress {
  phase?: string;
  step?: string;
  note?: string;
  ts?: number;
}

const STALE_MS = 3_600_000; // ignore a progress file older than 1h (left over from a past run)

/** Pure: build the status line from session JSON + optional progress. */
export function render(session: any, progress: Progress | null): string {
  const model = session?.model?.display_name || session?.model?.id || "";
  const pct = session?.context_window?.used_percentage;
  const dir = session?.workspace?.current_dir || session?.cwd || "";
  const proj = dir ? dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : "";

  const parts: string[] = ["🦀 rust-studio"];
  if (proj) parts.push(proj);
  if (progress?.phase) parts.push(`▸ ${progress.phase}${progress.step ? " " + progress.step : ""}`);
  if (model) parts.push(model);
  if (typeof pct === "number") parts.push(`ctx ${Math.round(pct)}%`);
  return parts.join("  ·  ");
}

/** Pure: accept a progress object only if it is fresh. */
export function freshProgress(p: any, now = Date.now()): Progress | null {
  if (!p || typeof p !== "object" || !p.phase) return null;
  if (p.ts && now - p.ts > STALE_MS) return null;
  return p as Progress;
}

if (import.meta.main) {
  let session: any = {};
  try {
    const raw = await new Response(Bun.stdin).text();
    session = raw ? JSON.parse(raw) : {};
  } catch {
    /* empty session */
  }
  let progress: Progress | null = null;
  try {
    const dir =
      session?.workspace?.project_dir ||
      session?.workspace?.current_dir ||
      session?.cwd ||
      process.cwd();
    const f = Bun.file(join(dir, ".rust-studio", "progress.json"));
    if (await f.exists()) progress = freshProgress(JSON.parse(await f.text()));
  } catch {
    /* no progress file → just the session line */
  }
  process.stdout.write(render(session, progress));
  process.exit(0);
}
