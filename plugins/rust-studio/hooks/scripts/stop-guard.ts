#!/usr/bin/env bun
// Rust Code Studio — Stop-guard hook (the mechanical teeth for the integrity doctrine).
//
// Blocks the turn from ENDING when the final assistant message shows a discipline
// failure the studio forbids (docs/integrity-and-evidence.md): ownership-dodging,
// permission-seeking, premature stopping, test avoidance, incomplete-work / stub
// signals, handing the work back to the user, or a weak/speculative "done" with no
// evidence. Exit 2 + stderr = block the stop; the stderr text becomes feedback to
// Claude. Exit 0 = allow.
//
// OPT-IN: inert unless `stop_guard` userConfig is on — blocking stops is aggressive,
// so the studio ships it off by default. `stop_guard_strict` also blocks soft signals
// even when some evidence is present.
//
// HARD RULE (shared by every studio hook): never freeze the session. stdin is read
// behind a timeout and a watchdog force-exits 0 (ALLOW) if anything stalls — failing
// OPEN, because trapping the user in a hung turn is worse than a missed block.

import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { readInput, watchdog, option, optionBool } from "./_lib.ts";

type Severity = "hard" | "soft";

interface Hit {
  category: string;
  severity: Severity;
  phrase: string;
  matchedText: string;
  excerpt: string;
}

interface Rule {
  category: string;
  severity: Severity;
  phrase: string;
  regex: RegExp;
}

interface GuardConfig {
  enabled: boolean;
  strict: boolean;
  requireEvidence: boolean;
  minEvidence: number;
  maxHits: number;
  allowedCategories: ReadonlySet<string>;
}

const HARD_CATEGORIES = new Set([
  "ownership-dodging",
  "permission-seeking",
  "premature-stopping",
  "test-avoidance",
  "soft-failure",
  "handoff-to-user",
]);

const SOFT_CATEGORIES = new Set([
  "speculation",
  "weak-completion",
  "evidence-free-claim",
  "risk-dismissal",
  "doc-only-dodge",
  "fallback-without-root-cause",
  "fake-certainty",
  // Demoted from HARD: honestly reporting genuinely out-of-scope work or remaining work
  // WITH evidence should not unconditionally block — these now block only when evidence
  // is missing (or in strict mode). Avoids false positives on disciplined "NEEDS WORK"
  // reports and on negated forms ("no placeholders left", "nothing out of scope").
  "incomplete-work",
  "scope-escape",
]);

const CATEGORY_ADVICE: Record<string, string> = {
  "ownership-dodging":
    "Own the outcome. Fix it, prove with concrete evidence that it is unrelated, or continue investigating.",
  "permission-seeking":
    "Do not ask permission to continue. Take the next concrete step yourself.",
  "premature-stopping":
    "Do not pause early. Continue until the task is genuinely complete or externally blocked.",
  "test-avoidance":
    "Do not stop without verification. Run cargo test/clippy/nextest or state the exact hard constraint preventing it.",
  "incomplete-work":
    "No TODOs, placeholders, stubs, or unwired code unless the user explicitly asked for a scaffold.",
  "soft-failure":
    "Do not stop on a vague failure. Continue debugging or name a concrete external blocker.",
  "handoff-to-user":
    "Do not hand the work back. Perform the next step yourself when you can.",
  "scope-escape":
    "Do not escape scope casually. Solve the related issue or prove it is genuinely out of scope.",
  speculation:
    "Do not stop on guesses. Verify the cause with code, tests, logs, or a reproduction.",
  "weak-completion":
    "Do not claim weak completion. Show concrete completion evidence.",
  "evidence-free-claim":
    "Do not claim fixed/done without files, commands, checks, and results.",
  "risk-dismissal":
    "Do not dismiss a risk without proof. Investigate or document concrete evidence.",
  "doc-only-dodge":
    "Documentation alone is not a fix unless the user explicitly asked for docs only.",
  "fallback-without-root-cause":
    "Do not hide a bug behind a fallback without understanding the root cause.",
  "fake-certainty":
    "Avoid fake certainty. Provide evidence or keep working.",
};

const PHRASES: Record<string, string[]> = {
  "ownership-dodging": [
    "not caused by my changes", "not caused by our changes", "not introduced by my changes",
    "not introduced by our changes", "existing issue", "pre-existing", "already broken",
    "was already like that", "not a code issue", "not our code", "not related to what i did",
    "not related to my changes", "not related to our changes", "not something i introduced",
    "outside my changes", "unrelated to this change", "unrelated to my change",
    "unrelated to our change", "not blocking you", "not my change", "not my issue",
  ],
  "permission-seeking": [
    "should i continue", "should i start", "want me to keep going", "want me to continue",
    "shall i proceed", "would you like me to", "do you want me to", "let me know if",
    "let me know whether", "awaiting your", "waiting for your", "tell me if you want",
    "i can continue if", "if you'd like", "if you want me to", "say the word",
  ],
  "premature-stopping": [
    "good stopping point", "natural checkpoint", "good place to pause", "let's pause here",
    "we can continue later", "continue in a new session", "continue this later",
    "this is getting long", "pick this up", "pick this back up", "next session",
    "later if needed", "we can revisit", "we can come back",
  ],
  "test-avoidance": [
    "i didn't run tests", "i did not run tests", "i have not run tests", "i haven't run tests",
    "i couldn't run tests", "i could not run tests", "tests were not run", "not tested",
    "untested", "please test", "you should test", "needs testing", "manual testing needed",
    "verify on your side", "please verify", "i recommend testing", "i can't verify",
    "i cannot verify", "unable to verify", "without running it", "assuming it works",
    "should compile", "should pass", "should work now", "should be fixed",
    "this should resolve", "hopefully this fixes", "i believe this fixes",
  ],
  "incomplete-work": [
    "partially implemented", "partial implementation", "not fully implemented", "not complete",
    "incomplete", "remaining work", "follow-up needed", "needs follow-up", "needs more work",
    "left as an exercise", "stubbed", "stub implementation", "placeholder",
    "placeholder implementation", "scaffolded", "skeleton implementation", "not wired up",
    "not integrated", "not hooked up", "not yet implemented", "not implemented yet",
    "still needs", "needs to be added", "needs cleanup", "needs refactor", "needs polish",
  ],
  "soft-failure": [
    "ran into issues", "hit an issue", "hit a problem", "had trouble", "couldn't complete",
    "could not complete", "wasn't able to complete", "unable to complete", "i wasn't able to",
    "i couldn't finish", "i could not finish", "i stopped because", "i'm blocked",
    "i am blocked", "this is blocked", "cannot proceed", "can't proceed", "needs your input",
    "requires your input", "requires clarification", "need more context", "i need more information",
  ],
  "handoff-to-user": [
    "you can now", "you should now", "next you should", "your next step", "you'll need to",
    "you will need to", "please run", "please update", "please change", "please add",
    "please check", "try running", "try changing", "try adding", "try updating",
    "you may need to", "you might need to", "at this point you can", "then you can",
    "run this locally", "test this locally", "check locally",
  ],
  "scope-escape": [
    "outside the scope", "out of scope", "beyond scope", "beyond the scope", "not in scope",
    "not part of this task", "separate concern", "separate issue", "separate problem",
    "different issue", "different problem", "another issue", "another problem",
    "separate refactor", "larger refactor", "bigger refactor", "would require refactoring",
    "would require a larger change", "too invasive", "too risky to change", "not worth changing",
  ],
  speculation: [
    "most likely", "likely the cause", "likely the issue", "likely the problem",
    "likely related to", "likely due to", "possible cause", "possible issue",
    "probably the cause", "probably the issue", "probably related", "might be causing",
    "could be the reason", "could be caused by", "seems to be", "appears to be",
    "i suspect", "my guess", "i assume", "assuming that",
  ],
  "weak-completion": [
    "i've made progress", "made progress", "mostly done", "mostly complete", "largely complete",
    "basically done", "essentially done", "nearly done", "almost done", "close to done",
    "good enough", "works for now", "acceptable for now", "this should be enough",
    "minimum viable", "minimal implementation", "basic implementation",
  ],
  "evidence-free-claim": [
    "looks good", "looks correct", "looks fine", "seems good", "seems correct", "seems fine",
    "appears correct", "appears fixed", "appears to work", "i think it's fixed",
    "i think this works", "i believe this works", "i believe it's fixed", "this fixes it",
    "this resolves it", "problem solved", "issue resolved", "all set",
  ],
  "risk-dismissal": [
    // "edge case" intentionally omitted: testing/async rules instruct the agent to call
    // out "the empty edge case" etc., so flagging the bare term produced false positives.
    "safe enough", "low risk", "minor issue", "rare case", "unlikely to happen",
    "not a big deal", "probably fine", "should be fine", "acceptable risk", "can ignore",
    "ignore this", "harmless", "benign", "cosmetic only", "minor cleanup",
  ],
  "doc-only-dodge": [
    "documented the issue", "added a comment", "added documentation", "noted in the docs",
    "mentioned in the readme", "left a comment", "documented as limitation", "documented limitation",
  ],
  "fallback-without-root-cause": [
    // "best effort"/"best-effort" intentionally omitted: core.md/async.md use the phrase
    // approvingly ("Drop is best-effort"), so flagging it produced false positives.
    "graceful fallback", "silent fallback", "degrade gracefully",
    "swallow the error", "ignore the error", "catch and ignore", "return default",
    "use a default", "fallback to", "fall back to",
  ],
  "fake-certainty": [
    "definitely", "clearly", "obviously", "all we need", "all that's needed",
    "no further changes", "no other changes needed", "no further action", "complete solution",
  ],
};

const COMPLETION_EVIDENCE_GROUPS: Record<string, RegExp[]> = {
  files: [
    /\bfiles changed\s*:/i, /\bchanged files\s*:/i, /\bmodified files\s*:/i,
    /\bfiles modified\s*:/i, /\bcreated files\s*:/i, /\bupdated files\s*:/i,
  ],
  commands: [
    /\bcommands? run\s*:/i, /\bchecks run\s*:/i, /\btests run\s*:/i,
    /\bbun test\b/i, /\bnpm test\b/i, /\bcargo (test|check|clippy|nextest|fmt)\b/i, /\bpytest\b/i,
  ],
  verification: [
    /\bverification\s*:/i, /\bverified\s*:/i, /\bvalidated\s*:/i,
    /\bchecks? passed\s*:/i, /\btests? passed\s*:/i, /\d+\s+pass(ed)?\b/i,
  ],
  result: [
    /\bresult\s*:/i, /\bstatus\s*:/i, /\boutcome\s*:/i, /\bsummary\s*:/i,
    /\bCOMPLETE\b/, /\bNEEDS WORK\b/, /\bBLOCKED\b/,
  ],
};

function safeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  return v === "1" || v === "true";
}

/** Resolve guard config from plugin userConfig (primary) + STOP_GUARD_* env (power knobs). */
export function loadConfig(): GuardConfig {
  const enabled = optionBool("stop_guard", false) && !envFlag("STOP_GUARD_DISABLED");
  return {
    enabled,
    strict: optionBool("stop_guard_strict", false) || envFlag("STOP_GUARD_STRICT"),
    requireEvidence:
      optionBool("stop_guard_require_evidence", false) || envFlag("STOP_GUARD_REQUIRE_EVIDENCE"),
    minEvidence: safeInt(process.env.STOP_GUARD_MIN_EVIDENCE, 2),
    maxHits: safeInt(process.env.STOP_GUARD_MAX_HITS, 8),
    allowedCategories: new Set(
      (option("stop_guard_allow_categories") ?? process.env.STOP_GUARD_ALLOW_CATEGORIES ?? "")
        .split(",").map((x) => x.trim()).filter(Boolean),
    ),
  };
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary-anchored matcher so "likely" never matches "unlikely" and "fix" never "prefix". */
export function phraseToRegex(phrase: string): RegExp {
  const body = normalizeText(phrase).split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`(^|[^a-z0-9_])(${body})(?=$|[^a-z0-9_])`, "i");
}

function categorySeverity(category: string): Severity {
  if (HARD_CATEGORIES.has(category)) return "hard";
  if (SOFT_CATEGORIES.has(category)) return "soft";
  return "hard"; // unknown → fail closed
}

export function buildRules(allowedCategories: ReadonlySet<string> = new Set()): Rule[] {
  const rules: Rule[] = [];
  for (const [category, phrases] of Object.entries(PHRASES)) {
    if (allowedCategories.has(category)) continue;
    const severity = categorySeverity(category);
    for (const phrase of phrases) {
      rules.push({ category, severity, phrase, regex: phraseToRegex(phrase) });
    }
  }
  // Longer phrases first so a generic word can't mask a more specific phrase.
  rules.sort((a, b) => b.phrase.length - a.phrase.length);
  return rules;
}

function getExcerpt(text: string, index: number, length: number): string {
  const radius = 100;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export function scan(text: string, rules: Rule[], maxHits = 8): Hit[] {
  const normalized = normalizeText(text);
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    const match = normalized.match(rule.regex);
    if (!match) continue;
    const key = `${rule.category}:${rule.phrase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      category: rule.category,
      severity: rule.severity,
      phrase: rule.phrase,
      matchedText: match[2] ?? rule.phrase,
      excerpt: getExcerpt(normalized, match.index ?? 0, (match[2] ?? rule.phrase).length),
    });
    if (hits.length >= maxHits) break;
  }
  return hits;
}

export function getEvidenceGroups(text: string): string[] {
  const groups: string[] = [];
  for (const [group, patterns] of Object.entries(COMPLETION_EVIDENCE_GROUPS)) {
    if (patterns.some((p) => p.test(text))) groups.push(group);
  }
  return groups;
}

type BlockReason = "hard-hit" | "soft-hit-without-evidence" | "missing-evidence";

export interface Decision {
  block: boolean;
  reason?: BlockReason;
  hardHits: Hit[];
  softHits: Hit[];
  evidenceGroups: string[];
}

export function shouldBlock(
  text: string,
  hits: Hit[],
  cfg: Pick<GuardConfig, "strict" | "requireEvidence" | "minEvidence">,
): Decision {
  const evidenceGroups = getEvidenceGroups(text);
  const enoughEvidence = evidenceGroups.length >= cfg.minEvidence;
  const hardHits = hits.filter((h) => h.severity === "hard");
  const softHits = hits.filter((h) => h.severity === "soft");

  if (hardHits.length > 0) {
    return { block: true, reason: "hard-hit", hardHits, softHits, evidenceGroups };
  }
  if (softHits.length > 0 && (cfg.strict || !enoughEvidence)) {
    return { block: true, reason: "soft-hit-without-evidence", hardHits, softHits, evidenceGroups };
  }
  if (cfg.requireEvidence && !enoughEvidence) {
    return { block: true, reason: "missing-evidence", hardHits, softHits, evidenceGroups };
  }
  return { block: false, hardHits, softHits, evidenceGroups };
}

function uniqueCategories(hits: Hit[]): string[] {
  return [...new Set(hits.map((h) => h.category))];
}

export function buildFeedback(d: Decision, minEvidence: number): string {
  const allHits = [...d.hardHits, ...d.softHits];
  const lines: string[] = [];

  lines.push(
    d.reason === "hard-hit"
      ? "STOP BLOCKED (Rust Code Studio): a hard discipline-failure phrase is in your final message."
      : d.reason === "soft-hit-without-evidence"
        ? "STOP BLOCKED (Rust Code Studio): weak/speculative completion without enough evidence."
        : "STOP BLOCKED (Rust Code Studio): final message lacks concrete completion evidence.",
    "",
  );

  if (allHits.length) {
    lines.push("Detected:");
    for (const h of allHits) {
      lines.push(`- [${h.severity.toUpperCase()}:${h.category}] '${h.phrase}'`, `  Context: ${h.excerpt}`);
    }
    lines.push("");
  }

  lines.push(
    `Evidence groups found: ${d.evidenceGroups.length ? d.evidenceGroups.join(", ") : "none"} (need ≥ ${minEvidence})`,
    "",
  );

  const cats = uniqueCategories(allHits);
  if (cats.length) {
    lines.push("Guidance:");
    for (const c of cats) lines.push(`- ${c}: ${CATEGORY_ADVICE[c] ?? "Continue and show concrete evidence."}`);
    lines.push("");
  }

  lines.push(
    "Before stopping: continue the task yourself, do not hand your next step to the user, and do not",
    "claim done/fixed without evidence. Include:",
    "  Files changed: path — what changed",
    "  Commands run: the exact command",
    "  Verification: what passed/failed and why",
    "  Result: COMPLETE / NEEDS WORK / BLOCKED",
    "If genuinely blocked, name the exact external blocker and what you already tried.",
  );
  return lines.join("\n");
}

// --- assistant-text extraction (direct field → messages[] → transcript tail) ---

function contentToText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content.text === "string") return content.text;
  if (typeof content.content === "string") return content.content;
  return "";
}

function extractFromMessages(messages: any): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const role = m?.role ?? m?.message?.role ?? m?.author?.role ?? m?.type;
    if (role !== "assistant") continue;
    const text = contentToText(m?.content) || contentToText(m?.message?.content);
    if (text.trim()) return text;
  }
  return "";
}

/** Last assistant text from a JSONL transcript tail (bounded: scans the last lines). */
export function lastAssistantFromTranscript(raw: string): string {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry: any;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const role = entry?.role ?? entry?.message?.role ?? entry?.author?.role ?? entry?.type;
    if (role !== "assistant") continue;
    const text = contentToText(entry?.content) || contentToText(entry?.message?.content);
    if (text.trim()) return text;
  }
  return "";
}

const TAIL_BYTES = 200_000;

async function getLastAssistantText(input: any): Promise<string> {
  if (!input || typeof input !== "object") return "";
  const direct =
    contentToText(input.last_assistant_message) ||
    contentToText(input.assistant_message) ||
    contentToText(input.message);
  if (direct.trim()) return direct;

  const fromMessages = extractFromMessages(input.messages);
  if (fromMessages.trim()) return fromMessages;

  const path = input.transcript_path;
  if (typeof path === "string" && path) {
    try {
      const file = Bun.file(path);
      if (await file.exists()) {
        const full = await file.text();
        const raw = full.length > TAIL_BYTES ? full.slice(-TAIL_BYTES) : full;
        return lastAssistantFromTranscript(raw);
      }
    } catch {
      /* fall through to "" — allow */
    }
  }
  return "";
}

/** Remove fenced code, inline code, markdown blockquotes, and quoted spans so that
 *  *discussing* a flagged phrase — in `code`, a "quote", a > blockquote, or
 *  meta-commentary about this guard's own category list — is not mistaken for
 *  committing it. Mirrors the session-level stop-phrase guard's prose preprocessing. */
export function toProse(text: string): string {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code spans
    .replace(/^\s*>.*$/gm, " ") // markdown blockquotes
    .replace(/"[^"\n]*"/g, " ") // straight double-quoted spans
    .replace(/[“”][^“”\n]*[“”]/g, " ") // curly double quotes
    .replace(/«[^»\n]*»/g, " ") // guillemets
    .replace(/„[^“”\n]*[“”]/g, " "); // low „ … “/” quotes
}

/** Pure decision over a final message — the unit tests' entry point. */
export function evaluate(text: string, cfg: GuardConfig): Decision {
  const rules = buildRules(cfg.allowedCategories);
  // Phrase-match on prose only (strip code/quotes/blockquotes); keep evidence
  // detection on the FULL text so a summary inside a code fence still counts.
  const hits = scan(toProse(text), rules, cfg.maxHits);
  return shouldBlock(text, hits, cfg);
}

// Loop-cap: never trap the turn. After this many consecutive blocks in a session
// the guard gives up and allows the stop (mirrors the session-level guard's cap).
const MAX_BLOCKS = 4;

function blockCounterFile(sessionId: string): string {
  return join(tmpdir(), `rust-studio-stopguard-${sessionId.replace(/[^A-Za-z0-9]/g, "_")}.json`);
}
function bumpBlocks(sessionId: string): number {
  const f = blockCounterFile(sessionId);
  let n = 0;
  try {
    n = JSON.parse(readFileSync(f, "utf8"))?.count ?? 0;
  } catch {
    n = 0;
  }
  n += 1;
  try {
    writeFileSync(f, JSON.stringify({ count: n }));
  } catch {
    /* non-fatal */
  }
  return n;
}
function resetBlocks(sessionId: string): void {
  try {
    writeFileSync(blockCounterFile(sessionId), JSON.stringify({ count: 0 }));
  } catch {
    /* non-fatal */
  }
}

if (import.meta.main) {
  // Watchdog fails OPEN (exit 0 = allow) so the guard can never hang the turn.
  const disarm = watchdog(10_000);
  const cfg = loadConfig();
  if (!cfg.enabled) {
    disarm();
    process.exit(0);
  }

  const input = await readInput<any>(3_000);
  const lastText = await getLastAssistantText(input);
  disarm();

  if (!lastText.trim()) process.exit(0); // nothing to judge — allow

  const sessionId = String(input?.session_id ?? "unknown");
  const decision = evaluate(lastText, cfg);
  if (decision.block && decision.reason) {
    const n = bumpBlocks(sessionId);
    if (n > MAX_BLOCKS) {
      // Give up — never trap the turn in an endless stop loop.
      resetBlocks(sessionId);
      process.stderr.write(
        `Rust Code Studio stop-guard: ${MAX_BLOCKS} consecutive blocks this session — allowing the stop so the turn is never trapped.`,
      );
      process.exit(0);
    }
    process.stderr.write(`${buildFeedback(decision, cfg.minEvidence)}\n\n(stop-guard block ${n}/${MAX_BLOCKS})`);
    process.exit(2); // block the stop; stderr becomes feedback to Claude
  }
  resetBlocks(sessionId); // a clean stop resets the streak
  process.exit(0);
}
