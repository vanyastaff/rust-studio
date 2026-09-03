#!/usr/bin/env bun
// Tests for the irreversible-action guard. Run with: `bun test` (from the
// plugin root) or `bun test hooks/scripts/irreversible-guard.test.ts`.
//
// Two failure directions matter equally. A guard that misses `reset --hard`
// loses the user's work; a guard that blocks `git push` or `cargo publish
// --dry-run` breaks /pr and /publish, and a guard people disable protects
// nothing. Both directions are locked below.

import { test, expect, describe } from "bun:test";
import { check, shellCommand, stripDataHeredocs, RULES, type Input } from "./irreversible-guard.ts";

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

describe("extracts the command from either host's payload shape", () => {
  // The two hosts name the shell tool and its argument differently. A guard
  // keyed on `Bash`/`command` is a silent no-op on Codex — it never blocks and
  // never says why. These lock the shape-based extraction instead.
  const shells: [string, Input][] = [
    ["Claude Code", { tool_name: "Bash", tool_input: { command: "git reset --hard" } }],
    ["Codex exec_command", { tool_name: "exec_command", tool_input: { cmd: "git reset --hard" } }],
    ["argv array", { tool_name: "exec", tool_input: { command: ["git", "reset", "--hard"] } }],
    ["renamed tool", { tool_name: "some_future_shell", tool_input: { cmd: "git reset --hard" } }],
  ];

  for (const [label, payload] of shells) {
    test(label, () => {
      const cmd = shellCommand(payload);
      expect(cmd).not.toBeNull();
      expect(check(cmd!)?.id).toBe("reset-hard");
    });
  }
});

describe("ignores tool calls that carry no shell command", () => {
  const passthrough: Input[] = [
    { tool_name: "Read", tool_input: { file_path: "/tmp/x.rs" } },
    { tool_name: "apply_patch", tool_input: { input: "*** Begin Patch" } },
    { tool_name: "Bash", tool_input: {} },
    { tool_name: "exec_command", tool_input: { cmd: 42 } },
    {},
  ];

  for (const [i, payload] of passthrough.entries()) {
    test(`payload ${i}`, () => {
      expect(shellCommand(payload)).toBeNull();
    });
  }
});

describe("prose and data heredocs are not commands", () => {
  const danger = "git reset " + "--hard"; // assembled: the literal would trip the guard on this file's own edits
  const publish = "cargo " + "publish";

  test("a python heredoc that documents the guarded commands is allowed", () => {
    const cmd = [
      "python3 - <<'PYEOF'",
      "s = s.replace('x', '- Run `cargo deny check`.')",
      "s += '- Publish-age cooldown: `.cargo/config.toml` sets `registry.global-min-publish-age`.'",
      "s += '- `" + danger + "` discards work; `" + publish + "` is permanent.'",
      "PYEOF",
      "echo done",
    ].join("\n");
    expect(stripDataHeredocs(cmd)).not.toContain("--hard");
    expect(check(cmd)).toBeNull();
  });

  test("a heredoc fed to a SHELL keeps its body and is still blocked", () => {
    const cmd = "bash <<'EOF'\ncd /repo\n" + danger + " origin/main\nEOF";
    expect(check(cmd)?.id).toBe("reset-hard");
  });

  test("an unterminated data heredoc is left intact (nothing stripped, nothing hidden)", () => {
    const cmd = "cat <<EOF > notes.md\n" + danger + " is dangerous";
    expect(stripDataHeredocs(cmd)).toBe(cmd);
    expect(check(cmd)?.id).toBe("reset-hard");
  });

  test("cargo verbs only count as cargo's immediate subcommand", () => {
    expect(check("cargo +nightly publish")?.id).toBe("cargo-publish");
    expect(check(publish + " -p my-crate")?.id).toBe("cargo-publish");
    expect(check("cargo +stable yank --version 1.0.0")?.id).toBe("cargo-yank");
    // global options between cargo and the verb are still the verb
    expect(check("cargo --locked " + "publish")?.id).toBe("cargo-publish");
    expect(check("cargo -Z unstable-options " + "publish")?.id).toBe("cargo-publish");
    expect(check("cargo --config net.offline=true " + "publish --dry-run")).toBeNull();
    // prose / file names / markdown that mention the verbs without invoking them
    expect(check("grep -n 'publish-age' rules/cargo-manifest.md")).toBeNull();
    expect(check("echo 'the cargo team will publish notes'")).toBeNull();
    expect(check("cargo run -- --help | grep publish")).toBeNull();
  });
});
