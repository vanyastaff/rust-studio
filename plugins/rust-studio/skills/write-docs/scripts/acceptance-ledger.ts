// Rust Code Studio — acceptance ledger: parser, state model, evidence binding, lint.
//
// A ledger (`.rust-studio/specs/<slug>/acceptance.md`) turns a spec's acceptance criteria
// into gates a checker can decide. A runnable gate carries a `CHECK:` command and an
// `EXPECT:` marker; it counts as met only when the command exits 0 AND the marker matches
// the combined output, and the evidence line binds that result to a digest of the exact
// definition it proved. Edit the CHECK and the evidence goes stale on its own.
//
// This module never executes anything. The CLI (`acceptance-check.ts`) runs commands; the
// Stop hook (`acceptance-guard.ts`) only reads state through here. Zero dependencies beyond
// node:crypto so the same file ships inside the /acceptance skill bundle.
//
// Format contract: docs/acceptance-ledger.md (edit there first; this file follows it).
// Adapted from Leonxlnx/unlazy's gate ledger (MIT) — the format, the exit-0-plus-EXPECT rule,
// the definition-bound evidence, and abandonment-as-handoff; the lint's cargo trap is ours.

import { createHash } from "node:crypto";

export const EVIDENCE_TAG = "rs-acceptance/v1";
export const MAX_EXPECT_LENGTH = 512;

export interface Gate {
  id: string;
  title: string;
  checked: boolean;
  check?: string;
  expect?: string;
  cwd?: string;
  evidence?: string;
  /** 0-based line index of the `- [ ] ID:` line. */
  line: number;
  /** 0-based line index of each attribute, when present. */
  attrLines: { check?: number; expect?: number; cwd?: number; evidence?: number };
  /** Last line index that belongs to this gate (header or its last attribute). */
  endLine: number;
  /** Indentation used by this gate's attributes (default two spaces). */
  indent: string;
}

export interface Ledger {
  title: string;
  gates: Gate[];
  /** gate id -> abandonment reason */
  abandoned: Map<string, string>;
  errors: string[];
  warnings: string[];
  lines: string[];
  eol: "\n" | "\r\n";
}

export type GateState = "met" | "unmet" | "stale" | "abandoned";

export interface Evidence {
  def: string;
  exit: number;
  expect: "matched" | "unmatched";
  out: string;
  bytes: number;
  rest: string;
}

export interface LintFinding {
  level: "error" | "warning";
  code: string;
  gate?: string;
  message: string;
}

export interface Summary {
  total: number;
  met: number;
  unmet: number;
  stale: number;
  abandoned: number;
  runnable: number;
  manual: number;
}

const ID_RE = /[A-Za-z][A-Za-z0-9_.-]*/;
const GATE_RE = new RegExp(`^- \\[( |x|X)\\] (${ID_RE.source}):\\s*(.*?)\\s*$`);
const ATTR_RE = /^(\s+)(CHECK|EXPECT|CWD|EVIDENCE):(?:\s?(.*))?$/;
const BARE_ATTR_RE = /^(CHECK|EXPECT|CWD|EVIDENCE):/;
const ABANDON_RE = new RegExp(`^ABANDON:\\s*(${ID_RE.source})?\\s*(.*)$`);
const INDENTED_ABANDON_RE = /^\s+ABANDON:/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function isRunnable(gate: Pick<Gate, "check" | "expect">): boolean {
  return gate.check !== undefined && gate.expect !== undefined;
}

/** Parse a ledger. Never throws on content; structural problems land in `errors` and
 *  a ledger with errors must be treated as invalid (unmet), never as met. */
export function parseLedger(text: string): Ledger {
  const eol: "\n" | "\r\n" = /\r\n/.test(text) ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const ledger: Ledger = { title: "", gates: [], abandoned: new Map(), errors: [], warnings: [], lines, eol };
  const ids = new Set<string>();
  let current: Gate | null = null;
  let fence: { char: string; len: number } | null = null;
  let comment = false;
  const pendingAbandons: { id: string; reason: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;

    // HTML comments are authoring notes (the template ships one); nothing inside binds.
    if (comment) {
      if (line.includes("-->")) comment = false;
      continue;
    }
    if (/^\s*<!--/.test(line)) {
      current = null;
      if (!line.includes("-->")) comment = true;
      continue;
    }

    // CommonMark fenced code: contents are documentation, never gates.
    const f = FENCE_RE.exec(line);
    if (f) {
      const char = f[1][0];
      const len = f[1].length;
      if (!fence) {
        // An opener's info string may not contain a backtick for backtick fences.
        if (!(char === "`" && f[2].includes("`"))) {
          fence = { char, len };
          continue;
        }
      } else if (fence.char === char && len >= fence.len && f[2].trim() === "") {
        fence = null;
        continue;
      }
    }
    if (fence) continue;

    if (!ledger.title && /^#\s+/.test(line)) {
      ledger.title = line.replace(/^#\s+/, "").trim();
      continue;
    }

    const g = GATE_RE.exec(line);
    if (g) {
      const id = g[2];
      const title = g[3];
      if (!title) ledger.errors.push(`line ${n}: gate ${id} has no outcome text`);
      if (ids.has(id)) ledger.errors.push(`line ${n}: duplicate gate id ${id}`);
      ids.add(id);
      current = {
        id, title, checked: g[1] !== " ", line: i, attrLines: {}, endLine: i, indent: "  ",
      };
      ledger.gates.push(current);
      continue;
    }

    if (INDENTED_ABANDON_RE.test(line)) {
      ledger.errors.push(`line ${n}: ABANDON: must start at column 1 — it names its gate by id and is not a gate attribute`);
      continue;
    }
    const a = ABANDON_RE.exec(line);
    if (a) {
      const id = a[1];
      const reason = (a[2] ?? "").trim();
      if (!id) ledger.errors.push(`line ${n}: ABANDON: names no gate id`);
      else if (!reason) ledger.errors.push(`line ${n}: ABANDON: ${id} has no reason — a handoff without a reason is not a handoff`);
      else pendingAbandons.push({ id, reason, line: i });
      continue;
    }

    const at = ATTR_RE.exec(line);
    if (at) {
      const key = at[2].toLowerCase() as "check" | "expect" | "cwd" | "evidence";
      const value = (at[3] ?? "").trim();
      if (!current) {
        ledger.errors.push(`line ${n}: ${at[2]}: is not attached to a gate — attributes follow their \`- [ ] ID:\` line with no prose in between`);
        continue;
      }
      if (current.attrLines[key] !== undefined) {
        ledger.errors.push(`line ${n}: gate ${current.id} repeats ${at[2]}:`);
        continue;
      }
      current.attrLines[key] = i;
      current.endLine = i;
      current.indent = at[1];
      if (key === "evidence") current.evidence = value;
      else {
        if (!value) ledger.errors.push(`line ${n}: gate ${current.id} has an empty ${at[2]}:`);
        current[key] = value;
      }
      continue;
    }

    if (BARE_ATTR_RE.test(line)) {
      ledger.errors.push(`line ${n}: ${line.split(":")[0]}: must be indented beneath its gate — unindented it would silently turn the gate manual`);
      continue;
    }
    // Prose closes the current gate's attribute block, so a stray attribute further down is
    // diagnosed as orphaned rather than silently attached. Blank lines do not close it.
    if (line.trim() !== "" && current) current = null;
  }

  if (fence) ledger.warnings.push("an unclosed code fence swallowed the rest of the ledger");
  if (ledger.gates.length === 0) ledger.errors.push("the ledger defines no gates — an empty ledger is not ALL MET");

  for (const gate of ledger.gates) {
    const hasCheck = gate.check !== undefined;
    const hasExpect = gate.expect !== undefined;
    if (hasCheck !== hasExpect) {
      ledger.errors.push(`gate ${gate.id}: a runnable gate needs both CHECK: and EXPECT: (a manual gate has neither)`);
    }
    if (gate.cwd !== undefined && !hasCheck) {
      ledger.errors.push(`gate ${gate.id}: CWD: without CHECK:`);
    }
    if (gate.cwd !== undefined && (isAbsolutePath(gate.cwd) || hasTraversal(gate.cwd))) {
      ledger.errors.push(`gate ${gate.id}: CWD: must be repository-relative without '..' segments`);
    }
    if (hasExpect) {
      const compiled = compileExpect(gate.expect!);
      if (compiled instanceof Error) ledger.errors.push(`gate ${gate.id}: EXPECT: ${compiled.message}`);
      else if (typeof compiled !== "string" && /^\/(.*)\/[a-z]*$/s.test(gate.expect!)) {
        const inner = gate.expect!.replace(/^\/(.*)\/[a-z]*$/s, "$1");
        if (/(^|[^\\])\//.test(inner)) {
          ledger.warnings.push(`gate ${gate.id}: EXPECT: is read as a regular expression with an unescaped inner slash — escape it, or drop the wrapping slashes to match a literal substring`);
        }
      }
    }
  }

  for (const ab of pendingAbandons) {
    if (!ids.has(ab.id)) {
      ledger.errors.push(`line ${ab.line + 1}: ABANDON: names unknown gate ${ab.id} — a typo here could let an unmet gate pass unseen`);
      continue;
    }
    if (ledger.abandoned.has(ab.id)) ledger.errors.push(`line ${ab.line + 1}: gate ${ab.id} is abandoned twice`);
    ledger.abandoned.set(ab.id, ab.reason);
  }
  return ledger;
}

function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
}
function hasTraversal(p: string): boolean {
  return p.split(/[\\/]/).some((seg) => seg === "..");
}

/** `/pattern/flags` -> RegExp; anything else -> literal substring. An Error is a parse error. */
export function compileExpect(expect: string): RegExp | string | Error {
  const trimmed = expect.trim();
  if (!trimmed) return new Error("is empty");
  if (trimmed.length > MAX_EXPECT_LENGTH) return new Error(`is longer than ${MAX_EXPECT_LENGTH} characters`);
  const m = /^\/(.+)\/([a-z]*)$/s.exec(trimmed);
  if (!m) return trimmed;
  const flags = m[2];
  if (/[^gimsuy]/.test(flags) || /(.).*\1/.test(flags)) return new Error(`has invalid regular-expression flags '${flags}'`);
  try {
    return new RegExp(m[1], flags.replace("g", ""));
  } catch (e) {
    return new Error(`is not a valid regular expression: ${(e as Error).message}`);
  }
}

export function matchExpect(expect: string, output: string): boolean {
  const c = compileExpect(expect);
  if (c instanceof Error) return false;
  if (typeof c === "string") return output.includes(c);
  return c.test(output);
}

/** Environment-independent digest of the parsed definition: what the evidence proved. */
export function definitionDigest(gate: Pick<Gate, "check" | "expect" | "cwd">): string {
  return sha256(["v1", gate.check ?? "", gate.expect ?? "", gate.cwd ?? ""].join("\0")).slice(0, 16);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function outputDigest(combined: string): { out: string; bytes: number } {
  return { out: sha256(combined).slice(0, 16), bytes: Buffer.byteLength(combined, "utf8") };
}

/** Anything the checker writes — the bound success form or a `failed at=…` line — is machine
 *  evidence. On a manual gate it means a runnable definition was removed after a run, which
 *  is never a human attestation. */
export function isMachineEvidence(evidence: string | undefined): boolean {
  const t = (evidence ?? "").trim();
  return t.startsWith(EVIDENCE_TAG) || /^failed at=/.test(t);
}

export function parseEvidence(evidence: string | undefined): Evidence | null {
  if (!evidence || !evidence.startsWith(EVIDENCE_TAG + " ")) return null;
  const body = evidence.slice(EVIDENCE_TAG.length + 1);
  const m = /^def=([0-9a-f]{16}) exit=(-?\d+) expect=(matched|unmatched) out=([0-9a-f]{16}):(\d+)(?: (.*))?$/.exec(body);
  if (!m) return null;
  return { def: m[1], exit: Number(m[2]), expect: m[3] as Evidence["expect"], out: m[4], bytes: Number(m[5]), rest: m[6] ?? "" };
}

export function formatEvidence(
  gate: Pick<Gate, "check" | "expect" | "cwd">,
  result: { exit: number; matched: boolean; combined: string; cwd: string; shell: string; at?: Date },
): string {
  const od = outputDigest(result.combined);
  const at = (result.at ?? new Date()).toISOString();
  return `${EVIDENCE_TAG} def=${definitionDigest(gate)} exit=${result.exit} expect=${result.matched ? "matched" : "unmatched"} ` +
    `out=${od.out}:${od.bytes} cwd=${token(result.cwd)} shell=${token(result.shell)} at=${at}`;
}

function token(s: string): string {
  const t = s.replace(/\s+/g, "_");
  return t || "-";
}

/** Resolve one gate's state. Ledger-level parse errors are the caller's to refuse first. */
export function gateState(gate: Gate, ledger: Pick<Ledger, "abandoned">): GateState {
  if (ledger.abandoned.has(gate.id)) return "abandoned";
  if (!gate.checked) return "unmet";
  const ev = parseEvidence(gate.evidence);
  if (isRunnable(gate)) {
    if (!ev) return "stale";
    if (ev.def !== definitionDigest(gate)) return "stale";
    if (ev.exit !== 0 || ev.expect !== "matched") return "stale";
    return "met";
  }
  // Manual: human evidence is required; machine evidence on a manual gate is a definition
  // that was removed after the run, not an attestation.
  const text = (gate.evidence ?? "").trim();
  if (!text || /^pending\b/i.test(text) || isMachineEvidence(text)) return "stale";
  return "met";
}

export function summarize(ledger: Ledger): Summary {
  const s: Summary = { total: ledger.gates.length, met: 0, unmet: 0, stale: 0, abandoned: 0, runnable: 0, manual: 0 };
  for (const g of ledger.gates) {
    if (isRunnable(g)) s.runnable += 1; else s.manual += 1;
    s[gateState(g, ledger)] += 1;
  }
  return s;
}

/** Return the ledger text with one gate's box and evidence rewritten. Preserves the file's
 *  newline style; inserts a missing EVIDENCE: line beneath the gate's last attribute. */
export function applyResult(text: string, gateId: string, result: { checked: boolean; evidence: string }): string {
  const ledger = parseLedger(text);
  const gate = ledger.gates.find((g) => g.id === gateId);
  if (!gate) throw new Error(`gate ${gateId} not found`);
  const lines = ledger.lines.slice();
  lines[gate.line] = lines[gate.line].replace(/^- \[( |x|X)\]/, `- [${result.checked ? "x" : " "}]`);
  const evLine = `${gate.indent}EVIDENCE: ${result.evidence}`;
  if (gate.attrLines.evidence !== undefined) lines[gate.attrLines.evidence] = evLine;
  else lines.splice(gate.endLine + 1, 0, evLine);
  return lines.join(ledger.eol);
}

// --- lint: oracles that cannot fail --------------------------------------------------

const FIXED_OUTPUT_RE = /^\s*(echo|printf|true|:)(\s|$)/;
const INLINE_EVAL_RE = /^\s*(node|bun|deno)\s+(-e|--eval|eval)\b/;
const CARGO_TEST_RE = /\bcargo\s+(\+\S+\s+)?(nextest\s+run|test|t)\b/;
// A literal count (`1 passed`, `3 tests run`) or a digit class that excludes zero (`[1-9]`).
// `tests?\??` also accepts the regex spelling `tests? run` the docs teach for nextest.
const PINNED_COUNT_RE = /(?:[1-9]\d*|\[1-9\])\S*\s*(?:passed|tests?\??\s+run)/;
const WEAK_EXPECT = new Set([
  "ok", "done", "success", "successful", "pass", "passed", "finished", "complete", "completed",
  "true", "0", "yes", "test result", "test result:",
]);
const ACTIVITY_TITLE_RE = /^(run|execute|check|verify|test|add|implement|write|update|create|make|ensure|make sure|try)\b/i;
// A figure with a unit, or a threshold ("under 20", "at least 3"); not an identifier such as
// ADR-0007, #12 or RFC 2119 — those carry a number without claiming a measurement.
const NUMBER_RE = /(?<![A-Za-z0-9#-])\d+(?:\.\d+)?\s*(?:ms|s|%|kb|mb|gb|kib|mib|gib|x|×|req\/s|rps|ops|qps|seconds?|minutes?|bytes?|allocations?)\b|\b(?:under|below|over|above|at most|at least|fewer than|more than|less than|within|≤|<=|>=|≥|<|>)\s*\d+(?:\.\d+)?\b/i;

export function lintLedger(ledger: Ledger): LintFinding[] {
  const out: LintFinding[] = [];
  for (const e of ledger.errors) out.push({ level: "error", code: "parse", message: e });
  for (const w of ledger.warnings) out.push({ level: "warning", code: "parse", message: w });
  let manual = 0;
  for (const g of ledger.gates) {
    const runnable = isRunnable(g);
    if (!runnable) manual += 1;
    if (ACTIVITY_TITLE_RE.test(g.title)) {
      out.push({ level: "warning", code: "activity-title", gate: g.id, message: `title names an activity ("${g.title.split(/\s+/)[0]}…"); name the observable outcome the check proves` });
    }
    if (!runnable) {
      if (NUMBER_RE.test(g.title)) {
        out.push({ level: "warning", code: "unmeasured-number", gate: g.id, message: "a manual gate carries a number nothing measures — make a CHECK compute it, or the figure is copied, not proved" });
      }
      continue;
    }
    const check = g.check!;
    const expect = g.expect!;
    if (FIXED_OUTPUT_RE.test(check) || INLINE_EVAL_RE.test(check)) {
      out.push({ level: "error", code: "fixed-output", gate: g.id, message: "CHECK prints a fixed result; it cannot fail, so it proves nothing" });
    }
    const c = compileExpect(expect);
    if (c instanceof RegExp && c.test("")) {
      out.push({ level: "error", code: "trivial-expect", gate: g.id, message: "EXPECT matches empty output; the marker must be one the command prints only on success" });
    }
    if (typeof c === "string" && WEAK_EXPECT.has(c.toLowerCase())) {
      out.push({ level: "warning", code: "weak-expect", gate: g.id, message: `EXPECT "${c}" is vocabulary failure output uses too; pin a success-only marker` });
    }
    if (typeof c === "string" && c.length >= 4 && check.includes(c)) {
      out.push({ level: "warning", code: "expect-in-check", gate: g.id, message: "the command's own text contains the EXPECT marker — a command that prints its expectation cannot fail on it" });
    }
    if (CARGO_TEST_RE.test(check) && !PINNED_COUNT_RE.test(expect)) {
      out.push({ level: "warning", code: "cargo-zero-tests", gate: g.id, message: "a cargo test/nextest filter that matches no test exits 0 with \"0 passed\"; pin a nonzero count in EXPECT (e.g. `1 test run: 1 passed`, `/[1-9][0-9]* passed/`)" });
    }
  }
  if (ledger.gates.length >= 3 && manual > ledger.gates.length - manual) {
    out.push({ level: "warning", code: "mostly-manual", message: `${manual} of ${ledger.gates.length} gates are manual; try to make the riskiest outcomes runnable` });
  }
  return out;
}

/** Strip terminal control, line-separator and bidi-override characters from text that came
 *  out of a command, before it reaches a terminal or a host message. */
export function safeText(value: string, max = 200): string {
  return value
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, "")
    .slice(0, max);
}

/** Qualified id for reports: `<file stem>:<gate id>`. */
export function qualify(file: string, id: string): string {
  const stem = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.md$/i, "");
  const dir = file.replace(/\\/g, "/").split("/").slice(-2, -1)[0];
  return `${dir && stem === "acceptance" ? dir : stem}:${id}`;
}
