#!/usr/bin/env bun
// Tests for the path-scoped rule injector. Run with: `bun test` (from the plugin
// root) or `bun test hooks/scripts/inject-rules.test.ts`.
//
// The Codex half of this hook fails silently when it fails: no path extracted
// means no standards injected, and nothing says so. The blob format below is
// copied from real Codex session transcripts, so a format drift breaks a test
// rather than quietly disarming the injector.

import { test, expect, describe } from "bun:test";
import { applyPatchTargets, pathMatches } from "./inject-rules.ts";

const ADD = `*** Begin Patch
*** Add File: /repo/crates/storage/src/domain/credential.rs
+//! Credential domain types.
+pub struct Credential { id: u64 }
*** End Patch`;

const MULTI = `*** Begin Patch
*** Update File: /repo/src/parser/lexer.rs
@@
-    let x = 1;
+    let x = 2;
*** Add File: /repo/Cargo.toml
+[package]
+name = "demo"
*** Delete File: /repo/src/old.rs
*** End Patch`;

describe("extracts edit targets from a Codex apply_patch blob", () => {
  test("a single added file", () => {
    const { paths, added } = applyPatchTargets({ input: ADD });
    expect(paths).toEqual(["/repo/crates/storage/src/domain/credential.rs"]);
    expect(added).toContain("pub struct Credential");
  });

  test("every verb, deduped, in order", () => {
    const { paths } = applyPatchTargets({ input: MULTI });
    expect(paths).toEqual(["/repo/src/parser/lexer.rs", "/repo/Cargo.toml", "/repo/src/old.rs"]);
  });

  test("added lines only — removed lines are not the new code", () => {
    const { added } = applyPatchTargets({ input: MULTI });
    expect(added).toContain("let x = 2;");
    expect(added).not.toContain("let x = 1;");
  });

  test("found by marker, not by field name", () => {
    // The wrapper key is the host's business; the marker is the contract.
    expect(applyPatchTargets({ some_future_key: ADD }).paths).toHaveLength(1);
  });

  test("no blob, no targets — Claude payloads fall through untouched", () => {
    expect(applyPatchTargets({ file_path: "/repo/src/lib.rs" }).paths).toEqual([]);
    expect(applyPatchTargets({}).paths).toEqual([]);
    expect(applyPatchTargets(undefined).paths).toEqual([]);
  });
});

describe("extracted paths reach the right standards", () => {
  // The point of extracting a path is that a rule's glob then matches it. These
  // pin the end-to-end link for the globs the studio actually ships.
  const cases: [string, string, boolean][] = [
    ["**/src/domain/**/*.rs", "/repo/crates/storage/src/domain/credential.rs", true],
    ["**/src/parser*.rs,**/src/parser/**/*.rs", "/repo/src/parser/lexer.rs", true],
    ["**/Cargo.toml", "/repo/Cargo.toml", true],
    ["**/src/domain/**/*.rs", "/repo/src/parser/lexer.rs", false],
  ];

  for (const [globs, path, want] of cases) {
    test(`${path} vs ${globs} -> ${want}`, () => {
      expect(pathMatches(globs, path)).toBe(want);
    });
  }
});

describe("announces each standard once per session, re-arming on compaction", () => {
  // Keying dedupe by file re-announced core.md once per file touched — ~70% of
  // all rule-pointer tokens in a 12-file session, per tools/context-cost.ts. The
  // twelfth "read core.md" carries nothing the first eleven didn't.
  const HOOK = new URL("./inject-rules.ts", import.meta.url).pathname;
  const COMPACT = new URL("./pre-compact.ts", import.meta.url).pathname;
  const root = new URL("../..", import.meta.url).pathname;

  const edit = (session: string, file: string) => {
    const r = Bun.spawnSync(["bun", HOOK], {
      stdin: Buffer.from(JSON.stringify({ session_id: session, tool_input: { file_path: file } })),
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
    });
    const out = new TextDecoder().decode(r.stdout).trim();
    if (!out) return [];
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
    return [...ctx.matchAll(/^- \*\*([a-z-]+)\*\*/gm)].map((m) => m[1]);
  };

  const compact = (session: string) =>
    Bun.spawnSync(["bun", COMPACT], {
      stdin: Buffer.from(JSON.stringify({ session_id: session })),
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: root },
    });

  test("a rule already in context is not re-announced", () => {
    const s = `test-dedupe-${Math.random().toString(36).slice(2)}`;
    const first = edit(s, "/r/src/lib.rs");
    expect(first).toContain("core");

    const second = edit(s, "/r/src/domain/user.rs");
    expect(second).not.toContain("core"); // the repeat that used to ship
    expect(second).toContain("types"); // genuinely new, still announced
  });

  test("nothing new to say means nothing is said", () => {
    const s = `test-silent-${Math.random().toString(36).slice(2)}`;
    edit(s, "/r/src/domain/user.rs");
    expect(edit(s, "/r/src/domain/other.rs")).toEqual([]);
  });

  test("compaction re-arms — the announcement left the context with it", () => {
    const s = `test-rearm-${Math.random().toString(36).slice(2)}`;
    edit(s, "/r/src/lib.rs");
    expect(edit(s, "/r/src/lib.rs")).toEqual([]);
    compact(s);
    expect(edit(s, "/r/src/lib.rs")).toContain("core");
  });

  test("sessions do not suppress each other", () => {
    const a = `test-iso-a-${Math.random().toString(36).slice(2)}`;
    const b = `test-iso-b-${Math.random().toString(36).slice(2)}`;
    expect(edit(a, "/r/src/lib.rs")).toContain("core");
    expect(edit(b, "/r/src/lib.rs")).toContain("core");
  });
});
