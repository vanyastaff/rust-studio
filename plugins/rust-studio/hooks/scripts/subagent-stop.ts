#!/usr/bin/env bun
// Rust Code Studio — sub-agent verdict presence check (SubagentStop).
//
// Fires when a studio sub-agent finishes. Studio convention: every agent ends in
// an explicit verdict — COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED (or the
// pre-code ACCEPTABLE / RESHAPE NEEDED, or a MERGE-READY) — backed by evidence.
// This hook inspects the sub-agent's FINAL message: if a verdict token is present
// it stays silent; if the agent clearly closed without one it injects an escalated
// reminder to treat the result as unverified and demand a verdict before advancing.
//
// Detection — why we parse the transcript instead of grepping a byte window:
//   * A studio agent (chief-architect especially) often writes a large final
//     message — an ADR or design doc — and puts the verdict at the TOP
//     ("## Verdict\n\n**ARCH-GATE: COMPLETE**") or as the very first token. The old
//     detector only scanned the last ~60k chars of the file, so a verdict sitting
//     earlier in a long final message fell outside that window and was missed — the
//     hook then nagged "NO explicit studio verdict detected" on every turn even
//     though an explicit verdict was right there.
//   * The verdict may be wrapped in markdown (`**COMPLETE**`), prefixed by a label
//     (`VERDICT:` / `ARCH-GATE:` / a role gate), or live inside a heading. The token
//     regex below already tolerates all of that: it is word-boundary anchored and
//     the surrounding `*`, `:`, `#` and whitespace are non-word characters.
//   So we parse the JSONL transcript, take the sub-agent's last assistant message(s)
//   in full (length-independent), and test the verdict regex against that text. If
//   the transcript can't be parsed as JSONL we fall back to the old bounded tail
//   scan, so an unrecognised format never silently regresses to "no verdict".
//
// It deliberately does NOT hard-block (no top-level `decision:block`): a false
// block would wedge a legitimate non-studio / built-in sub-agent (Explore, Plan,
// general-purpose) that never speaks in studio verdicts. additionalContext is the
// safe escalation. Never fails the session — on any error it exits 0 silently.

import { readFileSync } from "node:fs";
import { readInput, emit, done, watchdog } from "./_lib.ts";

/** The studio verdict vocabulary. Word-boundary anchored so it still matches when
 *  the token is wrapped in markdown bold (`**COMPLETE**`), prefixed by a label
 *  (`VERDICT:`, `ARCH-GATE:`), or sitting inside a heading — the surrounding `*`,
 *  `:`, `#` and whitespace are all non-word characters. The internal space in the
 *  two-word verdicts is relaxed to `\s+`, so a line-wrapped `NEEDS\nWORK` counts. */
export const VERDICT =
  /\b(COMPLETE|NEEDS\s+WORK|REDO-TO-BAR|BLOCKED|ACCEPTABLE|RESHAPE\s+NEEDED|MERGE-READY)\b/;

/** Does this text carry an explicit studio verdict token? */
export function hasVerdict(text: string): boolean {
  return VERDICT.test(text);
}

/** Pull the assistant text out of one parsed transcript entry, or null if the entry
 *  isn't an assistant message carrying text. Tolerates both the Claude Code wrapper
 *  shape (`{ type: "assistant", message: { role, content: [...] } }`) and a raw
 *  message shape (`{ role: "assistant", content: [...] | "..." }`). */
function entryAssistantText(o: any): string | null {
  const msg = o?.message ?? o;
  const role = msg?.role ?? o?.type;
  if (role !== "assistant") return null;
  const content = msg?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((b) => (b && typeof b.text === "string" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
    return text || null;
  }
  return null;
}

/** Every non-empty assistant message text in a JSONL transcript, in order. Lines
 *  that aren't valid JSON are skipped (the caller treats an empty result as
 *  "couldn't parse" and falls back to a raw scan). */
export function assistantTexts(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let o: unknown;
    try {
      o = JSON.parse(s);
    } catch {
      continue; // not a JSONL line we understand — skip
    }
    const t = entryAssistantText(o);
    if (t && t.trim()) out.push(t);
  }
  return out;
}

/** How many trailing chars to scan when we cannot parse the transcript as JSONL. */
const TAIL_BYTES = 60_000;
/** How many of the sub-agent's most recent assistant messages to inspect. The
 *  verdict is, by convention, the closing statement; a small window keeps a
 *  verdict-shaped word buried far earlier in the conversation from counting. */
const RECENT_MESSAGES = 3;

/** True if the sub-agent closed with an explicit verdict. Prefers the actual final
 *  assistant message(s) — length-independent, so a verdict at the top of a long ADR
 *  is found. Falls back to a bounded tail scan only when no assistant message could
 *  be parsed, so an unrecognised transcript shape never regresses to silence. */
export function verdictPresent(raw: string): boolean {
  const texts = assistantTexts(raw);
  if (texts.length > 0) {
    // Join with a newline so a token can never be forged across a message boundary.
    return hasVerdict(texts.slice(-RECENT_MESSAGES).join("\n"));
  }
  const tail = raw.length > TAIL_BYTES ? raw.slice(-TAIL_BYTES) : raw;
  return hasVerdict(tail);
}

interface Input {
  agent_type?: string;
  transcript_path?: string;
}

if (import.meta.main) {
  const disarm = watchdog();
  const data = await readInput<Input>();
  disarm();

  const who = data.agent_type ? `\`${data.agent_type}\`` : "the sub-agent";

  // Read the transcript and look for an explicit verdict in the sub-agent's final
  // message. If we find one we assume the agent closed properly and stay quiet. If
  // we can read the transcript and there is clearly NO verdict, escalate. If we
  // cannot read it at all, fall back to the plain reminder.
  let verdictSeen = false;
  let couldRead = false;
  try {
    if (data.transcript_path) {
      const raw = readFileSync(data.transcript_path, "utf8");
      couldRead = true;
      verdictSeen = verdictPresent(raw);
    }
  } catch {
    /* couldRead stays false -> plain reminder */
  }

  if (verdictSeen) done(); // proper verdict present — nothing to nag about

  const lead = couldRead
    ? `⚠️ Sub-agent finished (${who}) with NO explicit studio verdict detected in its output. `
    : `Sub-agent finished (${who}). `;

  emit({
    hookSpecificOutput: {
      hookEventName: "SubagentStop",
      additionalContext:
        lead +
        "Treat the result as UNVERIFIED until it carries an explicit verdict — " +
        "**COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED** (or a pre-code " +
        "**ACCEPTABLE / RESHAPE NEEDED**) — with evidence (commands run, files " +
        "touched). A `REDO-TO-BAR` means the work compiles but the shape must be " +
        "reshaped to the maintainer bar before it is accepted; a `BLOCKED` verdict " +
        "halts its dependents until the blocker clears. If no verdict was given, ask " +
        "for one rather than advancing on an unverified result.",
    },
  });
}
