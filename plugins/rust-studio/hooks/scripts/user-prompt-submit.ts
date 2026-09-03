#!/usr/bin/env bun
// Rust Code Studio — prompt-time memory recall + routing nudge (UserPromptSubmit).
//
// For UserPromptSubmit the documented mechanism is the simplest one: whatever the
// hook prints to stdout on exit 0 is added to the prompt context. Two things ride it:
//
// 1) PROMPT-SCOPED RECALL — the host loads the whole memory index at session start
//    but never says which notes matter for THIS prompt. So each prompt is matched
//    against the index (title, slug, one-line hook); a note that scores a strong hit
//    is surfaced once per session as a pointer (title, kind/age, path). Cheap: one
//    ≤25 KB file read; silent when nothing matches or the note was already surfaced.
// 2) ROUTING NUDGE — once per session: prefer a studio skill over ad-hoc steps and
//    /recall the area before implementing.
//
// Never blocks (no decision:block) and never fails the session. Codex delivers the
// same event; if its payload carries no `prompt`, only the nudge runs.

import { readInput, watchdog, optionBool } from "./_lib.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  labelFor,
  rankEntries,
  readIndex,
  resolveStore,
  terms,
  type IndexEntry,
  type Ranked,
} from "./memory-store.ts";

/** A pointer needs a strong hit (slug/title) or three weak ones — one shared word in
 *  a hook is noise, not recall. */
export const MIN_PROMPT_SCORE = 3;
export const MAX_PROMPT_POINTERS = 3;

/** Pure selection: which index entries does this prompt recall, minus ones already
 *  surfaced this session. */
export function pickPromptPointers(entries: IndexEntry[], prompt: string, already: Set<string>): Ranked[] {
  const sig = terms(prompt);
  if (sig.size === 0) return [];
  return rankEntries(entries, sig, MAX_PROMPT_POINTERS + already.size)
    .filter((r) => r.score >= MIN_PROMPT_SCORE && !already.has(r.file))
    .slice(0, MAX_PROMPT_POINTERS);
}

export function renderPointers(dir: string, picks: Ranked[], labelOf: (file: string) => string): string {
  const d = dir.replace(/\\/g, "/");
  return (
    `Rust Code Studio memory — ${picks.length === 1 ? "a note matches" : `${picks.length} notes match`} this prompt ` +
    "(read before re-deriving; verify a note still holds before it steers):\n" +
    picks.map((p) => `- **${p.title}**${labelOf(p.file)}${p.hook ? ` — ${p.hook}` : ""} → \`${d}/${p.file}\``).join("\n")
  );
}

function markerDir(name: string): string {
  return join(tmpdir(), name);
}

/** Files already surfaced this session (JSON array in a per-session marker). */
export function readSurfaced(sid: string): Set<string> {
  try {
    return new Set(JSON.parse(readFileSync(join(markerDir("rust-studio-recall"), sid), "utf8")));
  } catch {
    return new Set();
  }
}
export function writeSurfaced(sid: string, files: Set<string>): void {
  try {
    mkdirSync(markerDir("rust-studio-recall"), { recursive: true });
    writeFileSync(join(markerDir("rust-studio-recall"), sid), JSON.stringify([...files]));
  } catch {
    /* non-fatal */
  }
}

if (import.meta.main) {
  const disarm = watchdog(6_000);
  const data = await readInput<{ session_id?: string; prompt?: string; cwd?: string }>();

  const out: string[] = [];
  // Without a session_id there is no per-session key: a shared marker would mute every
  // later id-less session and no marker would spam every prompt — stay quiet.
  const sid = data.session_id ? String(data.session_id).replace(/[^A-Za-z0-9]/g, "_") : "";

  // 1) prompt-scoped recall
  if (sid && optionBool("memory_recall", true) && typeof data.prompt === "string" && data.prompt.trim()) {
    try {
      const store = resolveStore(data.cwd || process.cwd());
      const index = store.exists ? readIndex(store.dir) : null;
      if (index && index.entries.length) {
        const already = readSurfaced(sid);
        const picks = pickPromptPointers(index.entries, data.prompt, already);
        if (picks.length) {
          out.push(renderPointers(store.dir, picks, (f) => labelFor(store.dir, f)));
          for (const p of picks) already.add(p.file);
          writeSurfaced(sid, already);
        }
      }
    } catch {
      /* recall is best-effort */
    }
  }

  // 2) routing nudge, once per session
  if (sid && optionBool("routing_nudge", true)) {
    try {
      const dir = markerDir("rust-studio-nudge");
      const marker = join(dir, sid);
      if (!existsSync(marker)) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(marker, "1");
        out.push(
          "Rust Code Studio: for any non-trivial task, prefer a studio skill (`/help` " +
            "for the catalog) over ad-hoc steps, and run `/recall <area>` before " +
            "implementing in a known area so prior decisions and gotchas carry forward.",
        );
      }
    } catch {
      /* emit nothing rather than risk spamming */
    }
  }

  disarm();
  if (out.length) process.stdout.write(out.join("\n\n"));
  process.exit(0);
}
