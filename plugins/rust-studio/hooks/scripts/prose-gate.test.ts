// Tests for the prose gate: the linter core and the CLI around it. Behavior-asserting and
// able to fail (docs/integrity-and-evidence.md): each test pins rule ids, lines, counts, exit
// codes, or the exact output, never merely "it ran". The names the acceptance ledger filters
// on ("dash-pair fires across a hard wrap", "honest-use fixture yields no errors",
// "rustdoc mode scans doc comments only", "since scans only touched sentences",
// "zero prose exits 2", "stdin draft reports not-just and stays unchanged") are verbatim
// from specs/prose-gate/tasks.md.
import { test, expect, describe } from "bun:test";
import { appendFileSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripQuoted } from "./_lib.ts";
import {
  RULES, USAGE, addedRanges, audit, gitDiffArgs, main, parseArgs, rustdocProse, sentences, stripProse,
} from "./prose-gate.ts";
import type { Hit, Io } from "./prose-gate.ts";

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

  test("a double-quoted span wrapped across a soft line break is blanked and the pair after it is found", () => {
    // docs/sub-agents.md:36 as it was: the wrapped span left both quotes unpaired, the next
    // quote on line 2 paired with the wrong partner, and the real em-dash was blanked.
    const input = [
      'The refusal comes in several wordings — "requires approval", "permission …',
      'denied", "blocked", a tool missing from the list — and some hosts append "you may attempt this',
      'with other tools"; for a build that offer is empty.',
      "",
    ].join("\n");
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    for (const w of ["requires approval", "permission", "denied", "blocked", "you may attempt", "other tools"]) {
      expect(out).not.toContain(w);
    }
    expect(out.split("\n")[1]).toContain("a tool missing from the list — and some hosts append");
    expect(out.split("\n")[2]).toBe(" ; for a build that offer is empty.");
    expect(audit(stripProse(input)).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 1]]);
    // CRLF: the span still crosses one soft break.
    expect(stripQuoted('a "b\r\nc" d')).toBe("a  \n  d");
  });

  test("a lone double quote does not eat the paragraph", () => {
    // No partner on the next line: nothing is blanked and the pair after it is found.
    const lone = 'A lone " quote here.\nNext — a — pair.\n';
    expect(stripQuoted(lone)).toBe(lone);
    expect(audit(stripQuoted(lone)).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 2]]);
    // A partner past a blank line is not a partner: the paragraph break ends the search.
    const far = 'He said "hello\n\nNext — a — pair, "quoted".\n';
    const out = stripQuoted(far);
    expect(lineCount(out)).toBe(4);
    expect(out.split("\n")[0]).toBe('He said "hello');
    expect(out.split("\n")[2]).toBe("Next — a — pair,  .");
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 3]]);
  });

  test("a double-quoted span may wrap across several lines of one paragraph", () => {
    // docs/delegation.md:170-173 as it was: a three-line quote that a one-break rule leaves
    // unpaired, whose orphan closer then pairs forward and blanks one dash of the real pair.
    const input = [
      'Codex carries "Do not spawn sub-agents unless the',
      'user or applicable instructions explicitly ask for sub-agents, delegation, or',
      'parallel agent work" (its proactive mode lifts that prior). So a skill must name the',
      'spawn — "spawn `rust-reviewer`", "run these lenses in parallel" — because intent-only phrasing',
      "does not clear the gate.",
      "",
    ].join("\n");
    const out = stripQuoted(input);
    expect(lineCount(out)).toBe(lineCount(input));
    for (const w of ["Do not spawn", "explicitly ask", "parallel agent work", "rust-reviewer", "run these lenses"]) {
      expect(out).not.toContain(w);
    }
    expect(out.split("\n")[2]).toBe("  (its proactive mode lifts that prior). So a skill must name the");
    expect(out.split("\n")[3]).toBe("spawn —  ,   — because intent-only phrasing");
    expect(audit(stripProse(input)).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 3]]);
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

  test("a backticked URL keeps its closing backtick, so the next bullet's pair is seen", () => {
    // The URL pass used to run before the code-span pass and take the closing backtick as
    // the URL's last character; the orphan opener then paired into the next bullet.
    const input = [
      "- `https://example.com/x` → 200 (checked) — the real repo",
      "- The second — honest — bullet, with `code` in it.",
      "",
    ].join("\n");
    const out = stripProse(input);
    expect(lineCount(out)).toBe(lineCount(input));
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("code");
    expect(out.split("\n")[0]).toBe("-   → 200 (checked) — the real repo");
    expect(out.split("\n")[1]).toBe("- The second — honest — bullet, with   in it.");
    expect(audit(out).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 2]]);
    // docs/adr/0001…:216 as it was: three one-dash bullets fused into one two-dash sentence.
    const corpus = [
      "- Published 2026-08-06 — agent-plugins.org",
      "- `https://github.com/x/y` → 200 (checked 2026-09-04) — the real repo",
      "- `https://x.com/z/` → 200 (checked 2026-09-04) — first-party docs",
      "",
    ].join("\n");
    expect(sentences(stripProse(corpus)).map((s) => s.line)).toEqual([1, 2, 3]);
    expect(audit(stripProse(corpus)).hits).toEqual([]);
    // A bare URL in prose is still blanked, and a closer or quote after it survives.
    expect(stripProse("See (https://example.com/a) and then.\n").split("\n")[0]).toBe("See ( ) and then.");
    expect(stripProse("At 'https://example.com/b' — a — b.\n").split("\n")[0]).toBe("At ' ' — a — b.");
    expect(stripProse("Go to https://example.com/c.\n").split("\n")[0]).toBe("Go to  .");
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

  test("etc.) before a lowercase word continues the sentence, so a pair across it is seen", () => {
    const text = "(fmt, clippy, etc.) and then — a — b.\n";
    expect(sentences(text).map((s) => s.text)).toEqual(["(fmt, clippy, etc.) and then — a — b."]);
    expect(audit(text).hits.map((h) => [h.rule, h.line])).toEqual([["dash-pair", 1]]);
    // The closing bracket is part of the terminator, so a capital after it still splits.
    expect(sentences("(fmt, clippy, etc.) Then — a — b.\n").map((s) => s.text)).toEqual([
      "(fmt, clippy, etc.)",
      "Then — a — b.",
    ]);
    // The corpus lines the advisory recorded: a bracketed list, then the sentence goes on.
    expect(sentences("Implement the marker traits (`Send`, `Sync`,\netc.) explicitly when you need them.\n")).toHaveLength(1);
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

// ---------------------------------------------------------------------------------------------
// CLI (task 2). `main` takes an `io` so no test spawns a process for stdin or output; the one
// shell test at the end covers the shipped-script contract (`--help` exits 0 from bun).
// ---------------------------------------------------------------------------------------------

function fakeIo(stdin = "") {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    stdin: async () => stdin,
    stdout: (s) => { out.push(s); },
    stderr: (s) => { err.push(s); },
  };
  return { io, stdout: () => out.join(""), stderr: () => err.join("") };
}

const lastLine = (s: string) => s.trimEnd().split("\n").at(-1);

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "prose-gate test", GIT_AUTHOR_EMAIL: "prose-gate@example.invalid",
  GIT_COMMITTER_NAME: "prose-gate test", GIT_COMMITTER_EMAIL: "prose-gate@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
};

function git(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], {
    cwd, env: GIT_ENV, stdout: "pipe", stderr: "pipe", stdin: "ignore",
  });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(r.stderr)}`);
  return new TextDecoder().decode(r.stdout);
}

const tempDir = (prefix = "rs-prose-") => mkdtempSync(join(tmpdir(), prefix));

interface Repo {
  dir: string;
  /** Committed, then one line added inside its second two-dash sentence. */
  a: string;
  /** Untracked, two pairs. */
  b: string;
  /** Committed, untouched, carries a pair. */
  c: string;
  /** Committed with a code fence only; untouched. */
  fence: string;
  /** Committed; a two-dash sentence appended after the commit. */
  real: string;
  /** Committed symlink to `real`. */
  link: string;
}

/** Populate `dir` (the caller made it and removes it, so a failing init cannot leak it). */
function makeRepo(dir: string): Repo {
  const a = join(dir, "a.md");
  const b = join(dir, "b.md");
  const c = join(dir, "c.md");
  const fence = join(dir, "fence.md");
  const real = join(dir, "real.md");
  const link = join(dir, "link.md");
  git(dir, "init", "-q");
  writeFileSync(a, "The gate — honest,\ncheap — fails the build.\n\nThe second — also\nwrapped — sentence here.\n");
  writeFileSync(c, "Committed — and — untouched.\n");
  writeFileSync(fence, "```rust\nlet x = 1; // a — b — c\n```\n");
  writeFileSync(real, "Real file, plain.\n");
  symlinkSync("real.md", link);
  git(dir, "add", "a.md", "c.md", "fence.md", "real.md", "link.md");
  git(dir, "commit", "-q", "-m", "base");
  writeFileSync(a, "The gate — honest,\ncheap — fails the build.\n\nThe second — also\nand now longer,\nwrapped — sentence here.\n");
  writeFileSync(b, "Untracked — one — pair.\n\nAnd — another — pair.\n");
  appendFileSync(real, "\nAdded — through — the target.\n");
  return { dir, a, b, c, fence, real, link };
}

describe("cli: parseArgs", () => {
  test("--full with --density and --since with a rev parse into the Scope union", () => {
    expect(parseArgs(["--full", "--density", "100", "a.md"])).toEqual({
      scope: { kind: "full", density: 100 }, files: ["a.md"], stdin: false, lang: "md", rustdoc: false, json: false, help: false,
    });
    expect(parseArgs(["--since", "main", "--json", "a.md", "b.rs"])).toMatchObject({
      scope: { kind: "since", base: "main" }, files: ["a.md", "b.rs"], json: true,
    });
    expect(parseArgs(["a.md"])).toMatchObject({ scope: { kind: "full" } });
    expect(parseArgs(["--stdin", "--lang", "rustdoc"])).toMatchObject({ stdin: true, lang: "rustdoc", files: [] });
    expect(parseArgs(["--rustdoc", "--", "-weird.md"])).toMatchObject({ rustdoc: true, files: ["-weird.md"] });
  });

  test("--since with --density is a usage error", () => {
    const r = parseArgs(["--since", "HEAD", "--density", "100", "a.md"]);
    expect(r).toBeInstanceOf(Error);
    expect((r as Error).message).toContain("--density");
    // Order does not matter: density is refused by the scope, not by argument position.
    expect(parseArgs(["--density", "100", "--since", "HEAD", "a.md"])).toBeInstanceOf(Error);
  });

  test("meaningless combinations are usage errors", () => {
    for (const argv of [
      [],
      ["--stdin", "a.md"],
      ["--lang", "rustdoc", "a.md"],
      ["--stdin", "--rustdoc"],
      ["--stdin", "--lang", "yaml"],
      ["--since"],
      ["--since", "--json", "a.md"],
      ["--since", "HEAD", "--full", "a.md"],
      ["--since", "HEAD", "--stdin"],
      ["--density", "0", "a.md"],
      ["--density", "1.5", "a.md"],
      ["--density", "1e2", "a.md"],
      ["--density", "0x10", "a.md"],
      ["--density", " 100", "a.md"],
      ["--density", "+100", "a.md"],
      ["--density"],
      ["--bogus", "a.md"],
    ]) {
      expect(parseArgs(argv)).toBeInstanceOf(Error);
    }
  });
});

describe("cli: addedRanges", () => {
  test("hunk headers with +c, +c,d and +c,0 become added-line ranges", () => {
    const diff = [
      "diff --git a/a.md b/a.md",
      "index 1111111..2222222 100644",
      "--- a/a.md",
      "+++ b/a.md",
      "@@ -4,0 +5 @@ The second",
      "+and now longer,",
      "@@ -10,2 +12,3 @@",
      "-old",
      "-old",
      "+new",
      "+new",
      "+@@ -1 +1 @@ a content line that looks like a header",
      "@@ -20,4 +25,0 @@",
      "-gone",
      "-gone",
      "-gone",
      "-gone",
      "",
    ].join("\n");
    expect(addedRanges(diff)).toEqual([[5, 5], [12, 14]]);
    expect(addedRanges("")).toEqual([]);
  });

  test("the diff argv pins zero context and zero inter-hunk context, no external diff, no color", () => {
    expect(gitDiffArgs("HEAD~1", "docs/a.md")).toEqual([
      "diff", "--no-ext-diff", "--no-color", "--inter-hunk-context=0", "-U0", "HEAD~1", "--", "docs/a.md",
    ]);
  });
});

describe("cli: main", () => {
  test("--help returns 0 and prints usage", async () => {
    const f = fakeIo();
    expect(await main(["--help"], f.io)).toBe(0);
    expect(f.stdout()).toContain("usage: prose-gate.ts");
    expect(f.stdout()).toContain("--since <rev>");
    expect(f.stdout()).toBe(`${USAGE}\n`);
    expect(f.stderr()).toBe("");
    const g = fakeIo();
    expect(await main(["-h"], g.io)).toBe(0);
    expect(g.stdout()).toBe(`${USAGE}\n`);
  });

  test("a usage error returns 2 and explains on stderr", async () => {
    const f = fakeIo();
    expect(await main(["--since", "HEAD", "--density", "100", "a.md"], f.io)).toBe(2);
    expect(f.stdout()).toBe("");
    expect(f.stderr()).toContain("prose-gate: --density");
  });

  test("a missing file returns 2 with the path in the message", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-prose-"));
    try {
      const missing = join(dir, "nope.md");
      const f = fakeIo();
      expect(await main(["--full", missing], f.io)).toBe(2);
      expect(f.stderr()).toContain(`prose-gate: cannot read ${missing}`);
      expect(f.stdout()).toBe("");
      // A directory is not a file either.
      const g = fakeIo();
      expect(await main([dir], g.io)).toBe(2);
      expect(g.stderr()).toContain(`prose-gate: cannot read ${dir}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("zero prose exits 2", async () => {
    const f = fakeIo("---\nname: empty\n---\n\n```rust\nlet x = 1; // a — b — c\n```\n");
    expect(await main(["--stdin", "--lang", "md"], f.io)).toBe(2);
    expect(f.stderr()).toContain("prose-gate: no prose to score: stdin");
    // The report still prints (words 0, no hits), so the caller sees what was read.
    expect(lastLine(f.stdout())).toBe("prose-gate: 1 files · 0 sentences · 0 errors · 0 warnings · scope=full");
    // The same through --json: the object still prints, the exit code is still 2.
    const g = fakeIo("<!-- only a comment -->\n");
    expect(await main(["--stdin", "--json"], g.io)).toBe(2);
    expect(JSON.parse(g.stdout())).toMatchObject({ files: [{ path: "stdin", words: 0, sentences: 0, hits: [] }] });
    expect(g.stderr()).toContain("no prose to score: stdin");
  });

  test("stdin draft reports not-just and stays unchanged", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-prose-"));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      const before = readdirSync(dir);
      const f = fakeIo("This change is not just faster, but safer.\n");
      expect(await main(["--stdin", "--lang", "md"], f.io)).toBe(1);
      const lines = f.stdout().trimEnd().split("\n");
      expect(lines).toEqual([
        "stdin  8 words · 0 em · 0 en · 0 ; · 0/100 · 1 sentences",
        "stdin:1 not-just [error]: This change is not just faster, but safer.",
        "  fix: cut the first clause, keep the claim",
        "prose-gate: 1 files · 1 sentences · 1 errors · 0 warnings · scope=full",
      ]);
      expect(f.stderr()).toBe("");
      expect(readdirSync(dir)).toEqual(before);
      expect(before).toEqual([]);
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--json output parses and matches the shape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-prose-"));
    try {
      const file = join(dir, "doc.md");
      writeFileSync(file, "# Title\n\nThe gate — honest,\ncheap — fails; a robust one.\n");
      const f = fakeIo();
      expect(await main(["--json", "--full", file], f.io)).toBe(1);
      const obj = JSON.parse(f.stdout());
      expect(Object.keys(obj).sort()).toEqual(["base", "errors", "files", "scope", "warnings"]);
      expect(obj).toMatchObject({ base: null, scope: "full", errors: 1, warnings: 1 });
      expect(obj.files).toHaveLength(1);
      expect(Object.keys(obj.files[0]).sort()).toEqual(["hits", "path", "per100", "sentences", "separators", "words"]);
      expect(obj.files[0]).toMatchObject({ path: file, words: 9, separators: 3, per100: 33.33, sentences: 2 });
      expect(obj.files[0].hits.map((h: Hit) => Object.keys(h).sort())).toEqual([
        ["excerpt", "fix", "line", "rule", "severity"],
        ["excerpt", "fix", "line", "rule", "severity"],
      ]);
      expect(obj.files[0].hits[0]).toMatchObject({ rule: "dash-pair", severity: "error", line: 3 });
      expect(obj.files[0].hits[1]).toMatchObject({ rule: "vocab-word", severity: "warn", line: 3 });
      expect(f.stderr()).toBe("");
      // Density rides in through the full scope only.
      const g = fakeIo();
      expect(await main(["--json", "--full", "--density", "20", file], g.io)).toBe(1);
      const dense = JSON.parse(g.stdout());
      expect(dense.errors).toBe(2);
      expect(dense.files[0].hits.map((h: Hit) => h.rule)).toEqual(["dash-pair", "density", "vocab-word"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the human report prints the metric line, hits with fixes, errors first, and the summary last", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-prose-"));
    try {
      const file = join(dir, "doc.md");
      writeFileSync(file, "A seamless start.\n\nThe gate — honest,\ncheap — fails the build.\n\nSecond — also\nwrapped — here.\n");
      const f = fakeIo();
      expect(await main([file], f.io)).toBe(1);
      expect(f.stdout().trimEnd().split("\n")).toEqual([
        `${file}  14 words · 4 em · 0 en · 0 ; · 28.57/100 · 3 sentences`,
        `${file}:3 dash-pair [error]: The gate — honest, cheap — fails the build.`,
        "  fix: make the aside its own sentence or put it in parentheses; not a semicolon",
        `${file}:6 dash-pair [error]: Second — also wrapped — here.`,
        "  fix: make the aside its own sentence or put it in parentheses; not a semicolon",
        `${file}:1 vocab-root [warn]: A seamless start.`,
        "  fix: a plainer word, not a synonym",
        "prose-gate: 1 files · 3 sentences · 2 errors · 1 warnings · scope=full",
      ]);
      // A clean file exits 0 and still prints its metric and the summary.
      const clean = join(dir, "clean.md");
      writeFileSync(clean, "Plain words only.\n");
      const g = fakeIo();
      expect(await main([clean], g.io)).toBe(0);
      expect(g.stdout().trimEnd().split("\n")).toEqual([
        `${clean}  3 words · 0 em · 0 en · 0 ; · 0/100 · 1 sentences`,
        "prose-gate: 1 files · 1 sentences · 0 errors · 0 warnings · scope=full",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a .rs file takes rustdoc mode by extension; --rustdoc forces it on any file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-prose-"));
    try {
      const src = [
        "/// This robust, seamless API — fast — and safe.",
        "pub fn x() {",
        '    let s = "delve — into — it"; // not just a, but b',
        "}",
        "",
      ].join("\n");
      const rs = join(dir, "lib.rs");
      writeFileSync(rs, src);
      const f = fakeIo();
      expect(await main(["--json", rs], f.io)).toBe(1);
      const obj = JSON.parse(f.stdout());
      expect(obj.files[0].hits.map((h: Hit) => [h.rule, h.line])).toEqual([
        ["dash-pair", 1],
        ["vocab-root", 1],
        ["vocab-word", 1],
      ]);
      expect(obj.files[0].words).toBe(7);
      // The same bytes under a non-.rs name are markdown: the code is prose and not-just fires.
      const txt = join(dir, "lib.txt");
      writeFileSync(txt, src);
      const g = fakeIo();
      expect(await main(["--json", txt], g.io)).toBe(1);
      expect(JSON.parse(g.stdout()).files[0].hits.map((h: Hit) => h.rule)).toContain("not-just");
      // --rustdoc forces the doc-comment reading on that file.
      const h = fakeIo();
      expect(await main(["--json", "--rustdoc", txt], h.io)).toBe(1);
      expect(JSON.parse(h.stdout()).files[0].hits.map((x: Hit) => x.rule)).toEqual(["dash-pair", "vocab-root", "vocab-word"]);
      // --stdin --lang rustdoc reads a draft the same way.
      const i = fakeIo(src);
      expect(await main(["--json", "--stdin", "--lang", "rustdoc"], i.io)).toBe(1);
      expect(JSON.parse(i.stdout()).files[0]).toMatchObject({ path: "stdin", words: 7 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("since scans only touched sentences", async () => {
    const dir = tempDir();
    try {
      const { a, b, c } = makeRepo(dir);
      const f = fakeIo();
      expect(await main(["--json", "--since", "HEAD", a, c, b], f.io)).toBe(1);
      const obj = JSON.parse(f.stdout());
      expect(obj).toMatchObject({ base: "HEAD", scope: "since", errors: 3, warnings: 0 });
      expect(obj.files.map((x: { path: string }) => x.path)).toEqual([a, c, b]);
      // a.md: the touched sentence spans lines 4-6 and is reported at its first line; the
      // untouched first sentence (lines 1-2) carries a pair too and is not reported.
      expect(obj.files[0].sentences).toBe(1);
      expect(obj.files[0].hits).toHaveLength(1);
      expect(obj.files[0].hits[0]).toMatchObject({ rule: "dash-pair", line: 4 });
      expect(obj.files[0].words).toBe(16);
      // c.md: committed and untouched, so nothing is scanned, but it is listed.
      expect(obj.files[1]).toMatchObject({ words: 3, sentences: 0, hits: [] });
      // b.md: untracked, so every line is added and both pairs are hits.
      expect(obj.files[2].sentences).toBe(2);
      expect(obj.files[2].hits.map((h: Hit) => [h.rule, h.line])).toEqual([["dash-pair", 1], ["dash-pair", 3]]);
      expect(f.stderr()).toBe("");
      // The human summary names the base.
      const g = fakeIo();
      expect(await main(["--since", "HEAD", a, c], g.io)).toBe(1);
      expect(lastLine(g.stdout())).toBe("prose-gate: 2 files · 1 sentences · 1 errors · 0 warnings · scope=since HEAD");
      // With the edit committed, HEAD has no added lines: nothing scanned, exit 0.
      git(dir, "add", "a.md");
      git(dir, "commit", "-q", "-m", "edit");
      const h = fakeIo();
      expect(await main(["--json", "--since", "HEAD", a], h.io)).toBe(0);
      expect(JSON.parse(h.stdout()).files[0]).toMatchObject({ sentences: 0, hits: [] });
      // Against the first commit the same line is added again.
      const i = fakeIo();
      expect(await main(["--json", "--since", "HEAD~1", a], i.io)).toBe(1);
      expect(JSON.parse(i.stdout()).files[0].hits.map((x: Hit) => x.line)).toEqual([4]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--since with an unresolvable rev or outside a repository returns 2", async () => {
    const dir = tempDir();
    const outside = tempDir("rs-prose-norepo-");
    const ceiling = process.env.GIT_CEILING_DIRECTORIES;
    try {
      const { a, c } = makeRepo(dir);
      const f = fakeIo();
      expect(await main(["--since", "no-such-rev", a, c], f.io)).toBe(2);
      expect(f.stderr()).toContain("prose-gate: --since no-such-rev: cannot resolve a commit in ");
      // Two files, one repository: the base is verified once and the message printed once.
      expect(f.stderr().split("cannot resolve a commit").length - 1).toBe(1);
      expect(f.stdout()).toBe("");
      // The temp parent is a ceiling, so git cannot find a repository above the loose file
      // whatever the machine's /tmp happens to be inside of.
      const loose = join(outside, "loose.md");
      writeFileSync(loose, "Words here.\n");
      process.env.GIT_CEILING_DIRECTORIES = tmpdir();
      const g = fakeIo();
      expect(await main(["--since", "HEAD", loose], g.io)).toBe(2);
      expect(g.stderr()).toContain(`prose-gate: ${loose}: not inside a git repository`);
      expect(g.stdout()).toBe("");
    } finally {
      if (ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
      else process.env.GIT_CEILING_DIRECTORIES = ceiling;
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("since follows a symlinked input to its target", async () => {
    const dir = tempDir();
    try {
      const { link, real } = makeRepo(dir);
      const f = fakeIo();
      expect(await main(["--json", "--since", "HEAD", link], f.io)).toBe(1);
      const obj = JSON.parse(f.stdout());
      // Reported under the path given; diffed as the target, whose added line carries the pair.
      expect(obj.files[0]).toMatchObject({ path: link, sentences: 1 });
      expect(obj.files[0].hits.map((h: Hit) => [h.rule, h.line])).toEqual([["dash-pair", 3]]);
      const g = fakeIo();
      expect(await main(["--json", "--since", "HEAD", real], g.io)).toBe(1);
      expect(JSON.parse(g.stdout()).files[0].hits).toEqual(obj.files[0].hits);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("zero prose under since is listed and does not change the exit code; under full it is 2", async () => {
    const dir = tempDir();
    try {
      const { fence, c } = makeRepo(dir);
      // Tracked, untouched, fence only: nothing to scan, nothing wrong.
      const f = fakeIo();
      expect(await main(["--json", "--since", "HEAD", fence, c], f.io)).toBe(0);
      const obj = JSON.parse(f.stdout());
      expect(obj.files[0]).toMatchObject({ path: fence, words: 0, sentences: 0, hits: [] });
      expect(obj.files[1]).toMatchObject({ path: c, words: 3, sentences: 0, hits: [] });
      expect(f.stderr()).toBe("");
      // Untracked and fence only: every line is added, still no prose, still not an error.
      const loose = join(dir, "loose-fence.md");
      writeFileSync(loose, "<!-- nothing -->\n\n```\ncode\n```\n");
      const g = fakeIo();
      expect(await main(["--since", "HEAD", loose], g.io)).toBe(0);
      expect(lastLine(g.stdout())).toBe("prose-gate: 1 files · 0 sentences · 0 errors · 0 warnings · scope=since HEAD");
      expect(g.stderr()).toBe("");
      // The same file under full scope is a gate that read nothing: 2.
      const h = fakeIo();
      expect(await main(["--full", fence], h.io)).toBe(2);
      expect(h.stderr()).toBe(`prose-gate: no prose to score: ${fence}\n`);
      expect(lastLine(h.stdout())).toBe("prose-gate: 1 files · 0 sentences · 0 errors · 0 warnings · scope=full");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the script runs from the shell: --help exits 0 and prints usage", () => {
    const r = Bun.spawnSync(["bun", join(import.meta.dir, "prose-gate.ts"), "--help"], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    expect(r.exitCode).toBe(0);
    expect(new TextDecoder().decode(r.stdout)).toContain("usage: prose-gate.ts");
    const draft = Bun.spawnSync(["bun", join(import.meta.dir, "prose-gate.ts"), "--stdin"], {
      stdout: "pipe", stderr: "pipe", stdin: new TextEncoder().encode("It's worth noting that this — a — b.\n"),
    });
    expect(draft.exitCode).toBe(1);
    const out = new TextDecoder().decode(draft.stdout);
    expect(out).toContain("stdin:1 dash-pair [error]");
    expect(out).toContain("stdin:1 throat-clearing [error]");
    expect(lastLine(out)).toBe("prose-gate: 1 files · 1 sentences · 2 errors · 0 warnings · scope=full");
  });

  test("a large --json report survives a slow pipe reader intact", () => {
    // process.exit right after process.stdout.write drops everything past the pipe buffer
    // (65,536 bytes through `| (sleep 1; cat)` in bun 1.3.14). The in-process io seam and a
    // Bun.spawnSync reader cannot see that; only a real pipe with a slow reader can.
    const dir = tempDir();
    try {
      const big = join(dir, "big.md");
      const n = 5000;
      writeFileSync(
        big,
        Array.from({ length: n }, (_, i) => `Sentence ${i} has — one aside — and a second clause that pads it out.\n`).join("\n"),
      );
      const script = join(import.meta.dir, "prose-gate.ts");
      const r = Bun.spawnSync(["sh", "-c", `"${process.execPath}" "${script}" --json "${big}" | (sleep 1; cat)`], {
        stdout: "pipe", stderr: "pipe", stdin: "ignore",
      });
      const out = new TextDecoder().decode(r.stdout);
      expect(out.length).toBeGreaterThan(1_000_000);
      const obj = JSON.parse(out);
      expect(obj.files[0].sentences).toBe(n);
      expect(obj.files[0].hits).toHaveLength(n);
      expect(obj.errors).toBe(n);
      expect(new TextDecoder().decode(r.stderr)).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--since without git on PATH exits 2 and says so", () => {
    const dir = tempDir();
    try {
      const file = join(dir, "x.md");
      writeFileSync(file, "Words.\n");
      const r = Bun.spawnSync([process.execPath, join(import.meta.dir, "prose-gate.ts"), "--since", "HEAD", file], {
        stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { ...process.env, PATH: "/nonexistent" },
      });
      expect(r.exitCode).toBe(2);
      expect(new TextDecoder().decode(r.stderr)).toBe("prose-gate: --since needs git on PATH\n");
      expect(new TextDecoder().decode(r.stdout)).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});


describe("cli: stdin read errors", () => {
  test("a stdin that cannot be read exits 2 with a message, not a stack trace", async () => {
    const err: string[] = [];
    const out: string[] = [];
    const io = {
      stdin: async () => { throw Object.assign(new Error("EISDIR: illegal operation on a directory"), { code: "EISDIR" }); },
      stdout: (s: string) => { out.push(s); },
      stderr: (s: string) => { err.push(s); },
    };
    const code = await main(["--stdin"], io);
    expect(code).toBe(2);
    expect(out).toEqual([]);
    expect(err.join("")).toBe("prose-gate: cannot read stdin: EISDIR: illegal operation on a directory\n");
  });
});
