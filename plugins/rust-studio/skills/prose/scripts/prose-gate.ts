#!/usr/bin/env bun
// Rust Code Studio — prose gate: the linter core (extraction, sentences, rules, audit).
//
// Finds the tells that make technical prose read as generated: a pair of em-dashes in one
// sentence, "not just X, but Y", a throat-clearing opener, stacked hedges, session talk that
// leaked into a PR body, and (advisory only) the marketing vocabulary. Every hit names a
// source line, the excerpt, and the positive fix. Spec: .rust-studio/specs/prose-gate/spec.md.
//
// Why the non-obvious choices:
// - Paragraphs are unwrapped before sentences are split. 44% of the corpus is hard-wrapped at
//   85-100 columns, and a newline boundary lost 11 of the 19 multi-dash sentences in the plugin
//   README. Every sentence carries the first and last source line it spans instead.
// - A sentence over 220 characters is scanned in 220-character windows. List items and table
//   cells often carry no terminal punctuation, so one "sentence" can be a whole paragraph, and
//   two dashes 400 characters apart are not one aside. The number is SlopMonster's
//   (ItsssssJack/SlopMonster, MIT), reproduced on this corpus.
// - Vocabulary is advisory (`warn`), never blocking. On this corpus it produced zero
//   unambiguous true positives and at least six false positives (`leverage` as a noun four
//   times, "Robustness", `unlocks`), and Rust prose collides with it constantly: `unlock` (a
//   Mutex), `elevated` (privileges), `realm` (Basic auth), `EmbarkStudios`. Two lists, as
//   SlopMonster keeps them: roots for words with no honest sense, whole lowercase words for
//   the rest so a proper noun passes.
// - Two stripping layers. `stripQuoted` (in _lib.ts, shared with the stop-guard) blanks code
//   and quoted specimens; `stripProse` here adds the markdown layer (frontmatter, HTML
//   comments, images, link targets, struck text) that the stop-guard must keep scanning. Both
//   keep every line break, so a hit can name the first line of its sentence.
// - `audit` takes already-stripped text. The CLI picks `stripProse` (markdown) or
//   `rustdocProse` (a .rs file, or any file under --rustdoc) per input.
// - Scope is a union. `{kind: "full"}` scans every sentence and is the only shape that can
//   carry a density ceiling; `{kind: "since", base}` keeps only the sentences that contain a
//   line `git diff -U0 <base>` added, so a touched-lines run never judges a whole file by a
//   few changed sentences. The report prints the base and the sentence count, because a wrong
//   base that scans nothing must be visible, not a pass.
// - Exit 2, never 0, when there is nothing to score: a usage error, an unreadable file, no git
//   or no such rev under --since, or (under full scope and --stdin) an input with zero prose
//   words. A gate that passes because it read nothing is worse than no gate. Under --since a
//   zero-prose file (a fence-only template) is listed with 0 words and 0 sentences and leaves
//   the exit code alone: it was not what changed, and a gate it could block forever is no
//   gate either; the validator's own check (a non-empty prose diff with zero scanned
//   sentences) covers the read-nothing case there.
// - With --json the one object is the only thing on stdout; diagnostics go to stderr. The one
//   exemption is --help, which prints the usage text whatever else is on the command line.
//
// Zero dependencies (bun, no imports beyond _lib.ts) so the file ships inside the /prose
// bundle. `prose-gate.ts --help` prints the CLI; the validator runs
// `--json --full --density 100 <landing files>` and `--json --since <base> <the rest>`.

import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { stripQuoted, which } from "./_lib.ts";

export type Severity = "error" | "warn";

export interface Rule {
  id: string;
  severity: Severity;
  /** The positive fix, printed with every hit. */
  fix: string;
  /** Matched excerpts in one sentence (apostrophes already normalized); empty when clean. */
  test(sentence: string): string[];
}

export interface Hit {
  rule: string;
  severity: Severity;
  /** 1-based source line of the sentence's first character (1 for `density`). */
  line: number;
  excerpt: string;
  fix: string;
}

export interface Metric {
  words: number;
  emDashes: number;
  /** Spaced en-dashes (` – `) used as separators; a range like 2020–2026 is not one. */
  enDashes: number;
  semicolons: number;
  /** Separators per 100 words, two decimals; 0 when there are no words. */
  per100: number;
}

export interface Sentence {
  /** 1-based source line of the sentence's first character. */
  line: number;
  /** 1-based source line of the sentence's last character. */
  endLine: number;
  text: string;
}

/** A sentence longer than this is scanned as consecutive windows of this many characters. */
export const WINDOW = 220;

export const DENSITY_FIX =
  "rewrite asides as sentences; semicolons and en-dashes count, so swapping the glyph does not pass";

// ---------------------------------------------------------------------------------------------
// Extraction: markdown and rustdoc to line-preserving prose
// ---------------------------------------------------------------------------------------------

/** Every non-newline run in `m` becomes one space, so a blanked span keeps its line breaks. */
function blankKeepingLines(m: string): string {
  return m.replace(/[^\n]+/g, " ");
}

const FRONTMATTER_DELIMITER = /^---\s*$/;

/** The index of the closing `---` when `lines` starts with frontmatter, else -1. */
function frontmatterClose(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return -1;
  for (let i = 1; i < lines.length; i++) if (FRONTMATTER_DELIMITER.test(lines[i])) return i;
  return -1;
}

/** YAML frontmatter is blanked in place, except the `description:` value: its bare value
 *  (quotes removed) replaces the line, so the highest-traffic prose in the plugin is scanned.
 *  The two `---` delimiter lines stay: they carry no words, and `sentences` reads them to
 *  treat what is between as one sentence per line (the description is scanned as one
 *  sentence, spec §1, whatever punctuation it holds). Only the single-line form is handled;
 *  a block scalar (`description: >`) is blanked like any other key, and none exists here. */
function stripFrontmatter(lines: string[]): void {
  const close = frontmatterClose(lines);
  if (close < 0) return;
  for (let i = 1; i < close; i++) {
    const m = /^description:[ \t]*(.*?)\s*$/.exec(lines[i]);
    lines[i] = m ? m[1].replace(/^(["'])([\s\S]*)\1$/, "$2") : "";
  }
}

/** Markdown to prose, line-preserving: frontmatter (except the description and the `---`
 *  delimiters), HTML comments, images, link targets, reference-link definitions, autolinks
 *  and bare URLs, and `~~struck~~` text become blanks; link text stays; headings keep their
 *  text and their `#` marker, which `sentences` uses as a block boundary and drops from the
 *  sentence it emits. Then the shared `stripQuoted` layer blanks code and quoted specimens. */
export function stripProse(text: string): string {
  const lines = text.split("\n");
  stripFrontmatter(lines);
  const md = lines
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, blankKeepingLines) // HTML comments
    .replace(/!\[[^\]]*\]\([^)\n]*\)/g, blankKeepingLines) // images: alt text is not prose
    .replace(/\[([^\]]*)\]\([^)\n]*\)/g, "$1") // links keep their text, lose the target
    .replace(/\[([^\]]*)\]\[[^\]\n]*\]/g, "$1") // reference-style links
    .replace(/^[ \t]*\[[^\]\n]+\]:[ \t]+\S.*$/gm, " ") // reference-link definitions
    .replace(/<[a-z][a-z0-9+.-]*:[^>\s]*>/gi, " ") // autolinks
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)>\]]*[^\s.,;:!?)\]>]/gi, " ") // bare URLs
    .replace(/~~[^~\n]+~~/g, " "); // struck text
  return stripQuoted(md);
}

/** A `.rs` file as prose: each `///` or `//!` line yields its comment text (one leading space
 *  dropped), every other line becomes empty, and the markdown layer then applies, because
 *  rustdoc is markdown (a code fence inside a doc comment is blanked like any other).
 *  Out of scope, on purpose: block doc comments (`/** ... *\/`) and `#[doc = "..."]`
 *  attributes, both rare in hand-written docs. A `////` line is a plain comment, not a doc
 *  comment, and is skipped like one. */
export function rustdocProse(source: string): string {
  const lines = source.split("\n").map((l) => {
    const m = /^\s*\/\/[/!](?!\/) ?(.*)/.exec(l);
    return m ? m[1] : "";
  });
  return stripProse(lines.join("\n"));
}

// ---------------------------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------------------------

const BLANK = /^\s*$/;
const HR = /^\s*(?:([-*_])(?:\s*\1){2,}|={3,})\s*$/; // thematic break or a setext underline
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_SEPARATOR_CELL = /^\s*:?-+:?\s*$/;
/** `.`, `!` or `?` (a run of them, captured), any closing quote, bracket or emphasis marker,
 *  then whitespace. The whitespace is a lookahead so the next sentence starts after it; the
 *  capture lets the abbreviation checks read the text up to the punctuation itself, so
 *  `etc.)` is still `etc.` to them. */
const TERMINATOR = /([.!?]+)["'”’)\]*_]*(?=\s)/g;
/** `e.g.`, `i.e.`, `cf.` and `vs.` never end a sentence: what follows them is the example,
 *  the reference or the other side (`Rust vs. Go`, `cf. RFC 2119`), whether it is a capital,
 *  a digit, a stripped code span, or a bracket. Applied to the few characters before and
 *  including the candidate period. */
const NEVER_TERMINAL = /(?:^|[\s(])(?:e\.g|i\.e|cf|vs)\.$/i;
/** `etc.` ends a sentence unless one space and a lowercase letter follow (`etc. and go on`,
 *  `etc.) explicitly`). This is the safe direction: the blank a stripped span leaves (two or
 *  more spaces), a dash, or a capital all end the sentence, and a split can only hide a dash
 *  pair, never invent one. */
const ETC = /(?:^|[\s(])etc\.$/i;
const LOWERCASE_CONTINUES = /^\s\p{Ll}/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;

interface Part {
  text: string;
  line: number;
}

/** Split `text` into trimmed [start, end) sentence ranges. Both context checks look at a
 *  bounded window around the candidate (8 characters back, 3 forward) so a block with many
 *  sentences costs linear time, not one copy of the block per terminator. */
function sentenceRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const push = (s: number, e: number) => {
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) ranges.push([s, e]);
  };
  let start = 0;
  const re = new RegExp(TERMINATOR.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const punctuation = m.index + m[1].length;
    const before = text.slice(Math.max(0, punctuation - 8), punctuation);
    if (NEVER_TERMINAL.test(before)) continue;
    if (ETC.test(before) && LOWERCASE_CONTINUES.test(text.slice(end, end + 3))) continue;
    push(start, end);
    start = end;
  }
  push(start, text.length);
  return ranges;
}

/** Join one block's lines with a single space, split it into sentences (or keep the block
 *  whole when `split` is false), window the long ones, and map every sentence back to the
 *  source lines it spans. A unit with no word character (a `—` table cell, a bare marker)
 *  is not a sentence. */
function emitBlock(parts: Part[], out: Sentence[], split = true): void {
  let joined = "";
  const starts: { at: number; line: number }[] = [];
  for (const p of parts) {
    if (joined) joined += " ";
    starts.push({ at: joined.length, line: p.line });
    joined += p.text;
  }
  // Offsets are asked for in ascending order, so a cursor that only moves forward keeps the
  // whole block linear (a top-down scan per sentence was quadratic on a 24,000-line block).
  let cursor = 0;
  const lineAt = (offset: number): number => {
    while (cursor + 1 < starts.length && starts[cursor + 1].at <= offset) cursor++;
    return starts[cursor].line;
  };
  const ranges = split ? sentenceRanges(joined) : [[0, joined.length] as [number, number]];
  for (const [start, end] of ranges) {
    if (!WORD_CHAR.test(joined.slice(start, end))) continue;
    const line = lineAt(start);
    const endLine = lineAt(end - 1);
    for (let w = start; w < end; w += WINDOW) {
      out.push({ line, endLine, text: joined.slice(w, Math.min(w + WINDOW, end)) });
    }
  }
}

/** Sentences of already-stripped prose, each with the 1-based source lines it spans.
 *
 *  A block is a run of consecutive non-blank lines, unwrapped with single spaces. Block
 *  boundaries: a blank line, a thematic break, a heading line (its text is one unit, the `#`
 *  markers dropped), the start of a bullet or numbered item (its indented continuation lines
 *  join it), and a table row, whose cells are each their own unit (the header separator row
 *  is skipped). Inside a block, `.`, `!` or `?` followed by whitespace ends a sentence, except
 *  after `e.g.`, `i.e.`, `cf.`, `vs.` (never), or after `etc.` when a lowercase letter
 *  follows. A sentence over `WINDOW` characters is emitted as consecutive windows carrying
 *  the whole sentence's span. Frontmatter (`---` on line 1 to the next `---`) is one
 *  sentence per non-blank line, unsplit: after `stripProse` that is the `description:`
 *  value, which the spec scans as a single sentence. */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const lines = text.split("\n");
  let block: Part[] = [];
  const flush = () => {
    if (block.length) emitBlock(block, out);
    block = [];
  };
  const close = frontmatterClose(lines);
  for (let i = 1; i < close; i++) {
    const value = lines[i].trim();
    if (value) emitBlock([{ text: value, line: i + 1 }], out, false);
  }
  for (let i = close + 1; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const n = i + 1;
    if (BLANK.test(line) || HR.test(line)) {
      flush();
      continue;
    }
    if (TABLE_ROW.test(line)) {
      flush();
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/);
      if (cells.every((c) => TABLE_SEPARATOR_CELL.test(c))) continue;
      for (const c of cells) emitBlock([{ text: c.replace(/\\\|/g, "|").trim(), line: n }], out);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      emitBlock([{ text: heading[1], line: n }], out);
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      block.push({ text: bullet[1], line: n });
      continue;
    }
    block.push({ text: line.trim(), line: n });
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------

/** Curly apostrophes become straight ones so `it’s` matches `it's`. */
function normalize(sentence: string): string {
  return sentence.replace(/[’‘]/g, "'");
}

function matches(re: RegExp): (sentence: string) => string[] {
  return (sentence) => Array.from(normalize(sentence).matchAll(re), (m) => m[0]);
}

/** Two or more em-dashes in one sentence or window: the excerpt runs from the first to the
 *  second, which is the aside the fix asks to lift out. One hit per sentence. */
function dashPair(sentence: string): string[] {
  const first = sentence.indexOf("—");
  if (first < 0) return [];
  const second = sentence.indexOf("—", first + 1);
  return second < 0 ? [] : [sentence.slice(first, second + 1)];
}

/** A sentence that carries its own measurement is cited, not claimed. */
const MEASUREMENT = /measur|bench|criterion|hyperfine|\bperf\b|\d\s*(?:ms|µs|us|ns)\b/i;
/** A number that reads as a count, not a year, a version or a small ordinal: a thousands
 *  separator, a trailing `+`, a magnitude word, or three or more digits that are not a
 *  19xx/20xx year. `Since 2001 teams`, `Rust 1.85 users` and `Version 2 customers` pass. */
const COUNT = String.raw`(?<![\w.])(?:\d{1,3}(?:,\d{3})+\+?|\d+(?:\.\d+)?\s*(?:k|m|thousand|million|billion)\b\+?|\d+\+|(?!(?:19|20)\d\d\b)\d{3,})`;
const NUMBER_BESIDE_PEOPLE = new RegExp(
  `${COUNT}\\s+(?:[a-z]+\\s+)?(?:users|developers|devs|customers|teams|engineers|companies|contributors|people|clients|maintainers|organi[sz]ations)\\b`,
  "gi",
);
const UNSOURCED_SPEEDUP =
  /\d+(?:\.\d+)?\s*[x×]\s*faster|\d+(?:\.\d+)?\s*%\s*(?:fewer|less|more|smaller|slower|faster|improvement)/gi;

function proof(sentence: string): string[] {
  const s = normalize(sentence);
  if (MEASUREMENT.test(s)) return [];
  // In text order, so `audit` can locate each excerpt after the previous one.
  return [...s.matchAll(NUMBER_BESIDE_PEOPLE), ...s.matchAll(UNSOURCED_SPEEDUP)]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((m) => m[0]);
}

/** The rule table from the spec, in the spec's order. Only `error` moves an exit code, and
 *  the CLI derives it from this field in one place. `density` is not a rule here: it is a
 *  per-file measure that `audit` applies only when a caller passes a ceiling. */
export const RULES: readonly Rule[] = [
  {
    id: "dash-pair",
    severity: "error",
    fix: "make the aside its own sentence or put it in parentheses; not a semicolon",
    test: dashPair,
  },
  {
    // The continuation is what makes it the construction: a sentence-final "X, not just Y."
    // is an ordinary contrast and does not fire.
    id: "not-just",
    severity: "error",
    fix: "cut the first clause, keep the claim",
    test: matches(
      /(?:\b(?:can)?not\b|n['’]t)\s+(?:just|only|merely|simply)\b.*?(?:\bbut\b|,\s*(?:it's|it is|this|that|they|we|you)\b)/gi,
    ),
  },
  {
    id: "throat-clearing",
    severity: "error",
    fix: "start at the claim",
    test: matches(
      /\b(?:it(?:'s| is) worth noting|it(?:'s| is) important to note|that being said|at the end of the day|in conclusion|to sum up|here's the thing|let's dive)\b/gi,
    ),
  },
  {
    id: "hedge-stack",
    severity: "error",
    fix: "one hedge or none",
    test: matches(/\b(?:(?:may|could) potentially|might possibly)\b/gi),
  },
  {
    // `as requested` and `let me know if` are ordinary PR English and are not here.
    id: "process-bleed",
    severity: "error",
    fix: "delete; the reader was not in the session",
    test: matches(/\bI(?:'ve| have) analy[sz]ed\b|\bI have reviewed the\b|\bI hope this helps\b|\b[Aa]s an AI\b/g),
  },
  {
    // Root-matched, any case: these have no honest sense in technical prose.
    id: "vocab-root",
    severity: "warn",
    fix: "a plainer word, not a synonym",
    test: matches(
      /(?<![\w-])(?:delv|seamless|cutting-edge|state-of-the-art|game-chang|revolutioni[sz]|transformativ|synerg|paradigm|tapestr|testament to|unparalleled|supercharg|world-class|best-in-class|ever-evolving|fast-paced|deep[ -]div|next-level)\w*/gi,
    ),
  },
  {
    // Whole lowercase words or phrases, bounded so `high-leverage`, `robustness` and
    // `counterintuitive` pass, and a proper noun (`Robust`, `EmbarkStudios`) passes by case.
    // `realm of` rather than bare `realm` (Basic realm); `unlock the power`, not `unlock`.
    id: "vocab-word",
    severity: "warn",
    fix: "say what it does",
    test: matches(
      /(?<![\w-])(?:journeys?|landscapes?|realm of|robust|comprehensive|intuitive|leverage[sd]?|leveraging|streamlines?|empowers?|elevates?|unlock the (?:power|potential|full)|harness the power|navigate the|in today's|embark on)(?![\w-])/g,
    ),
  },
  {
    id: "proof",
    severity: "warn",
    fix: "cite the measurement or write [needs number]",
    test: proof,
  },
];

// ---------------------------------------------------------------------------------------------
// Metric and audit
// ---------------------------------------------------------------------------------------------

/** Words, em-dashes, spaced en-dashes, semicolons and separators per 100 words of stripped
 *  prose. Printed for every file: a dash pair rewritten as a semicolon shows up here. A word
 *  is a run of letters and digits of any script, so Cyrillic prose is not "zero prose". */
export function measure(text: string): Metric {
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
  const emDashes = (text.match(/—/g) ?? []).length;
  const enDashes = (text.match(/(?<=^|\s)–(?=\s|$)/gm) ?? []).length;
  const semicolons = (text.match(/;/g) ?? []).length;
  const separators = emDashes + enDashes + semicolons;
  const per100 = words ? Math.round((separators * 100 * 100) / words) / 100 : 0;
  return { words, emDashes, enDashes, semicolons, per100 };
}

/** Up to 20 characters before the match and enough after it to make about 60 of context,
 *  on one line, with an ellipsis where the sentence continues. */
const CONTEXT = 60;
function excerptOf(sentence: string, match: string, from: number): { excerpt: string; next: number } {
  const at = Math.max(0, sentence.indexOf(match, from));
  const lead = Math.min(20, at);
  const start = at - lead;
  const end = Math.min(sentence.length, at + match.length + (CONTEXT - lead));
  let excerpt = sentence.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) excerpt = `…${excerpt}`;
  if (end < sentence.length) excerpt = `${excerpt}…`;
  return { excerpt, next: at + match.length };
}

/** Run every rule over every sentence of already-stripped prose. With `opts.density`, one
 *  `density` error is added when (em-dashes + spaced en-dashes + semicolons) / words exceeds
 *  1 / density; the CLI passes that only under full scope, so a touched-lines run never
 *  judges a whole file by a few changed sentences. With `opts.keep`, only the sentences it
 *  accepts are scanned and counted (the `since` scope keeps the touched ones); the metric is
 *  always the whole text's. */
export function audit(
  text: string,
  opts: { density?: number; keep?: (unit: Sentence) => boolean } = {},
): { hits: Hit[]; metric: Metric; sentences: number } {
  const units = opts.keep ? sentences(text).filter(opts.keep) : sentences(text);
  const hits: Hit[] = [];
  for (const unit of units) {
    const s = normalize(unit.text);
    for (const rule of RULES) {
      let from = 0;
      for (const match of rule.test(s)) {
        const { excerpt, next } = excerptOf(s, match, from);
        from = next;
        hits.push({ rule: rule.id, severity: rule.severity, line: unit.line, excerpt, fix: rule.fix });
      }
    }
  }
  const metric = measure(text);
  const density = opts.density;
  if (density != null && density > 0 && metric.words > 0) {
    const separators = metric.emDashes + metric.enDashes + metric.semicolons;
    if (separators * density > metric.words) {
      hits.push({
        rule: "density",
        severity: "error",
        line: 1,
        excerpt:
          `${metric.emDashes} em-dashes, ${metric.enDashes} en-dashes, ${metric.semicolons} semicolons ` +
          `in ${metric.words} words: ${metric.per100} per 100, ceiling 1 per ${density}`,
        fix: DENSITY_FIX,
      });
    }
  }
  return { hits, metric, sentences: units.length };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

/** What is scanned. `density` lives only under `full`: the type, not a flag check, is what
 *  keeps a touched-lines run from judging a whole file by a few changed sentences. */
export type Scope = { kind: "full"; density?: number } | { kind: "since"; base: string };

export type Lang = "md" | "rustdoc";

export interface Options {
  scope: Scope;
  files: string[];
  stdin: boolean;
  /** How a `--stdin` draft is read (files are read by extension, or all as rustdoc). */
  lang: Lang;
  rustdoc: boolean;
  json: boolean;
  help: boolean;
}

/** The streams, injectable so a test drives `main` without a process. */
export interface Io {
  stdin: () => Promise<string>;
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface FileReport {
  path: string;
  words: number;
  /** em-dashes + spaced en-dashes + semicolons. */
  separators: number;
  per100: number;
  /** Sentences scanned: every one under `full`, the touched ones under `since`. */
  sentences: number;
  hits: Hit[];
}

export interface Report {
  base: string | null;
  scope: Scope["kind"];
  files: FileReport[];
  errors: number;
  warnings: number;
}

export const USAGE = `usage: prose-gate.ts [--full [--density N] | --since <rev>] [--rustdoc] [--json] <file> [more ...]
       prose-gate.ts --stdin [--lang md|rustdoc] [--json]

scope (default --full):
  --full            scan every sentence of every file
  --density N       with --full only: an error when em-dashes + spaced en-dashes + semicolons
                    exceed 1 per N prose words (the validator passes 100 for landing files)
  --since <rev>     scan only the sentences that contain a line added since <rev>, read from
                    git diff -U0 <rev> -- <file>; an untracked file is all added lines; a file
                    with no added lines is listed with 0 sentences; density never applies

inputs:
  <file>            markdown; a .rs file is read in rustdoc mode (/// and //! bodies only)
  --rustdoc         read every file in rustdoc mode, whatever its extension
  --stdin           read one draft from stdin instead of files
  --lang md|rustdoc with --stdin: how the draft is read (default md)

output:
  a metric line per file, a line per hit with its fix (errors first), then the summary:
  prose-gate: <files> files · <sentences> sentences · <errors> errors · <warnings> warnings · scope=<full|since <rev>>
  --json            one object on stdout instead: {base, scope, files: [{path, words, separators,
                    per100, sentences, hits: [{rule, severity, line, excerpt, fix}]}], errors, warnings}
  -h, --help        this text

exit codes: 0 clean; 1 at least one error hit; 2 could not evaluate (usage, an unreadable file,
--since without git or with an unresolvable rev, or zero prose words in an input under --full
or --stdin; under --since such a file is listed with 0 sentences). A warning never changes the
exit code.`;

export function parseArgs(argv: string[]): Options | Error {
  const o: Options = { scope: { kind: "full" }, files: [], stdin: false, lang: "md", rustdoc: false, json: false, help: false };
  let full = false;
  let since: string | undefined;
  let density: number | undefined;
  let lang: Lang | undefined;
  let positional = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (positional || !a.startsWith("-")) { o.files.push(a); continue; }
    switch (a) {
      case "--": positional = true; break;
      case "-h": case "--help": o.help = true; break;
      case "--full": full = true; break;
      case "--since": {
        const v = argv[++i];
        if (!v || v.startsWith("-")) return new Error("--since needs a revision (a commit, a branch, a tag, or @{upstream})");
        since = v; break;
      }
      case "--density": {
        const v = argv[++i];
        // Digits only: Number() would also take `1e2`, `0x10` and ` 100`.
        if (!v || !/^\d+$/.test(v) || Number(v) < 1) return new Error("--density needs a positive integer N: an error above 1 separator per N prose words");
        density = Number(v); break;
      }
      case "--stdin": o.stdin = true; break;
      case "--lang": {
        const v = argv[++i];
        if (v !== "md" && v !== "rustdoc") return new Error("--lang needs md or rustdoc");
        lang = v; break;
      }
      case "--rustdoc": o.rustdoc = true; break;
      case "--json": o.json = true; break;
      default: return new Error(`unknown option ${a}`);
    }
  }
  if (o.help) return o;
  if (full && since != null) return new Error("--full and --since are exclusive");
  if (since != null && density != null) return new Error("--density applies to --full only; --since never judges a whole file by its touched sentences");
  o.scope = since != null ? { kind: "since", base: since } : density != null ? { kind: "full", density } : { kind: "full" };
  if (lang != null && !o.stdin) return new Error("--lang applies to --stdin; a file is read by its extension, or every file under --rustdoc");
  if (lang != null) o.lang = lang;
  if (o.stdin && o.rustdoc) return new Error("--rustdoc applies to files; a draft is read with --stdin --lang rustdoc");
  if (o.stdin && o.files.length) return new Error("--stdin and files are exclusive");
  if (o.stdin && since != null) return new Error("--since needs files inside a git repository, not --stdin");
  if (!o.stdin && o.files.length === 0) return new Error("name at least one file, or pass --stdin");
  return o;
}

/** The 1-based, inclusive line ranges a unified diff adds, read from its `@@ -a[,b] +c[,d] @@`
 *  hunk headers: `d` omitted is one line; `d` of 0 is a pure deletion and adds nothing. Only
 *  headers are read: with -U0 every other line starts with `+`, `-`, `\\` or a word, so a
 *  content line cannot pass for one. */
export function addedRanges(diff: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] == null ? 1 : Number(m[2]);
    if (count > 0) out.push([start, start + count - 1]);
  }
  return out;
}

const GIT_TIMEOUT_MS = 30_000;

/** Run git with `process.env` passed explicitly: in bun 1.3 a child spawned without `env`
 *  gets the environ the process started with, so a `GIT_CEILING_DIRECTORIES` or `GIT_DIR`
 *  set at run time (the tests do) would never reach git. Null on a timeout, a signal, or a
 *  spawn failure, the same contract as `run()` in _lib.ts, which cannot pass `env`. */
function git(args: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } | null {
  try {
    const r = Bun.spawnSync(["git", ...args], {
      cwd, env: process.env, timeout: GIT_TIMEOUT_MS, stdout: "pipe", stderr: "pipe", stdin: "ignore",
    });
    if (r.exitedDueToTimeout || r.signalCode != null || r.exitCode == null) return null;
    const text = (u: Uint8Array | undefined) => (u ? new TextDecoder().decode(u) : "");
    return { exitCode: r.exitCode, stdout: text(r.stdout), stderr: text(r.stderr) };
  } catch {
    return null;
  }
}

/** The argv of the diff a `--since` run reads: no context and no inter-hunk context (a
 *  user's `diff.interHunkContext` would otherwise fuse nearby hunks and count the unchanged
 *  lines between them as added), no external diff driver, no color. */
export function gitDiffArgs(base: string, rel: string): string[] {
  return ["diff", "--no-ext-diff", "--no-color", "--inter-hunk-context=0", "-U0", base, "--", rel];
}

interface Located {
  /** The input's real path: a symlink is followed, so git diffs the target, not the link. */
  abs: string;
  root: string;
}

/** Where `file` lives: its real path and the top level of its repository (memoised per
 *  directory; git reports the top level with symlinks resolved, so the path is realpath'd
 *  first). */
function locate(file: string, roots: Map<string, string>): Located | Error {
  let abs: string;
  try {
    abs = realpathSync(resolve(file));
  } catch (e) {
    return new Error(`${file}: ${(e as Error).message}`);
  }
  const dir = dirname(abs);
  let root = roots.get(dir);
  if (root == null) {
    const r = git(["rev-parse", "--show-toplevel"], dir);
    if (r == null) return new Error(`${file}: git did not answer`);
    if (r.exitCode !== 0) return new Error(`${file}: not inside a git repository`);
    root = r.stdout.trim();
    roots.set(dir, root);
  }
  return { abs, root };
}

/** Does `base` name a commit in `root`? Asked once per repository; the caller caches. */
function verifyBase(root: string, base: string): Error | null {
  const r = git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], root);
  if (r == null) return new Error(`--since ${base}: git did not answer`);
  if (r.exitCode !== 0) return new Error(`--since ${base}: cannot resolve a commit in ${root}`);
  return null;
}

/** The added-line ranges of a located file against `base`: `null` when the file is untracked
 *  (every line is added). */
function addedLinesOf(file: string, at: Located, base: string): [number, number][] | null | Error {
  const rel = relative(at.root, at.abs).replace(/\\/g, "/");
  const tracked = git(["ls-files", "--error-unmatch", "--", rel], at.root);
  if (tracked == null) return new Error(`${file}: git did not answer`);
  if (tracked.exitCode !== 0) return null;
  const diff = git(gitDiffArgs(base, rel), at.root);
  if (diff == null) return new Error(`${file}: git did not answer`);
  if (diff.exitCode !== 0) return new Error(`${file}: git diff -U0 ${base} failed: ${diff.stderr.trim()}`);
  return addedRanges(diff.stdout);
}

/** A sentence is touched when the lines it spans meet an added range. Every window of a
 *  long sentence carries the same span, so they are kept or dropped together. */
function touched(ranges: [number, number][]): (unit: Sentence) => boolean {
  return (unit) => ranges.some(([from, to]) => unit.line <= to && unit.endLine >= from);
}

interface Input {
  path: string;
  text: string;
  lang: Lang;
}

function readInput(path: string, rustdoc: boolean): Input | Error {
  try {
    if (!statSync(path).isFile()) return new Error(`cannot read ${path}: not a regular file`);
    const text = readFileSync(path, "utf8");
    return { path, text, lang: rustdoc || path.endsWith(".rs") ? "rustdoc" : "md" };
  } catch (e) {
    return new Error(`cannot read ${path}: ${(e as Error).message}`);
  }
}

interface FileResult {
  path: string;
  metric: Metric;
  sentences: number;
  hits: Hit[];
}

/** One input through extraction, the metric and the rules. Zero prose words short-circuits
 *  before any rule runs; under full scope the caller turns that into exit 2. Hits come back
 *  errors first, so the report and the JSON agree on order. */
function scan(input: Input, scope: Scope, keep?: (unit: Sentence) => boolean): FileResult {
  const prose = input.lang === "rustdoc" ? rustdocProse(input.text) : stripProse(input.text);
  const metric = measure(prose);
  if (metric.words === 0) return { path: input.path, metric, sentences: 0, hits: [] };
  const density = scope.kind === "full" ? scope.density : undefined;
  const r = audit(prose, { density, keep });
  const rank = (h: Hit) => (h.severity === "error" ? 0 : 1);
  const hits = r.hits.slice().sort((a, b) => rank(a) - rank(b));
  return { path: input.path, metric: r.metric, sentences: r.sentences, hits };
}

/** The exit code is derived from severity here and nowhere else. */
function tally(results: FileResult[]): { errors: number; warnings: number; sentences: number } {
  let errors = 0, warnings = 0, sentences = 0;
  for (const r of results) {
    sentences += r.sentences;
    for (const h of r.hits) if (h.severity === "error") errors++; else warnings++;
  }
  return { errors, warnings, sentences };
}

function summaryLine(results: FileResult[], scope: Scope): string {
  const t = tally(results);
  const label = scope.kind === "full" ? "full" : `since ${scope.base}`;
  return `prose-gate: ${results.length} files · ${t.sentences} sentences · ${t.errors} errors · ${t.warnings} warnings · scope=${label}`;
}

function formatHuman(results: FileResult[], scope: Scope): string {
  const out: string[] = [];
  for (const r of results) {
    const m = r.metric;
    out.push(`${r.path}  ${m.words} words · ${m.emDashes} em · ${m.enDashes} en · ${m.semicolons} ; · ${m.per100}/100 · ${r.sentences} sentences`);
    for (const h of r.hits) {
      out.push(`${r.path}:${h.line} ${h.rule} [${h.severity}]: ${h.excerpt}`);
      out.push(`  fix: ${h.fix}`);
    }
  }
  out.push(summaryLine(results, scope));
  return out.join("\n") + "\n";
}

function toReport(results: FileResult[], scope: Scope): Report {
  const t = tally(results);
  return {
    base: scope.kind === "since" ? scope.base : null,
    scope: scope.kind,
    files: results.map((r) => ({
      path: r.path,
      words: r.metric.words,
      separators: r.metric.emDashes + r.metric.enDashes + r.metric.semicolons,
      per100: r.metric.per100,
      sentences: r.sentences,
      hits: r.hits,
    })),
    errors: t.errors,
    warnings: t.warnings,
  };
}

const REAL_IO: Io = {
  stdin: () => Bun.stdin.text(),
  stdout: (s) => { process.stdout.write(s); },
  stderr: (s) => { process.stderr.write(s); },
};

/** Exit 0 clean, 1 with at least one error hit, 2 when nothing could be scored: a usage
 *  error, an unreadable file, git trouble under --since, or, under full scope, an input with
 *  zero prose words (the report still prints, so the caller sees what was read; the
 *  diagnostic goes to stderr). With --json the only thing on stdout is the one object. */
export async function main(argv: string[], io: Io = REAL_IO): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed instanceof Error) { io.stderr(`prose-gate: ${parsed.message}\n\n${USAGE}\n`); return 2; }
  if (parsed.help) { io.stdout(`${USAGE}\n`); return 0; }
  const o = parsed;

  const inputs: Input[] = [];
  const problems: string[] = [];
  if (o.stdin) {
    // A directory or a closed descriptor on stdin throws (EISDIR, EBADF); map it to exit 2
    // here so the exit code keeps being derived in one place, never from an unhandled
    // rejection (bun prints a stack trace and exits 1, the "hits found" code, with no hit).
    let text: string;
    try { text = await io.stdin(); } catch (e) {
      io.stderr(`prose-gate: cannot read stdin: ${(e as Error)?.message ?? String(e)}\n`); return 2;
    }
    inputs.push({ path: "stdin", text, lang: o.lang });
  }
  for (const f of o.files) {
    const r = readInput(f, o.rustdoc);
    if (r instanceof Error) problems.push(r.message); else inputs.push(r);
  }
  if (problems.length) { for (const p of problems) io.stderr(`prose-gate: ${p}\n`); return 2; }

  const keeps: (((unit: Sentence) => boolean) | undefined)[] = inputs.map(() => undefined);
  if (o.scope.kind === "since") {
    const { base } = o.scope;
    if (!which("git")) { io.stderr("prose-gate: --since needs git on PATH\n"); return 2; }
    const roots = new Map<string, string>();
    // Verified once per repository, so a bad base is reported once, not once per file.
    const bases = new Map<string, Error | null>();
    for (let i = 0; i < inputs.length; i++) {
      const at = locate(inputs[i].path, roots);
      if (at instanceof Error) { problems.push(at.message); continue; }
      if (!bases.has(at.root)) {
        const e = verifyBase(at.root, base);
        bases.set(at.root, e);
        if (e) problems.push(e.message);
      }
      if (bases.get(at.root)) continue;
      const r = addedLinesOf(inputs[i].path, at, base);
      if (r instanceof Error) problems.push(r.message);
      else if (r != null) keeps[i] = touched(r);
    }
    if (problems.length) { for (const p of problems) io.stderr(`prose-gate: ${p}\n`); return 2; }
  }

  const results = inputs.map((input, i) => scan(input, o.scope, keeps[i]));
  const report = toReport(results, o.scope);
  io.stdout(o.json ? `${JSON.stringify(report, null, 2)}\n` : formatHuman(results, o.scope));
  const empty = o.scope.kind === "full" ? results.filter((r) => r.metric.words === 0) : [];
  for (const r of empty) io.stderr(`prose-gate: no prose to score: ${r.path}\n`);
  return empty.length ? 2 : report.errors > 0 ? 1 : 0;
}

if (import.meta.main) {
  // exitCode, not exit(): exit() right after a stdout write drops what has not left the
  // pipe yet (65,536 bytes of a 1 MB --json report reached a slow reader). Nothing keeps the
  // loop alive, so the process ends once stdout has drained.
  process.exitCode = await main(process.argv.slice(2));
}
