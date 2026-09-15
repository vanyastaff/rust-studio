// Tests for the prose gate's linter core. Behavior-asserting and able to fail
// (docs/integrity-and-evidence.md): each test pins rule ids, lines, counts, or the exact
// stripped text, never merely "it ran". The three names the acceptance ledger filters on
// ("dash-pair fires across a hard wrap", "honest-use fixture yields no errors",
// "rustdoc mode scans doc comments only") are verbatim from specs/prose-gate/tasks.md.
import { test, expect, describe } from "bun:test";
import { stripQuoted } from "./_lib.ts";
import { RULES, audit, rustdocProse, sentences, stripProse } from "./prose-gate.ts";
import type { Hit } from "./prose-gate.ts";

const lineCount = (s: string) => s.split("\n").length;
const errors = (hits: Hit[]) => hits.filter((h) => h.severity === "error");
const warns = (hits: Hit[]) => hits.filter((h) => h.severity === "warn");
const ids = (hits: Hit[]) => hits.map((h) => h.rule).sort();

describe("stripQuoted (_lib)", () => {
  test("preserves line count on a fenced block and a blockquote", () => {
    const input = "before\n```rust\nlet x = 1;\nlet y = 2;\n```\n> quoted line\nafter\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("let x");
    expect(out).not.toContain("quoted line");
    const rows = out.split("\n");
    expect(rows[0]).toBe("before");
    expect(rows[6]).toBe("after");
  });

  test("blanks every double-quote glyph family within a line", () => {
    const input = 'a "one" b “two” c «three» d „four“ e\nnext';
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(2);
    for (const w of ["one", "two", "three", "four"]) expect(out).not.toContain(w);
    for (const w of ["a", "b", "c", "d", "e"]) expect(out.split("\n")[0]).toContain(w);
    expect(out.split("\n")[1]).toBe("next");
  });

  test("an inline code span wrapped across a hard break is blanked and the break kept", () => {
    const out = stripQuoted("run `cargo test\n<filter>` now");
    expect(lineCount(out)).toBe(2);
    expect(out).not.toContain("cargo test");
    expect(out).not.toContain("<filter>");
    expect(out.split("\n")[0]).toContain("run");
    expect(out.split("\n")[1]).toContain("now");
  });

  test("a blockquote after an empty line does not swallow the empty line", () => {
    const out = stripQuoted("plain\n\n> quoted\nmore");
    expect(lineCount(out)).toBe(4);
    expect(out.split("\n")[3]).toBe("more");
  });

  test("an unclosed fence blanks to the end of input instead of leaking code as prose", () => {
    const input = "text before\n```\nlet x = 1; // a — b — c\nmore code\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out.split("\n")[0]).toBe("text before");
    expect(out).not.toContain("let x");
    expect(out).not.toContain("more code");
    expect(audit(out, { density: 150 }).hits).toEqual([]);
  });

  test("a four-backtick fence encloses a three-backtick fence", () => {
    const input = "````md\n```rust\nlet inner = 1;\n```\nstill code\n````\nafter\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("let inner");
    expect(out).not.toContain("still code");
    expect(out.split("\n")[6]).toBe("after");
  });

  test("a tilde fence is stripped like a backtick fence", () => {
    const input = "~~~\ncode here — x — y\n~~~\nprose\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("code here");
    expect(out.split("\n")[3]).toBe("prose");
    expect(audit(out).hits).toEqual([]);
  });

  test("a stray backtick cannot blank a paragraph", () => {
    const text = [
      "A stray ` backtick here — and — a pair.",
      "Second line — with — another pair.",
      "Third line has a `span` too.",
      "",
    ].join("\n");
    const out = stripProse(text);
    expect(out).not.toContain("span");
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([
      ["dash-pair", 1],
      ["dash-pair", 2],
    ]);
  });

  test("an inline span does not cross a CRLF blank line", () => {
    const out = stripQuoted("a `b\r\n\r\nc` d");
    expect(lineCount(out)).toBe(3);
    expect(out).toContain("b");
    expect(out).toContain("c");
  });

  test("a fence opened on a list-marker line is a fence, and its closer does not invert parity", () => {
    const input = "- ```bash\n  cargo test; x; y\n  ```\n- next — a — b.\n\nProse — c — d.\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("cargo test");
    expect(out.split("\n")[3]).toBe("- next — a — b.");
    expect(out.split("\n")[5]).toBe("Prose — c — d.");
    const { hits, metric } = audit(stripProse(input));
    expect(hits.map((h) => [h.rule, h.line])).toEqual([
      ["dash-pair", 4],
      ["dash-pair", 6],
    ]);
    expect(metric.semicolons).toBe(0);
  });

  test("a fence opened on a blockquote line is a fence", () => {
    const input = "> ```rust\n> let a = 1; // x — y — z\n> ```\nAfter — a — b.\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("let a");
    expect(out.split("\n")[3]).toBe("After — a — b.");
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 4]]);
  });

  test("an inline span that starts a line is not a fence opener", () => {
    const input = "```x``` is a span.\nNext — a — b.\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(3);
    expect(out.split("\n")[0]).toContain("is a span.");
    expect(out.split("\n")[0]).not.toContain("x");
    expect(out.split("\n")[1]).toBe("Next — a — b.");
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 2]]);
  });

  test("an indented opener inside a list item closes on a column-0 closer", () => {
    const input = "- item\n\n    ```\n    code — x — y\n```\nafter — p — q.\n";
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("code");
    expect(out.split("\n")[5]).toBe("after — p — q.");
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 6]]);
  });
});

describe("stripProse", () => {
  test("scans a quoted description: value and blanks the rest of the frontmatter", () => {
    const input = [
      "---",
      "name: prose",
      'description: "Use when checking prose — for AI tells — in a README."',
      "allowed-tools: Bash",
      "---",
      "Body text.",
      "",
    ].join("\n");
    const out = stripProse(input);
    expect(lineCount(out)).toBe(lineCount(input));
    const rows = out.split("\n");
    // The `---` delimiters stay (no words; they tell `sentences` where the frontmatter is).
    expect(rows[0]).toBe("---");
    expect(rows[1]).toBe("");
    expect(rows[2]).toBe("Use when checking prose — for AI tells — in a README.");
    expect(rows[3]).toBe("");
    expect(rows[4]).toBe("---");
    expect(rows[5]).toBe("Body text.");
    const { hits } = audit(out);
    expect(hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 3]]);
  });

  test("the description: value is scanned as one sentence, not split at periods", () => {
    const input = ["---", 'description: "Use when A — b. Also C — d."', "---", "", "Body. Text.", ""].join("\n");
    const out = stripProse(input);
    expect(sentences(out)).toEqual([
      { line: 2, endLine: 2, text: "Use when A — b. Also C — d." },
      { line: 5, endLine: 5, text: "Body." },
      { line: 5, endLine: 5, text: "Text." },
    ]);
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 2]]);
  });

  test("a specimen in backticks or in a blockquote is not scanned", () => {
    const quoted = [
      "Avoid `it's worth noting` in prose.",
      "",
      "> It's worth noting that this line is a blockquote.",
      "",
      "Plain text here.",
      "",
    ].join("\n");
    expect(audit(stripProse(quoted)).hits).toEqual([]);
    // Calibration: the same phrase in bare prose is caught, so the blank above did the work.
    const bare = audit(stripProse("It's worth noting that this is prose.\n")).hits;
    expect(bare.map((h) => h.rule)).toEqual(["throat-clearing"]);
  });

  test("images, HTML comments and struck text are blanked; headings and link text stay", () => {
    const input = [
      "<!-- it's worth noting",
      "that this comment spans lines -->",
      "![may potentially](img.png)",
      "~~might possibly~~ kept",
      "## Heading kept",
      "[link text](docs/a.b) after",
      "",
    ].join("\n");
    const out = stripProse(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).toContain("Heading kept");
    expect(out).toContain("link text");
    expect(out).toContain("kept");
    expect(out).not.toContain("docs/a.b");
    expect(out).not.toContain("img.png");
    expect(audit(out).hits).toEqual([]);
  });
});

describe("sentences", () => {
  test("unwraps a hard-wrapped paragraph and reports each sentence's line span", () => {
    const out = sentences("First line of the\nsentence ends here. Second\nsentence.\n");
    expect(out).toEqual([
      { line: 1, endLine: 2, text: "First line of the sentence ends here." },
      { line: 2, endLine: 3, text: "Second sentence." },
    ]);
  });

  test("a blank line, a heading and a bullet start are block boundaries", () => {
    const out = sentences("Para one\n## Head two\nPara three\n- bullet four\n  joins four\n- bullet six\n");
    expect(out.map((s) => s.text)).toEqual([
      "Para one",
      "Head two",
      "Para three",
      "bullet four joins four",
      "bullet six",
    ]);
    expect(out.map((s) => [s.line, s.endLine])).toEqual([[1, 1], [2, 2], [3, 3], [4, 5], [6, 6]]);
  });

  test("table cells and bullets are separate units", () => {
    const text = [
      "| a — b | c — d |",
      "|---|---|",
      "| e | f |",
      "- one — two",
      "  continues — here",
      "- three",
      "",
    ].join("\n");
    expect(sentences(text).map((s) => s.text)).toEqual([
      "a — b",
      "c — d",
      "e",
      "f",
      "one — two continues — here",
      "three",
    ]);
    const { hits } = audit(text);
    // One dash per cell: no pair. The bullet carries two across its continuation line.
    expect(hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 4]]);
    expect(sentences(text)[4]).toMatchObject({ line: 4, endLine: 5 });
  });

  test("a 500-character run-on bullet is windowed", () => {
    const body = Array.from({ length: 100 }, (_, i) => `w${String(i).padStart(3, "0")}`).join(" ");
    expect(body.length).toBe(499);
    const out = sentences(`- ${body}\n`);
    expect(out.map((s) => s.text.length)).toEqual([220, 220, 59]);
    expect(out.map((s) => [s.line, s.endLine])).toEqual([[1, 1], [1, 1], [1, 1]]);
    expect(out.map((s) => s.text).join("")).toBe(body);
  });

  test("does not split after e.g. before a lowercase word, does split after a paren", () => {
    expect(sentences("Use a tool, e.g. cargo, for this. Then stop.\n").map((s) => s.text)).toEqual([
      "Use a tool, e.g. cargo, for this.",
      "Then stop.",
    ]);
    expect(sentences("Done (really). Next one.\n").map((s) => s.text)).toEqual([
      "Done (really).",
      "Next one.",
    ]);
  });

  test("units with no word are not sentences", () => {
    expect(sentences("| — | — |\n\n---\n")).toEqual([]);
  });

  test("e.g., i.e., cf. and vs. never end a sentence", () => {
    const one = (text: string) => {
      const out = stripProse(text);
      expect(sentences(out).map((s) => [s.line, s.endLine])).toEqual([[1, 1]]);
      expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 1]]);
    };
    one("The gate — e.g. `cargo test` — fails the build.\n"); // a stripped code span follows
    one("The gate — e.g. Cargo — fails the build.\n"); // a capitalised word follows
    one("The gate — i.e. (the strict one) — fails the build.\n"); // punctuation follows
    one("Fast paths — memcpy vs. `ptr::copy` — are the exception.\n"); // blank, then a dash
    one("Compare Rust vs. Go — the safer — choice.\n"); // a capitalised word after vs.
    one("See the rule — cf. RFC 2119 — for MUST.\n"); // a capital and a digit after cf.
    expect(sentences("Use e.g. Then stop.\n").map((s) => s.text)).toEqual(["Use e.g. Then stop."]);
  });

  test("etc. ends a sentence unless a lowercase letter follows: a split can only hide a hit", () => {
    expect(sentences("Add a, b, etc. Then stop.\n").map((s) => s.text)).toEqual(["Add a, b, etc.", "Then stop."]);
    expect(sentences("keep a, b, etc. and go on\n").map((s) => s.text)).toEqual(["keep a, b, etc. and go on"]);
    // A stripped span after etc. is a blank, not a lowercase letter, so the sentence ends there.
    // Both dashes of this input sit in the second sentence, so that pair is real and stays.
    const literal = stripProse("Run fmt, clippy, etc. `cargo test` runs last — always — here.\n");
    expect(sentences(literal).map((s) => s.text)).toEqual(["Run fmt, clippy, etc.", "runs last — always — here."]);
    expect(audit(literal).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 1]]);
    // With one dash on each side of the split, the split hides the would-be pair: no hit.
    const balanced = stripProse("Run fmt — clippy, etc. `cargo test` runs last — here.\n");
    expect(sentences(balanced).map((s) => s.text)).toEqual(["Run fmt — clippy, etc.", "runs last — here."]);
    expect(audit(balanced).hits).toEqual([]);
  });

  test("a blank-line-free 12,000-line paragraph splits in linear time", () => {
    const text = Array.from({ length: 12000 }, (_, i) => `Sentence number ${i} ends here.`).join("\n") + "\n";
    const t0 = performance.now();
    const out = sentences(text);
    const elapsed = performance.now() - t0;
    expect(out).toHaveLength(12000);
    expect(out[11999]).toEqual({ line: 12000, endLine: 12000, text: "Sentence number 11999 ends here." });
    // The quadratic slices took ~3 s here (12 s at 24,000 lines); the bounded ones take ~20 ms.
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("rules", () => {
  test("dash-pair fires across a hard wrap", () => {
    const text = "The gate — honest,\ncheap — fails the build.\n";
    const { hits } = audit(text);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ rule: "dash-pair", severity: "error", line: 1 });
    expect(hits[0].excerpt).toContain("— honest, cheap —");
    expect(sentences(text)).toEqual([
      { line: 1, endLine: 2, text: "The gate — honest, cheap — fails the build." },
    ]);
  });

  test("not just X, but Y and isn't just X, it's Y fire; X, not just Y. does not", () => {
    expect(ids(errors(audit("It is not just faster, but safer.\n").hits))).toEqual(["not-just"]);
    expect(ids(errors(audit("This isn't just a wrapper, it's a runtime.\n").hits))).toEqual(["not-just"]);
    expect(ids(errors(audit("It is not only correct but also fast.\n").hits))).toEqual(["not-just"]);
    expect(ids(errors(audit("It cannot just fail, but must report.\n").hits))).toEqual(["not-just"]);
    expect(audit("Ship the fix, not just the test.\n").hits).toEqual([]);
  });

  test("a curly apostrophe not-just fires", () => {
    const { hits } = audit("it’s not just a tool, it’s a journey\n");
    expect(ids(errors(hits))).toEqual(["not-just"]);
    expect(ids(warns(hits))).toEqual(["vocab-word"]);
    expect(warns(hits)[0].excerpt).toContain("journey");
  });

  test("it's worth noting fires and its worth does not", () => {
    expect(ids(audit("It's worth noting that the cache is cold.\n").hits)).toEqual(["throat-clearing"]);
    expect(ids(audit("That being said, the cache is cold.\n").hits)).toEqual(["throat-clearing"]);
    expect(audit("The crate earns its worth on the second build.\n").hits).toEqual([]);
  });

  test("may potentially fires; a single hedge does not", () => {
    expect(ids(audit("This may potentially break.\n").hits)).toEqual(["hedge-stack"]);
    expect(ids(audit("This might possibly break.\n").hits)).toEqual(["hedge-stack"]);
    expect(audit("This may break.\n").hits).toEqual([]);
  });

  test("I've analysed the requirements fires and as requested does not", () => {
    expect(ids(audit("I've analysed the requirements and the fix is small.\n").hits)).toEqual(["process-bleed"]);
    expect(ids(audit("I have reviewed the diff; I hope this helps.\n").hits)).toEqual(["process-bleed", "process-bleed"]);
    expect(audit("Renamed the field as requested. Let me know if the name reads wrong.\n").hits).toEqual([]);
  });

  test("10,000+ happy users warns proof and 12 sitemaps does not", () => {
    const hit = audit("Trusted by 10,000+ happy users.\n").hits;
    expect(hit.map((h) => [h.rule, h.severity])).toEqual([["proof", "warn"]]);
    expect(ids(audit("The build is 3x faster now.\n").hits)).toEqual(["proof"]);
    expect(ids(audit("It uses 40% less memory.\n").hits)).toEqual(["proof"]);
    expect(audit("The crawler wrote 12 sitemaps.\n").hits).toEqual([]);
    expect(audit("Measured with hyperfine: 3x faster (120 ms to 40 ms).\n").hits).toEqual([]);
  });

  test("proof needs a count marker: years, versions and small counts beside a people-noun pass", () => {
    for (const s of [
      "Since 2001 teams have shipped it.",
      "Rust 1.85 users get the fix.",
      "Version 2 customers stay on the old path.",
      "In 2024 developers moved to the new API.",
      "2 active maintainers, corporate-backed.",
    ]) {
      expect(audit(`${s}\n`).hits).toEqual([]);
    }
    for (const s of ["Used by 500 users.", "3 million developers rely on it.", "Over 2,500 teams run it."]) {
      expect(ids(audit(`${s}\n`).hits)).toEqual(["proof"]);
    }
  });

  test("proof excerpts contain their match when a speed-up precedes a people-count", () => {
    const { hits } = audit(
      "After the rewrite of the parser and the planner the service is 3x faster for the 10,000+ users on the free tier.\n",
    );
    expect(hits.map((h) => h.rule)).toEqual(["proof", "proof"]);
    expect(hits[0].excerpt).toContain("3x faster");
    expect(hits[1].excerpt).toContain("10,000+ users");
  });

  test("vocabulary warns on whole lowercase words and roots, bounded", () => {
    const { hits } = audit("A seamless, robust journey through the landscape.\n");
    expect(hits.every((h) => h.severity === "warn")).toBe(true);
    expect(ids(hits)).toEqual(["vocab-root", "vocab-word", "vocab-word", "vocab-word"]);
    expect(audit("Robust Journey is the crate's name.\n").hits).toEqual([]);
    expect(audit("The high-leverage path tests robustness, which is counterintuitive.\n").hits).toEqual([]);
    expect(ids(audit("We leverage the cache to streamline and empower the seamlessly cutting-edge flow.\n").hits)).toEqual([
      "vocab-root",
      "vocab-root",
      "vocab-word",
      "vocab-word",
      "vocab-word",
    ]);
  });

  test("the rule table is the spec's, with a fix text and a closed severity on every rule", () => {
    expect(RULES.map((r) => r.id)).toEqual([
      "dash-pair",
      "not-just",
      "throat-clearing",
      "hedge-stack",
      "process-bleed",
      "vocab-root",
      "vocab-word",
      "proof",
    ]);
    for (const r of RULES) {
      expect(r.fix.length).toBeGreaterThan(10);
      expect(["error", "warn"]).toContain(r.severity);
    }
    expect(RULES.filter((r) => r.severity === "error").map((r) => r.id)).toEqual([
      "dash-pair",
      "not-just",
      "throat-clearing",
      "hedge-stack",
      "process-bleed",
    ]);
  });

  test("an excerpt is single-line and carries the match with bounded context", () => {
    const text = "The gate — honest,\ncheap — fails the build every single time it runs on the corpus.\n";
    const [hit] = audit(text).hits;
    expect(hit.excerpt).not.toContain("\n");
    expect(hit.excerpt.startsWith("The gate — honest, cheap —")).toBe(true);
    expect(hit.excerpt.length).toBeLessThan(text.length);
    expect(hit.fix).toBe("make the aside its own sentence or put it in parentheses; not a semicolon");
  });
});

describe("fixtures", () => {
  // Pinned warns: only `vocab-word` for "comprehensive" in "comprehensive test suite". It is a
  // whole lowercase word here; the rule is advisory precisely because this reading is honest.
  test("honest-use fixture yields no errors", () => {
    const fixture = [
      "We unlock the mutex before returning, and the daemon runs with elevated privileges only",
      "during install. The proxy answers 401 with WWW-Authenticate: Basic realm set, which is a",
      "high-leverage place to test robustness. The result is counterintuitive, so the",
      "comprehensive test suite from EmbarkStudios covers it. Inspection, repair and replacement",
      "for homes. The crate earns its worth on the second build. Ship the fix, not just the test.",
      "The crawler wrote 12 sitemaps. The bench shows 2x faster on 4 threads.",
      "",
    ].join("\n");
    const { hits, metric, sentences: count } = audit(stripProse(fixture));
    expect(errors(hits)).toEqual([]);
    expect(warns(hits).map((h) => [h.rule, h.line])).toEqual([["vocab-word", 3]]);
    expect(warns(hits)[0].excerpt).toContain("comprehensive");
    expect(count).toBe(8);
    expect(metric).toEqual({ words: 81, emDashes: 0, enDashes: 0, semicolons: 0, per100: 0 });
  });

  test("rustdoc mode scans doc comments only", () => {
    const src = [
      "/// This robust, seamless API — fast — and safe.",
      "pub fn x() {",
      '    let s = "delve — into — it"; // not just a, but b',
      "}",
      "",
    ].join("\n");
    const prose = rustdocProse(src);
    expect(lineCount(prose)).toBe(lineCount(src));
    expect(prose.split("\n")[0]).toBe("This robust, seamless API — fast — and safe.");
    expect(prose.split("\n").slice(1, 4)).toEqual(["", "", ""]);
    const { hits } = audit(prose);
    expect(errors(hits).map((h) => [h.rule, h.line])).toEqual([["dash-pair", 1]]);
    expect(warns(hits).map((h) => [h.rule, h.line]).sort()).toEqual([
      ["vocab-root", 1],
      ["vocab-word", 1],
    ]);
    expect(hits.every((h) => h.line === 1)).toBe(true);
  });

  test("rustdoc mode takes //! lines and drops a four-slash comment", () => {
    const src = "//! Crate docs.\n//// not a doc comment\n// plain\n///no space\n";
    expect(rustdocProse(src).split("\n")).toEqual(["Crate docs.", "", "", "no space", ""]);
  });
});

describe("audit", () => {
  const words = (n: number, prefix = "w") => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

  test("density: 3 em-dashes in 100 words with density 150 fire once; none without the option", () => {
    // Three sentences, one em-dash each (so dash-pair stays silent), 100 words in total.
    const text = `${words(30, "a")} — ${words(3, "b")}.\n${words(30, "c")} — ${words(3, "d")}.\n${words(30, "e")} — ${words(4, "f")}.\n`;
    const plain = audit(text);
    expect(plain.metric).toMatchObject({ words: 100, emDashes: 3, enDashes: 0, semicolons: 0, per100: 3 });
    expect(plain.hits).toEqual([]);
    expect(plain.sentences).toBe(3);
    const gated = audit(text, { density: 150 });
    expect(gated.hits.map((h) => [h.rule, h.severity, h.line])).toEqual([["density", "error", 1]]);
    expect(gated.hits[0].excerpt).toContain("3 em-dashes");
    expect(gated.hits[0].excerpt).toContain("100 words");
    // Under the ceiling nothing fires: 1 separator in 200 words at 1/150.
    expect(audit(`${words(100)} — ${words(99)}.\n`, { density: 150 }).hits).toEqual([]);
  });

  test("audit of empty text reports zero words and no hits", () => {
    expect(audit("")).toEqual({
      hits: [],
      metric: { words: 0, emDashes: 0, enDashes: 0, semicolons: 0, per100: 0 },
      sentences: 0,
    });
    expect(audit("", { density: 150 }).hits).toEqual([]);
  });

  test("the metric counts em-dashes, spaced en-dashes and semicolons per 100 words", () => {
    // Six word tokens (a, b, c, d, and, e-f), three separators: 50 per 100.
    const { metric } = audit("a — b; c – d and e-f.\n");
    expect(metric).toEqual({ words: 6, emDashes: 1, enDashes: 1, semicolons: 1, per100: 50 });
    // An unspaced en-dash is a range (2020–2026), not a separator.
    expect(audit("from 2020–2026 on.\n").metric.enDashes).toBe(0);
  });

  test("words of any script count, so Cyrillic prose is not zero prose", () => {
    const r = audit("Это — текст — с тире.\n");
    expect(r.metric).toMatchObject({ words: 4, emDashes: 2 });
    expect(r.sentences).toBe(1);
    expect(r.hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 1]]);
  });
});
