// Tests for the Stop-guard hook. Behavior-asserting and able to fail (per
// docs/integrity-and-evidence.md): each test pins a concrete block/allow decision,
// not merely "it ran".
import { test, expect, describe } from "bun:test";
import {
  evaluate,
  shouldBlock,
  scan,
  buildRules,
  getEvidenceGroups,
  phraseToRegex,
  normalizeText,
  toProse,
  lastAssistantFromTranscript,
} from "./stop-guard.ts";

const cfg = (over: Partial<Parameters<typeof evaluate>[1]> = {}) => ({
  enabled: true,
  strict: false,
  requireEvidence: false,
  minEvidence: 2,
  maxHits: 8,
  allowedCategories: new Set<string>(),
  ...over,
});

const EVIDENCE =
  "Files changed: src/parse.rs — added port parsing. Commands run: cargo nextest run. " +
  "Verification: 12 passed. Result: COMPLETE.";

describe("hard hits always block", () => {
  test("permission-seeking blocks even with full evidence", () => {
    const d = evaluate(`${EVIDENCE} Should I continue with the next file?`, cfg());
    expect(d.block).toBe(true);
    expect(d.reason).toBe("hard-hit");
    expect(d.hardHits.map((h) => h.category)).toContain("permission-seeking");
  });

  test("test-avoidance blocks", () => {
    const d = evaluate("I didn't run tests, but this should pass.", cfg());
    expect(d.block).toBe(true);
    expect(d.reason).toBe("hard-hit");
  });

  test("handoff-to-user blocks", () => {
    const d = evaluate("The change is in place. You'll need to run the migration yourself.", cfg());
    expect(d.block).toBe(true);
    expect(d.hardHits.some((h) => h.category === "handoff-to-user")).toBe(true);
  });
});

describe("clean completion is allowed", () => {
  test("evidence-rich COMPLETE message passes", () => {
    const d = evaluate(EVIDENCE, cfg());
    expect(d.block).toBe(false);
    expect(d.evidenceGroups.length).toBeGreaterThanOrEqual(2);
  });
});

describe("soft hits depend on evidence and strict mode", () => {
  test("soft hit with no evidence blocks", () => {
    const d = evaluate("Looks good, this should be enough.", cfg());
    expect(d.block).toBe(true);
    expect(d.reason).toBe("soft-hit-without-evidence");
  });

  test("soft hit WITH enough evidence is allowed in non-strict mode", () => {
    const d = evaluate(`Looks good. ${EVIDENCE}`, cfg());
    expect(d.block).toBe(false);
  });

  test("soft hit WITH evidence still blocks in strict mode", () => {
    const d = evaluate(`Looks good. ${EVIDENCE}`, cfg({ strict: true }));
    expect(d.block).toBe(true);
    expect(d.reason).toBe("soft-hit-without-evidence");
  });
});

describe("require-evidence mode", () => {
  test("a no-hit, low-evidence message blocks when requireEvidence is on", () => {
    const d = evaluate("All wired up.", cfg({ requireEvidence: true }));
    expect(d.block).toBe(true);
    expect(d.reason).toBe("missing-evidence");
  });

  test("the same message is allowed when requireEvidence is off", () => {
    const d = evaluate("All wired up.", cfg());
    expect(d.block).toBe(false);
  });
});

describe("word boundaries prevent false positives", () => {
  test('"unlikely" does not trigger the "likely the cause" phrase', () => {
    expect(phraseToRegex("likely the cause").test("this is unlikely the cause of it")).toBe(false);
  });

  test('"prefix" does not trigger a standalone word match', () => {
    // "obviously" is a fake-certainty phrase; "unobviously" (nonsense) must not match.
    expect(phraseToRegex("obviously").test("obviously broken")).toBe(true);
    expect(phraseToRegex("obviously").test("unobviously")).toBe(false);
  });
});

describe("prose stripping prevents meta-discussion false positives", () => {
  // Regression: the guard fired on the word "incomplete" inside the category
  // name `incomplete-work` while a message was *explaining* the categories.
  test("a flagged phrase inside inline code does not trigger", () => {
    const d = evaluate(
      "The hard categories include `incomplete-work` and `handoff-to-user`. Result: COMPLETE.",
      cfg(),
    );
    expect(d.block).toBe(false);
  });

  test("a flagged phrase inside a fenced code block does not trigger", () => {
    const d = evaluate(
      "```\nincomplete\nstubbed\n```\nFiles changed: a.rs. Result: COMPLETE.",
      cfg(),
    );
    expect(d.block).toBe(false);
  });

  test("a quoted phrase is treated as discussion, not a commit", () => {
    const d = evaluate(
      'I removed the "placeholder" comment. Files changed: a.rs. Result: COMPLETE.',
      cfg(),
    );
    expect(d.block).toBe(false);
  });

  test("the same phrase in bare prose still blocks", () => {
    expect(evaluate("This is still incomplete.", cfg()).block).toBe(true);
  });

  test("toProse strips code, blockquotes, and quoted spans", () => {
    expect(toProse("a `b` c").trim()).toBe("a   c".trim());
    expect(toProse("> quoted\nplain").includes("quoted")).toBe(false);
    expect(toProse('say "placeholder" here').includes("placeholder")).toBe(false);
  });
});

describe("evidence detection", () => {
  test("files + commands count as two groups", () => {
    const g = getEvidenceGroups("Files changed: a.rs\nCommands run: cargo test");
    expect(g).toContain("files");
    expect(g).toContain("commands");
  });

  test("a studio verdict token counts as result evidence", () => {
    expect(getEvidenceGroups("Result: NEEDS WORK")).toContain("result");
  });
});

describe("allowedCategories exemption", () => {
  test("exempting speculation lets a pure-speculation message pass", () => {
    const text = "This is most likely the cause.";
    expect(evaluate(text, cfg()).block).toBe(true);
    expect(evaluate(text, cfg({ allowedCategories: new Set(["speculation"]) })).block).toBe(false);
  });
});

describe("transcript extraction", () => {
  test("picks the last assistant entry from JSONL", () => {
    const raw = [
      JSON.stringify({ role: "user", content: "do it" }),
      JSON.stringify({ role: "assistant", content: "first" }),
      JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "final answer" }] } }),
    ].join("\n");
    expect(lastAssistantFromTranscript(raw)).toBe("final answer");
  });
});

describe("scan is deduped and bounded", () => {
  test("maxHits caps the number of hits", () => {
    const text = "should i continue, want me to continue, shall i proceed, should i start, do you want me to";
    const hits = scan(text, buildRules(), 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe("shouldBlock contract", () => {
  test("no hits + enough evidence + no requireEvidence → allow", () => {
    const text = EVIDENCE;
    const d = shouldBlock(text, [], { strict: false, requireEvidence: false, minEvidence: 2 });
    expect(d.block).toBe(false);
  });
});

describe("normalizeText", () => {
  test("smart quotes and case are normalized", () => {
    expect(normalizeText("“Looks Good”")).toBe('"looks good"');
  });
});
