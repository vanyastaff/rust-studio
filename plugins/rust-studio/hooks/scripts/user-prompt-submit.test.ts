// Tests for prompt-scoped recall (UserPromptSubmit): each pins which notes a prompt
// surfaces and that a surfaced note is not repeated.
import { test, expect, describe } from "bun:test";
import { pickPromptPointers, renderPointers, MIN_PROMPT_SCORE, readSurfaced, writeSurfaced } from "./user-prompt-submit.ts";
import { parseIndex } from "./memory-store.ts";

const entries = parseIndex(
  [
    "- [Tokio runtime hang](tokio-runtime-hang.md) — select! loop starves the timer",
    "- [Registry cooldown](registry-cooldown.md) — global-min-publish-age = 3 days",
    "- [Guard blocks heredoc](irreversible-guard-heredoc.md) — installed hook, not working tree",
  ].join("\n"),
);

describe("pickPromptPointers", () => {
  test("a prompt naming the topic surfaces the note; unrelated notes stay silent", () => {
    const picks = pickPromptPointers(entries, "why does the tokio runtime hang after select!", new Set());
    expect(picks.map((p) => p.file)).toEqual(["tokio-runtime-hang.md"]);
    expect(picks[0].score).toBeGreaterThanOrEqual(MIN_PROMPT_SCORE);
  });
  test("one shared hook word is not a recall", () => {
    expect(pickPromptPointers(entries, "how many days until the release", new Set())).toEqual([]);
  });
  test("an already-surfaced note is not repeated; a short/stop-word prompt yields nothing", () => {
    expect(pickPromptPointers(entries, "tokio runtime hang", new Set(["tokio-runtime-hang.md"]))).toEqual([]);
    expect(pickPromptPointers(entries, "continue", new Set())).toEqual([]);
    expect(pickPromptPointers(entries, "", new Set())).toEqual([]);
  });
});

describe("renderPointers", () => {
  test("names the note, its label, hook, and absolute path", () => {
    const picks = pickPromptPointers(entries, "registry cooldown", new Set());
    const text = renderPointers("/m", picks, () => " (convention, 3d)");
    expect(text).toContain("a note matches this prompt");
    expect(text).toContain("**Registry cooldown** (convention, 3d) — global-min-publish-age = 3 days → `/m/registry-cooldown.md`");
  });
});

describe("surfaced marker", () => {
  test("round-trips per session", () => {
    const sid = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    expect(readSurfaced(sid).size).toBe(0);
    writeSurfaced(sid, new Set(["a.md", "b.md"]));
    expect([...readSurfaced(sid)]).toEqual(["a.md", "b.md"]);
  });
});
