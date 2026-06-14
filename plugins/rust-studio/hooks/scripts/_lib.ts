#!/usr/bin/env bun
// Rust Code Studio — shared hook helpers (bun).
//
// Why this exists: a Claude Code hook that blocks on stdin (or on a slow child
// process) freezes the whole session. Every studio hook funnels through these
// helpers so none can hang: stdin reads race a hard timeout, and a global
// watchdog force-exits the process if anything stalls.

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
 *  or timeout — callers treat that as "couldn't check, stay silent". */
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
    return {
      exitCode: r.exitCode ?? 1,
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

/** Plugin root: CLAUDE_PLUGIN_ROOT if set, else two dirs up from scripts/. */
export function pluginRoot(): string {
  const env = process.env.CLAUDE_PLUGIN_ROOT;
  if (env) return env;
  return new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}
