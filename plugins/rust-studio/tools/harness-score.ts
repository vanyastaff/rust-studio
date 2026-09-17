#!/usr/bin/env bun
// Rust Code Studio — harness score: the plugin measuring itself, as a score file for /evolve.
//
// Prints `key<TAB>value<TAB>goal` lines (the format scripts/score-compare.sh judges) over the
// shipped instruction layer: skills/*/SKILL.md, agents/*.md, rules/*.md, docs/*.md — never the
// bundled references/ copies, which mirror docs/ and rules/. Every judged metric is a defect
// count with a deterministic detector; quality that only an eval can see (routing, review
// findings) is not here, which is why /evolve pairs this file with a diff review and never
// accepts on numbers alone.
//
//   bun tools/harness-score.ts            # the score file on stdout
//   bun tools/harness-score.ts --detail   # also, on stderr, where each judged hit is
//
// Metrics:
//   prose_errors / prose_warnings   hooks/scripts/prose-gate.ts over every shipped file, full
//                                   scope (CI gates touched sentences; this is the backlog)
//   duplicate_sentences             a sentence of 12+ words that appears in two or more shipped
//                                   files — writing-skills.md §7 "restatement across layers"
//   keep_out_hits                   phrases from claude-5-compat.md §"Instructions to keep out"
//                                   found in a skill, agent or rule body (docs are exempt: they
//                                   describe the phrases)
//   tests_passed                    `bun test` passes (max) — the gate's own count, on the board
//   description_chars, skill_count, agent_count, shipped_words   recorded, never judged
//
// Run from the plugin root (plugins/rust-studio).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sentences, stripProse } from "../hooks/scripts/prose-gate.ts";

const detail = process.argv.includes("--detail");
const root = process.cwd();

function listMd(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "references" || name === "node_modules") continue;
        walk(p);
      } else if (name.endsWith(".md")) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

const skills = listMd("skills").filter((p) => p.endsWith("SKILL.md"));
const agents = listMd("agents");
const rules = listMd("rules");
const docs = listMd("docs").filter((p) => !p.includes("/templates/") && !p.includes("/adr/"));
const shipped = [...skills, ...agents, ...rules, ...docs];
const bodies = [...skills, ...agents, ...rules]; // where an instruction is an instruction

// --- prose gate, full scope --------------------------------------------------------------------
const prose = Bun.spawnSync(["bun", "hooks/scripts/prose-gate.ts", "--full", ...shipped], { cwd: root });
const proseLast = new TextDecoder().decode(prose.stdout).trim().split("\n").pop() ?? "";
const proseErrors = Number(/(\d+) errors/.exec(proseLast)?.[1] ?? NaN);
const proseWarnings = Number(/(\d+) warnings/.exec(proseLast)?.[1] ?? NaN);

// --- duplicate sentences across files ------------------------------------------------------------
const seen = new Map<string, Set<string>>();
const sample = new Map<string, string>();
for (const file of shipped) {
  const text = stripProse(readFileSync(file, "utf8"));
  for (const s of sentences(text)) {
    const words = s.text.trim().split(/\s+/);
    if (words.length < 12) continue;
    const key = words.join(" ").toLowerCase().replace(/[`*_"'“”‘’]/g, "");
    if (!seen.has(key)) { seen.set(key, new Set()); sample.set(key, s.text.trim()); }
    seen.get(key)!.add(file);
  }
}
let duplicateSentences = 0;
for (const [key, files] of seen) {
  if (files.size < 2) continue;
  duplicateSentences++;
  if (detail) console.error(`duplicate_sentences: ${[...files].join(", ")}\n    ${sample.get(key)!.slice(0, 140)}`);
}

// --- keep-out instructions (claude-5-compat.md §"Instructions to keep out") ----------------------
const KEEP_OUT: RegExp[] = [
  /\bdouble[- ]check\b/i,
  /\bverify (your|the) (own )?(work|answer|result)\b/i,
  /\b(show|transcribe|explain) your (thinking|reasoning|chain of thought)\b/i,
  /\bonly (report|flag) (high|the most|correctness)/i,
  /\bbe conservative\b/i,
  /\bflag only\b/i,
  /\bnever use (bullets|headers|bold)\b/i,
  /\bhold all findings\b/i,
];
let keepOutHits = 0;
for (const file of bodies) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const re of KEEP_OUT) {
      if (re.test(line)) {
        keepOutHits++;
        if (detail) console.error(`keep_out_hits: ${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
        break;
      }
    }
  });
}

// --- tests ------------------------------------------------------------------------------------------
const tests = Bun.spawnSync(["bun", "test"], { cwd: root });
const testsOut = new TextDecoder().decode(tests.stdout) + new TextDecoder().decode(tests.stderr);
const testsPassed = Number(/(\d+) pass/.exec(testsOut)?.[1] ?? NaN);

// --- recorded, never judged -------------------------------------------------------------------------
let descriptionChars = 0;
for (const f of skills) {
  const m = /^description:\s*"?(.*?)"?\s*$/m.exec(readFileSync(f, "utf8"));
  if (m) descriptionChars += m[1].length;
}
let shippedWords = 0;
for (const f of bodies) shippedWords += stripProse(readFileSync(f, "utf8")).split(/\s+/).filter(Boolean).length;

// --- emit --------------------------------------------------------------------------------------------
const rows: [string, number, "min" | "max" | "info"][] = [
  ["prose_errors", proseErrors, "min"],
  ["prose_warnings", proseWarnings, "min"],
  ["duplicate_sentences", duplicateSentences, "min"],
  ["keep_out_hits", keepOutHits, "min"],
  ["tests_passed", testsPassed, "max"],
  ["description_chars", descriptionChars, "info"],
  ["skill_count", skills.length, "info"],
  ["agent_count", agents.length, "info"],
  ["shipped_words", shippedWords, "info"],
];
for (const [k, v, g] of rows) {
  if (Number.isNaN(v)) { console.error(`harness-score: ${k} could not be measured — omitted`); continue; }
  console.log(`${k}\t${v}\t${g}`);
}
