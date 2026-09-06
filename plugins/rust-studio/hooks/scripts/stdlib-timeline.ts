#!/usr/bin/env bun
// Rust Code Studio — MSRV-gated modern-idiom set.
//
// Two separate failures put stale Rust in a diff, and naming new APIs in a rule only
// fixes one of them. A model's training data lags the toolchain (it has not seen the
// stabilization), and even where it has, it writes the older shape because that shape
// dominates the corpus. Listing recent stabilizations in prose addresses the lag and
// makes the second failure worse in the other direction: told about `bool::ok_or` on a
// crate whose `rust-version` is 1.70, an agent writes code that does not compile.
//
// So the list is data (`rules/stdlib-timeline.json`), the crate's floor decides which
// part of it is true here, and only that part is ever asserted. A crate on 1.70 is told
// nothing about 1.98 except how many stabilizations its floor is giving up.
//
// The floor comes from `rust-version` (following `workspace = true` inheritance), else
// the studio's `default_msrv` option, else the edition's implied minimum compiler — a
// sound lower bound, since edition 2024 cannot be built before 1.85. With none of those
// the set is not rendered at all: an ungated list is the bug this module exists to fix.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Stabilization {
  /** Rust version that stabilized it, `major.minor`. */
  version: string;
  /** `idiom` — reach for this. `breakage` — expect this, do not work around it. */
  kind: "idiom" | "breakage";
  /** What to reach for. */
  item: string;
  /** For an idiom, the habit it displaces — concrete enough to recognize in a diff.
   *  For breakage, the standalone directive that follows the fact. */
  instead: string;
  /** Clippy lint that mechanizes the swap, when one exists (bare name, no `clippy::`). */
  clippy?: string;
}

/** Idioms shown at once. Newest first, because recency tracks how likely the model is to
 *  have missed it; the tail is the well-known end of the list and costs context to repeat. */
export const MAX_IDIOMS = 12;
/** Toolchain-breakage notes shown at once — these are recent-release facts, not a history. */
export const MAX_BREAKAGE = 2;

/** `"1.98"` → `[1, 98]`. Tolerates `1.98.0`, `1.85.1-nightly`, and leading `v`. */
export function parseVersion(v: string): number[] {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v));
  if (!m) return [];
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

/** Numeric version order, so 1.100 sorts above 1.98 rather than below it. */
export function cmpVersion(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x.length || !y.length) return 0;
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The oldest compiler that can build an edition — a sound floor when `rust-version` is
 *  absent, because the edition itself refuses to build below it. */
export function editionFloor(edition: string | null | undefined): string | null {
  switch (String(edition ?? "").trim()) {
    case "2024":
      return "1.85";
    case "2021":
      return "1.56";
    case "2018":
      return "1.31";
    case "2015":
      return "1.0";
    default:
      return null;
  }
}

export interface FloorInput {
  /** `rust-version` from the crate (or inherited from the workspace). */
  msrv?: string | null;
  /** `edition` from the crate. */
  edition?: string | null;
  /** The studio's `default_msrv` option. */
  defaultMsrv?: string | null;
}

export interface Floor {
  version: string;
  /** Where the floor came from — printed, so the agent can tell an assertion from a guess. */
  source: string;
}

/** The floor to gate on, or null when nothing establishes one. */
export function resolveFloor(input: FloorInput): Floor | null {
  const declared = String(input.msrv ?? "").trim();
  if (declared && parseVersion(declared).length)
    return { version: declared, source: "`rust-version`" };
  const fallback = String(input.defaultMsrv ?? "").trim();
  if (fallback && parseVersion(fallback).length)
    return { version: fallback, source: "the studio `default_msrv` option" };
  const ed = editionFloor(input.edition);
  if (ed) return { version: ed, source: `edition ${String(input.edition).trim()}'s minimum compiler` };
  return null;
}

/** Load and validate `rules/stdlib-timeline.json`. Returns [] on any problem — a broken
 *  data file must not wedge a hook, and saying nothing is the safe failure here. */
export function loadTimeline(pluginRoot: string): Stabilization[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(pluginRoot, "rules", "stdlib-timeline.json"), "utf8"));
  } catch {
    return [];
  }
  const list = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return [];
  const out: Stabilization[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const { version, kind, item, instead, clippy } = e as Record<string, unknown>;
    if (typeof version !== "string" || !parseVersion(version).length) continue;
    if (kind !== "idiom" && kind !== "breakage") continue;
    if (typeof item !== "string" || !item) continue;
    if (typeof instead !== "string" || !instead) continue;
    out.push({
      version,
      kind,
      item,
      instead,
      ...(typeof clippy === "string" && clippy ? { clippy } : {}),
    });
  }
  return out;
}

export interface GatedSet {
  /** Idioms the crate's floor allows, newest first. */
  available: Stabilization[];
  /** Idioms above the floor — counted, never named: naming them is the bug. */
  blocked: number;
  /** Toolchain-breakage notes, newest first. Not MSRV-gated (see `renderTimeline`). */
  breakage: Stabilization[];
}

/** Split the timeline against a floor. */
export function gateAt(entries: Stabilization[], floor: string): GatedSet {
  const newestFirst = (a: Stabilization, b: Stabilization) => cmpVersion(b.version, a.version);
  const idioms = entries.filter((e) => e.kind === "idiom");
  const available = idioms.filter((e) => cmpVersion(e.version, floor) <= 0).sort(newestFirst);
  return {
    available,
    blocked: idioms.length - available.length,
    breakage: entries.filter((e) => e.kind === "breakage").sort(newestFirst),
  };
}

/** The block injected next to the core.md pointer, or "" when there is nothing to say.
 *
 *  Breakage notes are deliberately NOT filtered by the floor. MSRV is the oldest compiler
 *  the crate supports; breakage lands on the compiler actually running the build, which is
 *  normally newer. Each is printed with its version so the condition stays visible instead
 *  of being asserted as unconditional. */
export function renderTimeline(entries: Stabilization[], floor: Floor | null): string {
  if (!entries.length) return "";

  if (!floor) {
    return (
      "**No MSRV floor for this crate** — no `rust-version` in `Cargo.toml` (or inherited " +
      "from the workspace), no `default_msrv` set, no edition to imply one. Version-keyed " +
      "idiom guidance is therefore withheld rather than guessed: check any recent API you " +
      "reach for against the crate's real floor, and run `/msrv-check` to pin one."
    );
  }

  const set = gateAt(entries, floor.version);
  if (!set.available.length && !set.breakage.length) return "";

  const lines: string[] = [];
  if (set.available.length) {
    const shown = set.available.slice(0, MAX_IDIOMS);
    lines.push(
      `**Modern idioms available at MSRV ${floor.version}** (from ${floor.source}) — each ` +
        "replaces a shape that is more common in training data than in current Rust, so " +
        "reaching for the older one is the default failure. Prefer the left over the right:",
      "",
      ...shown.map((e) => {
        const lint = e.clippy ? ` · \`clippy::${e.clippy}\`` : "";
        return `- ${e.item} (${e.version}) — over ${e.instead}${lint}`;
      }),
    );
    const hidden = set.available.length - shown.length;
    if (hidden > 0)
      lines.push(`- …and ${hidden} older stabilization(s) at this floor, omitted as well-known.`);
  }

  if (set.blocked > 0) {
    lines.push(
      "",
      `${set.blocked} later stabilization(s) sit **above** this floor and are not usable ` +
        "here — do not reach for them; `/msrv-check` prices raising `rust-version`.",
    );
  }

  if (set.breakage.length) {
    lines.push(
      "",
      "Toolchain facts (these track the compiler running the build, not the MSRV floor):",
      ...set.breakage
        .slice(0, MAX_BREAKAGE)
        .map((e) => `- On ${e.version} and later, ${e.item}. ${e.instead}`),
    );
  }

  const lints = [...new Set(set.available.map((e) => e.clippy).filter(Boolean))];
  if (lints.length) {
    lines.push(
      "",
      `Several of these are mechanical: \`cargo clippy -- ${lints.map((l) => `-W clippy::${l}`).join(" ")}\` ` +
        "finds them. `clippy::incompatible_msrv` catches the reverse — an API newer than `rust-version`.",
    );
  }

  return lines.join("\n");
}
