#!/usr/bin/env bun
// Tests for the irreversible-action guard. Run with: `bun test` (from the
// plugin root) or `bun test hooks/scripts/irreversible-guard.test.ts`.
//
// Two failure directions matter equally. A guard that misses `reset --hard`
// loses the user's work; a guard that blocks `git push` or `cargo publish
// --dry-run` breaks /pr and /publish, and a guard people disable protects
// nothing. Both directions are locked below.

import { test, expect, describe } from "bun:test";
import { check, RULES } from "./irreversible-guard.ts";

describe("blocks irreversible work destruction", () => {
  const blocked: [string, string][] = [
    ["git reset --hard", "reset-hard"],
    ["git reset --hard HEAD~3", "reset-hard"],
    ["git -C /repo reset --hard origin/main", "reset-hard"],
    ["git clean -f", "clean-force"],
    ["git clean -fd", "clean-force"],
    ["git clean -xfd", "clean-force"],
    ["git checkout .", "discard-worktree"],
    ["git checkout -- .", "discard-worktree"],
    ["git restore .", "discard-worktree"],
    ["git branch -D feature/x", "branch-force-delete"],
    ["git stash drop", "stash-destroy"],
    ["git stash clear", "stash-destroy"],
    ["git push --force", "force-push"],
    ["git push -f origin main", "force-push"],
    ["git push --force origin main", "force-push"],
    ["git reflog expire --expire=now --all", "destroy-reflog"],
    ["git gc --prune=now", "destroy-reflog"],
    ["cargo publish", "cargo-publish"],
    ["cargo publish -p my-crate", "cargo-publish"],
    ["cargo yank --version 1.0.0", "cargo-yank"],
  ];

  for (const [cmd, id] of blocked) {
    test(cmd, () => {
      const rule = check(cmd);
      expect(rule).not.toBeNull();
      expect(rule!.id).toBe(id);
    });
  }
});

describe("allows the reversible and the routine", () => {
  const allowed = [
    // The studio's own workflows depend on these.
    "git push",
    "git push origin main",
    "git push -u origin feature/x",
    "git push --force-with-lease",
    "git push --force-with-lease origin main",
    "cargo publish --dry-run",
    "cargo publish --dry-run -p my-crate",
    // Ordinary work.
    "git status",
    "git diff HEAD",
    "git add -A",
    "git commit -m 'fix: thing'",
    "git reset HEAD~1",
    "git reset --soft HEAD~1",
    "git checkout main",
    "git checkout -b feature/x",
    "git restore --staged src/lib.rs",
    "git branch -d merged-branch",
    "git stash",
    "git stash pop",
    "git gc",
    "cargo build",
    "cargo nextest run",
    "cargo clippy --all-targets -- -D warnings",
    "",
    "   ",
  ];

  for (const cmd of allowed) {
    test(JSON.stringify(cmd), () => {
      expect(check(cmd)).toBeNull();
    });
  }
});

describe("catches the dangerous half of a compound command", () => {
  // The agent reaches for `&&` constantly; a guard that only reads the first
  // word would wave every one of these through.
  const compound = [
    "cargo build && git reset --hard",
    "git add -A; git clean -fd",
    "echo done && cargo publish",
  ];

  for (const cmd of compound) {
    test(cmd, () => {
      expect(check(cmd)).not.toBeNull();
    });
  }
});

test("every rule carries an id and a reason", () => {
  for (const rule of RULES) {
    expect(rule.id).toBeTruthy();
    expect(rule.reason.length).toBeGreaterThan(20);
  }
  expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
});
