#!/usr/bin/env bun
// Rust Code Studio — irreversible-action guard (PreToolUse, both hosts).
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
// Blocking uses exit code 2 + stderr — the contract both hosts honor (Codex
// reports "PreToolUse hook exited with code 2 but did not write a blocking
// reason to stderr" when the message is missing, so the same shape blocks
// there). The watchdog exits 0 (fails OPEN) if anything stalls: a guard that
// wedges the session would be worse than the risk it manages.

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
    pattern: /\bcargo\s+(?:[+-]\S*(?:\s+[^-+\s]\S*)?\s+)*publish\b/,
    exempt: /--dry-run/,
    reason:
      "Publishing to crates.io is permanent — a version can never be replaced or removed. " +
      "`cargo publish --dry-run` is allowed; run `/publish` for the release gates.",
  },
  {
    id: "cargo-yank",
    pattern: /\bcargo\s+(?:[+-]\S*(?:\s+[^-+\s]\S*)?\s+)*yank\b/,
    reason: "`cargo yank` changes what every downstream build resolves. It is a release decision.",
  },
];

/** Programs whose heredoc body is DATA (a script, a file, a document), never shell. */
const DATA_HEREDOC_CMDS = "python3?|node|bun|deno|ruby|perl|cat|tee|jq|sed|awk|sqlite3|psql";

/** Remove the bodies of data heredocs (`python3 - <<'EOF' … EOF`, `cat <<EOF > f … EOF`)
 *  so prose inside them cannot match a rule — a doc edit that quotes a guarded command
 *  is not that command. Shell heredocs (`bash <<EOF`) are kept: their body is commands.
 *  The terminator must sit alone on a line, as the shell requires; an unterminated
 *  heredoc is left untouched (nothing hidden). */
export function stripDataHeredocs(command: string): string {
  const re = new RegExp(
    String.raw`(^|[\n;&|])([^\n]*\b(?:${DATA_HEREDOC_CMDS})\b[^\n]*<<-?\s*(['"]?)(\w+)\3[^\n]*)\n[\s\S]*?\n\t*\4[ \t]*(?=\n|$)`,
    "g",
  );
  return command.replace(re, (_m, lead, opener) => `${lead}${opener}`);
}

/** The rule that blocks `command`, or null when it is allowed. */
export function check(command: string): Rule | null {
  const cmd = stripDataHeredocs(command ?? "").replace(/\s+/g, " ");
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
    `(Turn this guard off with the studio's \`git_guard\` setting, or ` +
    `\`RUST_STUDIO_GIT_GUARD=off\` on a host without plugin settings.)\n`
  );
}

export interface Input {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/** The shell command this tool call carries, or null when it isn't a shell call.
 *
 *  Matched on payload SHAPE, not on the tool's name. The hosts disagree on both:
 *  Claude Code sends `Bash { command: string }`, Codex sends
 *  `exec_command { cmd: string }`. Keying on the name meant the guard was a
 *  silent no-op on Codex — the failure mode a safety hook can least afford —
 *  and it would break again the next time a host renames its shell tool. An
 *  array form is joined for matching; the rules are anchored on git/cargo verbs,
 *  so a flattened argv reads the same as the string a shell would see. */
export function shellCommand(data: Input): string | null {
  const raw = data.tool_input?.command ?? data.tool_input?.cmd;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.every((s) => typeof s === "string")) return raw.join(" ");
  return null;
}

if (import.meta.main) {
  watchdog(5_000);

  const data = await readInput<Input>();

  // Opt-out: studio config `git_guard` (default on).
  if (!optionBool("git_guard", true)) done();

  const command = shellCommand(data);
  if (command == null) done();

  const rule = check(command);
  if (!rule) done();

  process.stderr.write(blockMessage(rule));
  process.exit(2);
}
