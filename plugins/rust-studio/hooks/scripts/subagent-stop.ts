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
//
// Gating (why we don't nag every sub-agent):
//   The verdict convention is a STUDIO convention. Built-in / non-studio agents
//   (Explore, Plan, general-purpose, claude-code-guide, …) return DATA — a research
//   digest, a code map, an answer — not a verdict. Nagging them backfires: observed
//   behavior is that the reminder reaches the sub-agent, which appends a fresh
//   verdict-only closing message; THAT becomes the message returned to the parent,
//   while the actual deliverable is now an earlier message that only survives in the
//   output file — the parent gets "VERDICT: COMPLETE" instead of the content it asked
//   for. (The hook docs don't pin down whether additionalContext lands in the
//   sub-agent or the parent; this fix is correct either way — if it reaches the parent
//   it just stops a spurious "UNVERIFIED" nag about an agent that correctly returned
//   data.) So we classify the agent — `agent_type` is its frontmatter `name`, matched
//   against the `agents/*.md` roster, plus a built-in denylist — and stay silent for
//   anything that doesn't owe a studio verdict. And when we DO nag, the wording tells
//   the agent to APPEND the verdict to its existing deliverable, never replace it.

import { readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { readInput, emit, done, watchdog } from "./_lib.ts";

/** The studio verdict vocabulary. Word-boundary anchored so it still matches when
 *  the token is wrapped in markdown bold (`**COMPLETE**`), prefixed by a label
 *  (`VERDICT:`, `ARCH-GATE:`), or sitting inside a heading — the surrounding `*`,
 *  `:`, `#` and whitespace are all non-word characters. The internal space in the
 *  two-word verdicts is relaxed to `\s+`, so a line-wrapped `NEEDS\nWORK` counts. */
export const VERDICT =
  /\b(COMPLETE|NEEDS\s+WORK|REDO-TO-BAR|BLOCKED|ACCEPTABLE|RESHAPE\s+NEEDED|MERGE-READY|SURVIVES|DOESN(?:'|’)T\s+SURVIVE|INSUFFICIENT\s+INFO)\b/;

/** Does this text carry an explicit studio verdict token? */
export function hasVerdict(text: string): boolean {
  return VERDICT.test(text);
}

/** Built-in / non-studio agent types that return DATA, never a studio verdict.
 *  These must never be nagged (nagging them displaces their deliverable — see header).
 *  Compared against the normalized (lowercased, prefix-stripped) agent_type. */
export const BUILTIN_DENY: ReadonlySet<string> = new Set([
  "explore",
  "plan",
  "general-purpose",
  "claude-code-guide",
  "statusline-setup",
  "output-style-setup",
]);

/** Normalize an agent_type for roster comparison: lowercase, strip a leading
 *  `rust-studio:` / `rust-studio/` / `rust-studio-` (or `rust_studio…`) namespace,
 *  and trim. `"rust-studio:rust-reviewer"` → `"rust-reviewer"`; `"Explore"` →
 *  `"explore"`. */
export function normalizeAgentType(t?: string): string {
  return (t ?? "")
    .toLowerCase()
    .replace(/^rust[-_ ]?studio[:/ -]/, "")
    .trim();
}

/** The studio agent roster: the frontmatter `name:` of each `agents/*.md`, lowercased.
 *  `agent_type` is the agent's frontmatter `name` (per the SubagentStop hook contract),
 *  not its filename — so we match on `name`, falling back to the filename only when a
 *  file has no parseable `name:`. Read at runtime so adding/removing an agent file
 *  auto-maintains the list. Returns null if the directory can't be read (caller then
 *  falls back to the built-in denylist). */
export function studioRoster(dir: string): Set<string> | null {
  try {
    const names = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        try {
          const head = readFileSync(join(dir, f), "utf8").slice(0, 2000);
          const m = head.match(/^name:\s*["']?([^"'\n]+?)["']?\s*$/m);
          if (m) return m[1].trim().toLowerCase();
        } catch {
          /* fall through to filename */
        }
        return f.replace(/\.md$/, "").toLowerCase();
      });
    return names.length ? new Set(names) : null;
  } catch {
    return null;
  }
}

/** Does this agent owe a studio verdict (i.e. should the hook consider nagging it)?
 *  - Built-in / denylisted types → no (they return data, not verdicts).
 *  - When the roster is readable → only agents in it owe a verdict.
 *  - Roster unreadable or agent_type absent → default to yes, so the studio backstop
 *    is never silently lost; the non-displacing nag wording keeps this harmless. */
export function owesStudioVerdict(
  agentType: string | undefined,
  roster: Set<string> | null,
): boolean {
  const n = normalizeAgentType(agentType);
  if (!n) return true; // unknown caller — keep the backstop (wording won't displace)
  if (BUILTIN_DENY.has(n)) return false;
  if (roster && roster.size) return roster.has(n);
  return true; // roster unreadable — fall back to backstop
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

/** Parse every JSONL entry as { role, text | null } for turn-boundary detection.
 *  Returns null for lines that are not valid JSON or not a recognised role shape.
 *  `text` is null when the entry carries no text content (tool-use, thinking, metadata).
 *
 *  Role normalisation:
 *  - Metadata pseudo-roles (last-prompt, ai-title, mode, attachment,
 *    file-history-snapshot) → "meta" so they don't act as turn boundaries.
 *  - User entries whose content is a tool_result list → "tool_result" so they can
 *    be distinguished from human prompt entries (role "user" with string or text
 *    content). This lets verdictPresent skip past tool-call round-trips while still
 *    stopping at a genuine new human prompt. */
function parseEntry(line: string): { role: string; text: string | null } | null {
  const s = line.trim();
  if (!s) return null;
  let o: unknown;
  try {
    o = JSON.parse(s);
  } catch {
    return null;
  }
  const msg = (o as any)?.message ?? (o as any);
  const role: string = msg?.role ?? (o as any)?.type ?? "";

  // Normalise metadata pseudo-roles.
  if (/^(last-prompt|ai-title|mode|attachment|file-history-snapshot)$/.test(role)) {
    return { role: "meta", text: null };
  }

  // Distinguish tool_result user entries from human prompt user entries.
  if (role === "user") {
    const content = msg?.content;
    const isToolResult =
      Array.isArray(content) &&
      content.length > 0 &&
      content[0]?.type === "tool_result";
    return { role: isToolResult ? "tool_result" : "user", text: null };
  }

  const text = entryAssistantText(o);
  return { role, text: text?.trim() || null };
}

/** Every non-empty assistant message text in a JSONL transcript, in order. Lines
 *  that aren't valid JSON are skipped (the caller treats an empty result as
 *  "couldn't parse" and falls back to a raw scan). */
export function assistantTexts(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const entry = parseEntry(line);
    if (entry?.role === "assistant" && entry.text) out.push(entry.text);
  }
  return out;
}

/** Walk backwards through `entries` from index `from`, collecting assistant text
 *  blocks. Stops (and returns the stopping index) at the first entry whose role
 *  matches `stopAt`. Skips meta pseudo-entries and tool-use-only assistant entries.
 *  Returns texts in chronological order and the index of the stop entry (or -1). */
function collectUntil(
  entries: Array<{ role: string; text: string | null }>,
  from: number,
  stopAt: ReadonlySet<string>,
): { texts: string[]; stopIndex: number } {
  const collected: string[] = [];
  let i = from;
  for (; i >= 0; i--) {
    const { role, text } = entries[i];
    if (stopAt.has(role)) break;
    if (role === "assistant" && text) collected.push(text);
    // meta, tool_result, and tool-only assistant entries: skip (fall through)
  }
  return { texts: collected.reverse(), stopIndex: i };
}

/** Stop-at set for verdictPresent: only genuine human-prompt entries stop the walk.
 *  tool_result entries (internal tool-call round-trips) are transparent / skipped. */
const HUMAN_PROMPT_BOUNDARY = new Set(["user"]);

/** All text blocks from the final assistant turn — bounded by any user-or-tool entry.
 *  Used by tests; production verdict checking uses verdictPresent directly. */
export function lastTurnTexts(raw: string): string[] {
  const entries = raw
    .split("\n")
    .map(parseEntry)
    .filter((e): e is NonNullable<typeof e> => e !== null);
  // For lastTurnTexts (narrow single-turn view) stop at ANY user entry.
  return collectUntil(entries, entries.length - 1, new Set(["user", "tool_result"])).texts;
}

/** How many trailing chars to scan when we cannot parse the transcript as JSONL. */
const TAIL_BYTES = 60_000;

/** True if the sub-agent closed with an explicit verdict.
 *
 *  Strategy: collect all assistant text blocks between the transcript tail and the
 *  last **human-prompt** user entry (ignoring tool_result boundaries, which are
 *  internal tool-call round-trips). Test that combined text for a verdict token.
 *
 *  Rationale: Claude Code streams responses into the transcript in real time and
 *  sometimes begins writing the next response before SubagentStop fires. Each tool
 *  call round-trip also inserts a tool_result user entry. Using tool_result entries
 *  as hard turn boundaries therefore produces many spurious splits and may land the
 *  search in a no-verdict fragment. By treating only human-prompt user entries as
 *  hard stops, we collect the entire "work block" since the last human message —
 *  which contains all text produced by the agent during that task, including the
 *  verdict in its closing statement — in a single pass.
 *
 *  Falls back to a bounded tail scan only when no assistant message could be parsed,
 *  so an unrecognised transcript format never silently regresses to "no verdict". */
export function verdictPresent(raw: string): boolean {
  const entries = raw
    .split("\n")
    .map(parseEntry)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (entries.length === 0) {
    // Non-JSONL transcript — fall back to raw tail scan.
    const tail = raw.length > TAIL_BYTES ? raw.slice(-TAIL_BYTES) : raw;
    return hasVerdict(tail);
  }

  // Collect all assistant text since the last human-prompt boundary.
  // tool_result entries (internal tool-call round-trips) are transparent — only
  // genuine human-prompt entries (role "user") act as the hard cutoff.
  const { texts } = collectUntil(entries, entries.length - 1, HUMAN_PROMPT_BOUNDARY);
  if (texts.length > 0) return hasVerdict(texts.join("\n"));

  // No assistant text found after the last human prompt — nothing to verify.
  return false;
}

interface Input {
  agent_type?: string;
  transcript_path?: string;
  /** The sub-agent's OWN transcript path (Claude Code ≥ 2.0.42). Preferred over
   *  resolving it from the parent session's `subagents/` directory. */
  agent_transcript_path?: string;
}

if (import.meta.main) {
  const disarm = watchdog();
  const data = await readInput<Input>();
  disarm();

  // Gate: only studio agents owe a verdict. Built-in / non-studio agents (Explore,
  // general-purpose, claude-code-guide, …) return data — nagging them would displace
  // their deliverable with a verdict-only closing message. Stay silent for them.
  const agentsDir = join(import.meta.dir, "..", "..", "agents");
  if (!owesStudioVerdict(data.agent_type, studioRoster(agentsDir))) done();

  const who = data.agent_type ? `\`${data.agent_type}\`` : "the sub-agent";

  // Resolve the sub-agent's own transcript. The `transcript_path` Claude Code passes
  // to SubagentStop is the PARENT session's JSONL (e.g. `<session>.jsonl`), not the
  // sub-agent's own transcript. The sub-agent's transcript lives at:
  //   `<session_dir>/subagents/<agent-id>.jsonl`
  // We find the most recently modified `.jsonl` in that `subagents/` directory.
  // AMBIGUOUS: two subagents finishing within a few seconds of each other means
  // "newest file" may be the OTHER agent's transcript — judging A against B's
  // output yields a false nag (or a false pass). Fail open in that case.
  const AMBIGUOUS = "__ambiguous__";
  function resolveSubagentTranscript(parentPath: string): string | null {
    try {
      // Parent path: /path/to/<session-id>.jsonl
      // Sub-agent dir: /path/to/<session-id>/subagents/
      const subagentsDir = join(parentPath.replace(/\.jsonl$/, ""), "subagents");
      const files = readdirSync(subagentsDir)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => {
          const full = join(subagentsDir, f);
          return { path: full, mtime: statSync(full).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime); // newest first
      if (files.length >= 2 && files[0].mtime - files[1].mtime < 5_000) return AMBIGUOUS;
      return files[0]?.path ?? null;
    } catch {
      return null;
    }
  }

  // Read the transcript and look for an explicit verdict in the sub-agent's final
  // message. If we find one we assume the agent closed properly and stay quiet. If
  // we can read the transcript and there is clearly NO verdict, escalate. If we
  // cannot read it at all, fall back to the plain reminder.
  let verdictSeen = false;
  let couldRead = false;
  try {
    // Prefer the sub-agent's OWN transcript when Claude Code provides it directly
    // (`agent_transcript_path`, ≥ 2.0.42). Older versions only pass the PARENT
    // session's `transcript_path`, so fall back to resolving the sub-agent's own
    // transcript from the `subagents/` sibling directory, then the parent itself.
    const resolved = data.agent_transcript_path
      ? data.agent_transcript_path
      : data.transcript_path
        ? resolveSubagentTranscript(data.transcript_path) ?? data.transcript_path
        : null;
    if (resolved === AMBIGUOUS) done(); // parallel finishers — can't attribute; fail open
    if (resolved) {
      // Bound the read: the parent-transcript fallback can be a whole session's
      // JSONL. The verdict lives in the final work block, so the last ~2MB is
      // ample — reading everything risks eating the hook budget on long sessions.
      const TAIL = 2_000_000;
      const size = statSync(resolved).size;
      let raw: string;
      if (size > TAIL) {
        const fd = openSync(resolved, "r");
        try {
          const buf = Buffer.alloc(TAIL);
          readSync(fd, buf, 0, TAIL, size - TAIL);
          raw = buf.toString("utf8");
        } finally {
          closeSync(fd);
        }
      } else {
        raw = readFileSync(resolved, "utf8");
      }
      couldRead = true;
      verdictSeen = verdictPresent(raw);
    }
  } catch {
    /* couldRead stays false -> plain reminder */
  }

  if (verdictSeen) {
    // Emit an explicit empty additionalContext rather than silently exiting.
    // (Best-effort: contexts are appended per event, so this cannot be relied on
    // to REPLACE a prior nag — it just avoids adding one and keeps the emit path
    // uniform. Harmless either way.)
    emit({
      hookSpecificOutput: {
        hookEventName: "SubagentStop",
        additionalContext: "",
      },
    });
  }

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
        "halts its dependents until the blocker clears. **Append the verdict as a " +
        "trailing line to your EXISTING final deliverable — do NOT write a new " +
        "verdict-only message, and do NOT move your findings/data/answer to a " +
        "separate earlier message. The requested content must remain in your final " +
        "message in full; the verdict supplements it, never replaces it.** If no " +
        "verdict was given, add one rather than advancing on an unverified result.",
    },
  });
}
