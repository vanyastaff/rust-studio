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
// 3) ROUTE HINT — per prompt: when the prompt has the SHAPE of work a studio skill owns
//    (Rust code pasted with "review it", "is it in scope", "the binary is 48 MB", "attack
//    this design"), name that one skill. Measured 2026-09-05 with the eval runner: on 6 of
//    the first 7 review-shaped cases the session answered inline in one turn — good
//    findings, no skill, no agent, no verdict — while the generic nudge above was in
//    context. A generic "prefer a skill" does not route; a pointer to the skill does.
//    Once per (session, skill) so a long review session is not told about /review on every
//    prompt.
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

/** Prompt SHAPE → the studio skill that owns it. Order matters: the first match wins, so the
 *  specific lenses (unsafe, security, semver, perf) come before the general `/review`. Every
 *  target is model-invocable — a user-only skill (`/migrate`, `/publish`, `/commit`) would be a
 *  dead pointer, so those are named as "suggest to the user" in `/help` instead. */
export const ROUTES: ReadonlyArray<{ skill?: string; agent?: string; when: RegExp; why: string }> = [
  { skill: "start", when: /\b(start|begin|bootstrap|scaffold|set up|kick off)\b[^\n]{0,40}\bnew\b[^\n]{0,30}\b(rust )?(project|crate|library|cli|service|binary)\b|\bnew (rust )?(project|crate)\b[^\n]{0,60}\b(how|where|begin|start)/i, why: "a new Rust project to orient and scaffold" },
  { agent: "dependency-manager", when: /\b(vet|vetting|audit)\b[^\n]{0,60}\b(crate|dependency|dep)\b|\b(should we|can we|worth) (add|adopt|take|pull in)(ing)?\b[^\n]{0,40}\b(crate|dependency)\b|\bnew dependency\b/i, why: "a dependency to vet before it is added (`/add-dep` is the user-invoked skill for landing it)" },
  { skill: "flaky-hunt", when: /\bflak(y|iness|es)\b|fails? (about |roughly |~)?(one|1) (run )?in (\d+|two|three|four|five|six|seven|eight|nine|ten)\b|intermittent(ly)? fail/i, why: "an intermittently failing test suite" },
  { skill: "bloat", when: /\b(binary|wasm|executable)\b[^\n]{0,60}\b(size|\d+ ?mb|too (big|large)|shrink)|\b(shrink|reduce)\b[^\n]{0,40}\b(binary|size)\b/i, why: "binary size" },
  { skill: "fix-build", when: /\b(cargo (build|check)|the build|compil(e|ation))\b[^\n]{0,60}\b(fails?|failing|broken|error)|error\[E\d{4}\]/i, why: "a red build" },
  { skill: "audit-unsafe", when: /\bunsafe\b[^\n]{0,80}\b(review|audit|sound|miri|ub\b|undefined behavio)/i, why: "unsafe code to audit" },
  { skill: "security-audit", when: /\b(security|vulnerab|inject(ion)?|untrusted input|auth(oriz|entic)ation|secrets?|rustsec|cargo audit)\b[^\n]{0,80}\b(review|audit|check|find)|\b(review|audit)\b[^\n]{0,60}\b(security|vulnerab)/i, why: "a security review" },
  { skill: "design-api", when: /\bdesign\b[^\n]{0,60}\b(api|interface|crate|trait|surface)\b/i, why: "an API design session" },
  { skill: "api-review", when: /\b(semver|breaking change|public api|public surface|api surface)\b|\b(tag|publish|release|ship)\b[^\n]{0,40}\b\d+\.\d+(\.\d+)?\b|\bbump(ed|ing)? (the )?version|semver-checks/i, why: "a public-API or release-version question" },
  { skill: "scope-check", when: /\b(in|out of|within) scope\b|scope creep|what ships,? what gets split|\bthe story\b[^\n]{0,80}\b(diff|branch|change)/i, why: "a scope adjudication" },
  { skill: "refactor", when: /\b(refactor|simplif(y|ied)|untangle|make (this|it) readable|readab(le|ility)|spaghetti|clean(er)? up)\b[^\n]{0,80}(code|function|module|file|this|it)\b|behaviou?r must (stay|remain)/i, why: "a behavior-preserving reshape" },
  { skill: "architecture", when: /\b(crate|module|layer(ing)?|dependency direction|boundar(y|ies)|in shape to extend|architect)/i, why: "a crate/module boundary question" },
  { agent: "harsh-critic", when: /\b(attack|critique|poke holes in|tear apart|strongest case against|does it survive)\b[^\n]{0,60}\b(design|plan|proposal|approach|idea)\b|\b(design|plan|proposal)\b[^\n]{0,40}\b(attack|critique)/i, why: "an adversarial pass over a design or plan" },
  { skill: "perf", when: /\b(slow|latency|throughput|hot ?path|allocat(es|ions?)|benchmark|profil(e|ing)|faster)\b[^\n]{0,60}\b(rust|code|function|loop|path|this|it)\b/i, why: "a performance question" },
  { skill: "review", when: /```rust|\b(review|audit)\b[^\n]{0,80}\b(code|diff|change|crate|module|file|function|handler|worker|this|it|before (we )?(merge|ship|land|tag))\b|\bbefore (i|we) merge\b|\bmergeable\b|\bmerge verdict\b/i, why: "a review of Rust code" },
];

/** The one skill or agent this prompt's shape points at, or null. Pure. */
export function routeFor(prompt: string): { skill?: string; agent?: string; why: string } | null {
  const text = String(prompt ?? "");
  if (text.trim().length < 12) return null;
  // A prompt that already names a studio skill is routed; say nothing.
  if (/(^|[\s(`])\/(rust-studio:)?[a-z][a-z-]+\b/.test(text)) return null;
  for (const r of ROUTES) if (r.when.test(text)) return { skill: r.skill, agent: r.agent, why: r.why };
  return null;
}

/** Marker key for the dedupe: one hint per target per session. */
export function routeKey(r: { skill?: string; agent?: string }): string {
  return r.skill ? `/${r.skill}` : `@${r.agent}`;
}

export function renderRoute(r: { skill?: string; agent?: string; why: string }): string {
  if (r.agent) {
    return (
      `Rust Code Studio routing: this prompt reads as ${r.why} — the studio path is the \`${r.agent}\` sub-agent. ` +
      `Spawn it now with the Agent tool (subagent_type \`rust-studio:${r.agent}\`), hand it the full text the user gave, ` +
      "and relay its findings and its verdict line verbatim; an inline answer skips the independent lens the studio exists for."
    );
  }
  return (
    `Rust Code Studio routing: this prompt reads as ${r.why} — the studio path is \`/${r.skill}\` ` +
    "(its agents, gates, evidence, and a COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED verdict). " +
    "Invoke it now with the Skill tool — also when no project is checked out here, since the skill's method is the " +
    "deliverable — unless the user asked for something narrower; an inline answer skips the independent lenses the studio exists for."
  );
}

/** Skills already pointed at this session (JSON array in a per-session marker). */
export function readRouted(sid: string): Set<string> {
  try {
    return new Set(JSON.parse(readFileSync(join(markerDir("rust-studio-route"), sid), "utf8")));
  } catch {
    return new Set();
  }
}
export function writeRouted(sid: string, skills: Set<string>): void {
  try {
    mkdirSync(markerDir("rust-studio-route"), { recursive: true });
    writeFileSync(join(markerDir("rust-studio-route"), sid), JSON.stringify([...skills]));
  } catch {
    /* non-fatal */
  }
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

  // 3) route hint — the skill this prompt's shape points at, once per (session, skill).
  //    Shares the routing_nudge switch: someone who turned the nudge off wants no routing.
  if (sid && optionBool("routing_nudge", true) && typeof data.prompt === "string") {
    try {
      const route = routeFor(data.prompt);
      if (route) {
        const routed = readRouted(sid);
        const key = routeKey(route);
        if (!routed.has(key)) {
          routed.add(key);
          writeRouted(sid, routed);
          out.push(renderRoute(route));
        }
      }
    } catch {
      /* routing is best-effort */
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
