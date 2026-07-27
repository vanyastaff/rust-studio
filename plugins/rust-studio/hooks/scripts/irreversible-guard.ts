#!/usr/bin/env bun
// Rust Code Studio — irreversible-action guard (PreToolUse: Bash).
//
// The studio is autonomy-first: tactical calls get decided and executed without
// asking. That is the right default for work a commit can undo — and the wrong
// one for work nothing can. This hook draws that line mechanically.
//
// It blocks two families, and nothing else:
//
//   1. Working-tree destruction — `reset --hard`, `clean -f`, `checkout .`,
//      `branch -D`, `stash drop/clear`, `push --force`, and the reflog/gc
//      commands that destroy the recovery net itself. These lose uncommitted or
//      unpushed work with no way back.
//   2. crates.io publication — a real `cargo publish` or `cargo yank`. A
//      published version is permanent and visible to every downstream user;
//      `/publish` says "never auto-publish" in prose, and this gives it teeth.
//
// Deliberately NOT blocked: plain `git push` (`/pr` needs it),
// `push --force-with-lease` (it refuses to clobber work it hasn't seen), and
// `cargo publish --dry-run` (that is exactly what /publish is supposed to run).
//
// Blocking uses exit code 2 + stderr — the long-stable contract every Claude
// Code version honors. The watchdog exits 0 (fails OPEN) if anything stalls: a
// guard that wedges the session would be worse than the risk it manages.

import { readInput, done, watchdog, optionBool } from "./_lib.ts";

export interface Rule {
  /** Short id, used in tests and in the block message. */
  id: string;
  /** Matches the dangerous form. */
  pattern: RegExp;
  /** Matches a safe variant that overrides the pattern. */
  exempt?: RegExp;
  /** What the human is told, and what to do instead. */
  reason: string;
}

export const RULES: Rule[] = [
  {
    id: "reset-hard",
    pattern: /\bgit\b[^&|;]*\breset\b[^&|;]*--hard\b/,
    reason: "`git reset --hard` discards uncommitted work with no way back.",
  },
  {
    id: "clean-force",
    pattern: /\bgit\b[^&|;]*\bclean\b[^&|;]*\s-[a-zA-Z]*f/,
    reason: "`git clean -f` deletes untracked files permanently — git keeps no copy.",
  },
  {
    id: "discard-worktree",
    pattern: /\bgit\b[^&|;]*\b(checkout|restore)\b[^&|;]*?\s(--\s)?\.(\s|$)/,
    reason: "Discarding the whole working tree throws away every uncommitted change.",
  },
  {
    id: "branch-force-delete",
    pattern: /\bgit\b[^&|;]*\bbranch\b[^&|;]*\s-D(\s|$)/,
    reason: "`git branch -D` force-deletes a branch even when it holds unmerged commits.",
  },
  {
    id: "stash-destroy",
    pattern: /\bgit\b[^&|;]*\bstash\b[^&|;]*\s(drop|clear)\b/,
    reason: "Dropping a stash destroys the only copy of that work.",
  },
  {
    id: "force-push",
    pattern: /\bgit\b[^&|;]*\bpush\b[^&|;]*(--force\b|\s-f(\s|$))/,
    exempt: /--force-with-lease/,
    reason:
      "A plain force-push overwrites remote history, including commits you never fetched. " +
      "`--force-with-lease` is allowed — it refuses when the remote moved.",
  },
  {
    id: "destroy-reflog",
    pattern: /\bgit\b[^&|;]*(\breflog expire\b|\bgc\b[^&|;]*--prune=now)/,
    reason: "This destroys the reflog — the recovery net that makes other git mistakes survivable.",
  },
  {
    id: "cargo-publish",
    pattern: /\bcargo\b[^&|;]*\bpublish\b/,
    exempt: /--dry-run/,
    reason:
      "Publishing to crates.io is permanent — a version can never be replaced or removed. " +
      "`cargo publish --dry-run` is allowed; run `/publish` for the release gates.",
  },
  {
    id: "cargo-yank",
    pattern: /\bcargo\b[^&|;]*\byank\b/,
    reason: "`cargo yank` changes what every downstream build resolves. It is a release decision.",
  },
];

/** The rule that blocks `command`, or null when it is allowed. */
export function check(command: string): Rule | null {
  const cmd = (command ?? "").replace(/\s+/g, " ");
  if (!cmd.trim()) return null;
  for (const rule of RULES) {
    if (!rule.pattern.test(cmd)) continue;
    if (rule.exempt?.test(cmd)) continue;
    return rule;
  }
  return null;
}

/** The stderr text shown to the agent when a command is blocked. */
export function blockMessage(rule: Rule): string {
  return (
    `BLOCKED by the Rust Code Studio irreversible-action guard.\n\n` +
    `${rule.reason}\n\n` +
    `You do not have authority to run this. Explain what you were trying to do and let ` +
    `the user run it themselves, or reach for a reversible alternative.\n\n` +
    `(Turn this guard off with the studio's \`git_guard\` setting.)\n`
  );
}

interface Input {
  tool_name?: string;
  tool_input?: { command?: string };
}

if (import.meta.main) {
  watchdog(5_000);

  const data = await readInput<Input>();

  // Opt-out: studio config `git_guard` (default on).
  if (!optionBool("git_guard", true)) done();
  if (data.tool_name !== "Bash") done();

  const rule = check(data.tool_input?.command ?? "");
  if (!rule) done();

  process.stderr.write(blockMessage(rule));
  process.exit(2);
}
