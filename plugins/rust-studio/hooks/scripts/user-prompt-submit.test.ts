// Tests for prompt-scoped recall (UserPromptSubmit): each pins which notes a prompt
// surfaces and that a surfaced note is not repeated.
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { pickPromptPointers, renderPointers, MIN_PROMPT_SCORE, readSurfaced, writeSurfaced, routeFor, renderRoute, routeKey, readRouted, writeRouted } from "./user-prompt-submit.ts";
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

describe("routeFor — prompt shape → the skill that owns it", () => {
  // Each prompt is (a paraphrase of) an eval case that answered inline with no skill fired.
  const cases: [string, string | null][] = [
    ["This is `src/service/fanout.rs`. Clippy is clean. Review it for async correctness before it lands; end with a verdict.\n\n```rust\nfn x() {}\n```", "review"],
    ["We are about to publish 1.0 of `acme-store`. Review the error handling as the crate's public contract.", "api-review"],
    ["Can we tag and publish 1.3.0? cargo semver-checks complained but CI is green.", "api-review"],
    ["This is the lowest layer of our workspace. We are about to add a `refund` flow. Is the crate in shape to extend?", "architecture"],
    ["Our Rust test suite fails about one run in five on CI with no code changes. Where do I start?", "flaky-hunt"],
    ["The release binary of our small Rust CLI is 48 MB. Why, and how do we shrink it?", "bloat"],
    ["I'm starting a new crate that parses .env files and we intend to publish it. Help me design its public API.", "design-api"],
    ["We are considering taking a new dependency, `fast-validate 0.3.1`. I have pulled its source. Vet the crate and tell me whether we should add it.", "@dependency-manager"],
    ["The story: add a --json flag. Here is what the branch changed. Is this diff in scope? What ships, what gets split out?", "scope-check"],
    ["Nobody can follow apply_discount any more. Make it readable for a human — behavior must stay identical.", "refactor"],
    ["Review the exported C API in src/ffi.rs before the binding teams build on it.", "audit-unsafe"],
    ["cargo build fails with error[E0502] after my change, help", "fix-build"],
    ["Audit the unsafe blocks in the ring buffer for soundness", "audit-unsafe"],
    ["I want to start a new Rust project in this directory — a small CLI that deduplicates lines. How should we begin?", "start"],
    ["continue", null],
    ["what does the ? operator do in rust", null],
  ];
  for (const [prompt, want] of cases) {
    test(`${want ?? "no route"}: ${prompt.slice(0, 50)}…`, () => {
      const r = routeFor(prompt);
      expect(r ? routeKey(r).replace(/^\//, "") : null).toBe(want);
    });
  }

  test("a prompt that already names a studio skill is left alone", () => {
    expect(routeFor("/review the diff before we merge it")).toBeNull();
    expect(routeFor("run /rust-studio:api-review against v1.2.0")).toBeNull();
  });

  // routing-corpus.json is the routing table's contract: realistic prompts with the route each
  // must take, and prompts that must take none. Extend the corpus before extending ROUTES, and
  // never make a regex match a corpus prompt it is not meant to catch.
  const corpus: Array<{ prompt: string; route: string | null }> = JSON.parse(
    readFileSync(new URL("./routing-corpus.json", import.meta.url), "utf8"),
  );
  test("the routing corpus has both directions and no duplicates", () => {
    expect(corpus.filter((c) => c.route).length).toBeGreaterThanOrEqual(55);
    expect(corpus.filter((c) => !c.route).length).toBeGreaterThanOrEqual(25);
    expect(new Set(corpus.map((c) => c.prompt)).size).toBe(corpus.length);
  });
  for (const c of corpus) {
    test(`corpus: ${c.prompt.slice(0, 60).replace(/\n/g, " ")} → ${c.route ?? "(none)"}`, () => {
      const r = routeFor(c.prompt);
      expect(r ? routeKey(r).replace(/^\//, "") : null).toBe(c.route);
    });
  }

  test("an adversarial-critique prompt goes to the harsh-critic agent, not a facilitation skill", () => {
    const r = routeFor("Before we build it, attack this design. Give me the strongest case against it.");
    expect(r?.agent).toBe("harsh-critic");
    expect(renderRoute(r!)).toContain("subagent_type `rust-studio:harsh-critic`");
    expect(renderRoute(r!)).toContain("verdict line quoted verbatim");
  });

  test("the hint names the skill, the verdict vocabulary, and says to invoke it", () => {
    const text = renderRoute(routeFor("review this code before we merge")!);
    expect(text).toContain("`/review`");
    expect(text).toContain("Skill tool");
    expect(text).toContain("NEEDS WORK");
  });

  test("routed markers round-trip per session", () => {
    const sid = `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    expect(readRouted(sid).size).toBe(0);
    writeRouted(sid, new Set(["review"]));
    expect([...readRouted(sid)]).toEqual(["review"]);
  });
});
