#!/usr/bin/env bun
// Rust Code Studio — destructive-command guard (PreToolUse: Bash).
//
// DENY irreversible/dangerous commands; ASK for recoverable-but-risky ones.
// Everything else passes through untouched. Never crashes the session.

import { readInput, emit, done, watchdog } from "./_lib.ts";

const disarm = watchdog();

function decision(kind: "deny" | "ask", reason: string): never {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: kind,
      permissionDecisionReason: reason,
    },
  });
}

// (regex, reason) — irreversible / destructive -> DENY
const DENY: [RegExp, string][] = [
  [/\brm\b[^|;&]*\s-\w*[rR]/,
   "Recursive `rm` is blocked (`rm -r`/`-rf`). Delete specific paths explicitly, " +
   "or move them to a temp dir instead."],
  [/\brm\b[^|;&]*\s--recursive\b/,
   "Recursive `rm --recursive` is blocked. Delete specific paths explicitly."],
  [/\bgit\s+push\b(?=[^|;&]*\s(?:--force|-f)\b)(?![^|;&]*--force-with-lease)/,
   "`git push --force` is blocked (can overwrite remote history). Use " +
   "`--force-with-lease` if you really must force-push, and confirm the branch."],
  [/\bcargo\s+publish\b(?![^|;&]*--dry-run)/,
   "`cargo publish` is irreversible (a crates.io version can't be re-published). " +
   "Run `cargo publish --dry-run` first (see /publish), then publish manually when ready."],
  [/:\(\)\s*\{\s*:\s*\|\s*:\s*;\s*\}\s*;/,
   "Fork bomb blocked."],
  [/\bdd\b[^|;&]*\bof=\/dev\//,
   "`dd` to a device is blocked."],
  [/\bmkfs\b|\b>\s*\/dev\/sd[a-z]/,
   "Writing to a raw block device is blocked."],
];

// (regex, reason) — recoverable but destroys local work -> ASK
const ASK: [RegExp, string][] = [
  [/\bgit\s+reset\s+--hard\b/,
   "`git reset --hard` discards uncommitted changes. Confirm you don't need them " +
   "(consider `git stash` first)."],
  [/\bgit\s+clean\s+-\w*[dx]\w*f|\bgit\s+clean\s+-\w*f\w*[dx]/,
   "`git clean -fd/-fx` deletes untracked files. Confirm nothing important is untracked."],
  [/\bgit\s+checkout\s+--\s+\.|\bgit\s+restore\s+(?:--\s+)?\.(?:\s|$)/,
   "Discarding all local modifications. Confirm you want to lose them."],
  [/--no-verify|--no-gpg-sign|commit\.gpgsign=false/,
   "This bypasses git hooks or commit signing. Studio policy: don't skip them " +
   "unless you explicitly intend to. If a hook is failing, fix the cause instead. Confirm."],
];

const data = await readInput<{ tool_name?: string; tool_input?: { command?: string } }>();
disarm();

const tool = data.tool_name || "";
if (tool !== "" && tool !== "Bash") done();
const cmd = data.tool_input?.command || "";
if (!cmd) done();

for (const [rx, reason] of DENY) if (rx.test(cmd)) decision("deny", reason);
for (const [rx, reason] of ASK) if (rx.test(cmd)) decision("ask", reason);
done();
