#!/usr/bin/env bun
// Rust Code Studio — shared hook helpers (bun).
//
// Why this exists: a Claude Code hook that blocks on stdin (or on a slow child
// process) freezes the whole session. Every studio hook funnels through these
// helpers so none can hang: stdin reads race a hard timeout, and a global
// watchdog force-exits the process if anything stalls.

import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Read + parse the hook's JSON stdin, racing a hard timeout so a stdin that
 *  never closes can't wedge the hook. Returns {} on timeout / parse error. */
export async function readInput<T = any>(timeoutMs = 2000): Promise<T> {
  try {
    const text = await Promise.race([
      new Response(Bun.stdin).text(),
      new Promise<string>((res) => setTimeout(() => res(""), timeoutMs)),
    ]);
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

/** Arm a global watchdog: if the hook hasn't finished in `ms`, force a clean
 *  exit(0) so it can never hold the session. Returns a disarm fn. */
export function watchdog(ms = 12_000): () => void {
  const t = setTimeout(() => process.exit(0), ms);
  return () => clearTimeout(t);
}

/** Emit a JSON hook result on stdout and exit 0. Explicit exit() also tears
 *  down any still-pending stdin read. */
export function emit(obj: unknown): never {
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    /* non-fatal */
  }
  process.exit(0);
}

/** Exit 0 with no output (the common "nothing to do" path). */
export function done(): never {
  process.exit(0);
}

/** Run a command synchronously with a hard timeout. Returns null on any error
 *  or timeout — callers treat that as "couldn't check, stay silent". A child
 *  killed by the timeout reports exitCode:null + signalCode, NOT a failure
 *  exit code — mapping it to 1 would turn "couldn't check" into "check failed"
 *  (a false nudge on every slow workspace). */
export function run(
  cmd: string[],
  opts: { cwd?: string; timeout?: number } = {},
): { exitCode: number; stdout: string; stderr: string } | null {
  try {
    const r = Bun.spawnSync(cmd, {
      cwd: opts.cwd,
      timeout: opts.timeout ?? 8_000,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    if ((r as any).exitedDueToTimeout || r.signalCode != null || r.exitCode == null) return null;
    return {
      exitCode: r.exitCode,
      stdout: r.stdout ? new TextDecoder().decode(r.stdout) : "",
      stderr: r.stderr ? new TextDecoder().decode(r.stderr) : "",
    };
  } catch {
    return null;
  }
}

/** Is `bin` resolvable on PATH? */
export function which(bin: string): boolean {
  return Bun.which(bin) != null;
}

/** Plugin root: CLAUDE_PLUGIN_ROOT (Claude Code) or PLUGIN_ROOT (Codex) if set,
 *  else two dirs up from scripts/. fileURLToPath (not .pathname) so %-encoded
 *  chars — e.g. a space in the install path — decode correctly on every platform. */
export function pluginRoot(): string {
  const env = process.env.CLAUDE_PLUGIN_ROOT ?? process.env.PLUGIN_ROOT;
  if (env) return env;
  return fileURLToPath(new URL("../..", import.meta.url));
}

/** The per-plugin state directory the host provides, created if needed.
 *
 *  Both hosts hand a plugin its own data dir — `CLAUDE_PLUGIN_DATA` on Claude Code,
 *  `PLUGIN_DATA` on Codex (both verified in the shipped binaries, not in docs). Hook state
 *  used to go to `tmpdir()` unconditionally, which works but is the wrong drawer: it is shared
 *  with every other tool on the machine, and on a host that sandboxes or relocates the temp
 *  directory it is not guaranteed writable. The env dir is preferred and `tmpdir()` remains
 *  the fallback, so nothing breaks where neither var is set (a test, a bare `bun` run).
 *
 *  The tradeoff the fallback hides: `tmpdir()` is usually cleared at boot, and this directory
 *  is NOT. Session-keyed state accumulates here forever unless something removes it, which is
 *  what `pruneState` is for — see its call in the session-start hook. */
export function pluginData(): string {
  const env = (process.env.CLAUDE_PLUGIN_DATA ?? process.env.PLUGIN_DATA ?? "").trim();
  for (const dir of [env, join(tmpdir(), "rust-studio-state")]) {
    if (!dir) continue;
    try {
      mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      continue; // unwritable — try the fallback
    }
  }
  return tmpdir();
}

/** Delete state entries older than `maxAgeMs`, one level deep, and report how many went.
 *
 *  Session markers are keyed by session id, so a stale one suppresses nothing — it just sits
 *  there. On a durable directory that is a slow leak rather than a bug, and a slow leak in a
 *  temp directory is exactly the failure that is invisible until it is not. Fails open: a
 *  directory that cannot be read is left alone rather than wedging the hook that called it. */
export function pruneState(dir: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of entries) {
    const path = join(dir, name);
    try {
      if (statSync(path).mtimeMs >= cutoff) continue;
      rmSync(path, { recursive: true, force: true });
      removed += 1;
    } catch {
      /* a racing writer or a permission wall — skip it */
    }
  }
  return removed;
}

/** Read a studio setting. Claude Code exposes plugin userConfig to hook
 *  subprocesses as CLAUDE_PLUGIN_OPTION_<KEY> (upper-cased form documented, the
 *  verbatim key tried as a fallback).
 *
 *  Codex has no userConfig channel, so every setting there would be frozen at
 *  its default — including `git_guard`, which the irreversible-action guard tells
 *  the user to flip when it blocks something. RUST_STUDIO_<KEY> is the
 *  host-neutral escape hatch that makes that instruction true on both hosts. It
 *  is consulted last so a Claude userConfig value still wins on Claude.
 *
 *  Returns null when unset/blank so callers can fall back to their own default. */
export function option(key: string): string | null {
  const env = process.env;
  const v =
    env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`] ??
    env[`CLAUDE_PLUGIN_OPTION_${key}`] ??
    env[`RUST_STUDIO_${key.toUpperCase()}`];
  const s = (v ?? "").trim();
  return s ? s : null;
}

/** Boolean userConfig flag. Absent/blank -> `dflt`; an explicit false-ish token
 *  (false/0/no/off, case-insensitive) -> false; anything else -> true. */
export function optionBool(key: string, dflt: boolean): boolean {
  const raw = option(key);
  if (raw == null) return dflt;
  return !/^(false|0|no|off)$/i.test(raw);
}
