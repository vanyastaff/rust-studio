#!/usr/bin/env bun
// Rust Code Studio — trajectory report: how the studio actually performs, read from the real
// session transcripts instead of from a benchmark.
//
// Claude Code writes every session to ~/.claude/projects/<project>/<session>.jsonl and every
// sub-agent to <session>/subagents/agent-<id>.jsonl beside a .meta.json (agentType,
// requestShape). This tool walks them and reports, per skill and per agent, what a benchmark
// cannot: how often each fired in real work, which verdict it returned, how long it ran, how
// often it was spawned in the background, how often a read-only lens wrote, which hooks blocked
// the turn, where the user had to interrupt, and which error strings recur. The numbers are
// leads for /evolve's Pick step — a mechanism still has to be read from the trace behind them.
//
//   bun tools/trajectory-report.ts                          # every project with a studio trace
//   bun tools/trajectory-report.ts --project nebula --since 2026-09-10
//   bun tools/trajectory-report.ts --json                   # machine-readable
//
// Transcripts are the user's own data and stay on this machine; the report quotes no prompt
// text, only tool names, verdict tokens and the first line of an error.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const VERDICT = /\b(COMPLETE|NEEDS WORK|REDO-TO-BAR|BLOCKED|APPROVE|REJECT|ACCEPTABLE|RESHAPE NEEDED|DOESN'T SURVIVE|SURVIVES|IN SCOPE|OVER SCOPE|UNDER SCOPE|MIXED|ALL MET|NOT MET|HANDOFF REQUIRED|PASS|FAIL)\b/;
// An assistant turn that only acknowledges a sub-agent's completion notice — the shape that,
// on a headless host, becomes the final message and loses the deliverable.
const NOTICE_REPLY = /completion (event|notice)|already folded in|standing by for|when (it|they) (lands?|reports?|returns?)|still running|I'll (merge|fold|report) .* when/i;
const READ_ONLY_AGENTS = new Set(["rust-reviewer", "harsh-critic", "rust-scout", "unsafe-auditor", "security-auditor", "slop-auditor", "chief-architect", "product-steward", "api-design-lead", "async-systems-lead", "systems-perf-lead", "qa-lead", "release-lead", "tooling-lead"]);

interface Opts { project?: string; since?: string; json: boolean }
function parseArgs(argv: string[]): Opts {
  const o: Opts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") o.project = argv[++i];
    else if (a === "--since") o.since = argv[++i];
    else if (a === "--json") o.json = true;
    else if (a === "-h" || a === "--help") { console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 18).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(0); }
    else throw new Error(`unknown argument: ${a}`);
  }
  return o;
}

export const bare = (id: string) => id.replace(/^[a-z0-9-]+:/, "");

interface AgentRun {
  type: string; shape: string; session: string; project: string;
  turns: number; seconds: number; handback: boolean; verdict: string | null;
  wrote: boolean; modelErrors: number; memoryLines: number; started: string;
}
interface SkillEpisode { name: string; session: string; project: string; ts: string; endsWithVerdict: boolean | null; turnsToNextPrompt: number; interrupted: boolean }
interface SessionStats {
  session: string; project: string; started: string; prompts: number; assistantTurns: number;
  skills: SkillEpisode[]; spawns: { type: string; background: boolean | null }[];
  guardBlocks: Record<string, number>; interruptions: number; notifications: number; handbacks: number;
  noticeReplies: number; errors: Record<string, number>;
}

function readJsonl(path: string): any[] {
  const out: any[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* a partial trailing line */ }
  }
  return out;
}

const textOf = (content: any): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((x) => x?.type === "text").map((x) => x.text).join("\n");
  return "";
};

/** The category of an error result: its first line, with numbers and paths blanked. */
export function errorKey(s: string): string {
  return s.split("\n")[0].replace(/\/[\w./-]+/g, "<path>").replace(/\b[0-9a-f]{8,}\b/g, "<id>").replace(/\d+/g, "N").slice(0, 90);
}

export function analyzeSession(path: string, project: string, since?: string): SessionStats | null {
  const rows = readJsonl(path);
  const session = basename(path, ".jsonl");
  const s: SessionStats = { session, project, started: "", prompts: 0, assistantTurns: 0, skills: [], spawns: [], guardBlocks: {}, interruptions: 0, notifications: 0, handbacks: 0, noticeReplies: 0, errors: {} };
  let open: SkillEpisode | null = null;
  let lastAssistantText = "";
  for (const r of rows) {
    const ts = r.timestamp ?? "";
    if (!s.started && ts) s.started = ts;
    if (r.type === "assistant") {
      s.assistantTurns++;
      if (open) open.turnsToNextPrompt++;
      for (const x of r.message?.content ?? []) {
        if (x.type === "text" && x.text?.trim()) {
          lastAssistantText = x.text;
          if (NOTICE_REPLY.test(x.text)) s.noticeReplies++;
        }
        if (x.type !== "tool_use") continue;
        if (x.name === "Skill" && x.input?.skill) {
          if (open) { open.endsWithVerdict = VERDICT.test(lastAssistantText); s.skills.push(open); }
          open = { name: bare(String(x.input.skill)), session, project, ts, endsWithVerdict: null, turnsToNextPrompt: 0, interrupted: false };
        }
        if (x.name === "Agent") s.spawns.push({ type: bare(String(x.input?.subagent_type ?? "?")), background: typeof x.input?.run_in_background === "boolean" ? x.input.run_in_background : null });
      }
    } else if (r.type === "user") {
      const c = r.message?.content;
      const text = textOf(c);
      if (typeof c === "string" || (Array.isArray(c) && c.some((x) => x?.type === "text"))) {
        if (/^\s*<task-notification>/.test(text)) s.notifications++;
        else if (/^\s*<agent-message /.test(text) || /Subagent hand-back/.test(text)) s.handbacks++;
        else if (/^\s*Stop hook feedback:/.test(text)) {
          // a studio hook names itself as [bun ".../<hook>.ts"]; anything else is the host's
          // own goal check-in or a user-configured hook
          const m = /\/([a-z-]+)\.ts"\]/.exec(text);
          const g = m?.[1] ?? "other (goal check-in / user hook)";
          s.guardBlocks[g] = (s.guardBlocks[g] ?? 0) + 1;
        } else if (/\[Request interrupted by user/.test(text)) {
          s.interruptions++;
          if (open) open.interrupted = true;
        } else if (!/^\s*</.test(text) && !/^\s*Base directory for this skill/.test(text)) {
          s.prompts++;
          if (open) { open.endsWithVerdict = VERDICT.test(lastAssistantText); s.skills.push(open); open = null; }
        }
      }
      if (Array.isArray(c)) for (const x of c) {
        if (x?.type === "tool_result" && x.is_error) {
          const k = errorKey(typeof x.content === "string" ? x.content : textOf(x.content));
          if (k) s.errors[k] = (s.errors[k] ?? 0) + 1;
        }
      }
    }
  }
  if (open) { open.endsWithVerdict = VERDICT.test(lastAssistantText); s.skills.push(open); }
  if (since && s.started && s.started < since) return null;
  return s;
}

export function analyzeAgent(path: string, session: string, project: string): AgentRun | null {
  const metaPath = path.replace(/\.jsonl$/, ".meta.json");
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
  const rows = readJsonl(path);
  if (!rows.length) return null;
  const type = bare(String(meta.agentType ?? "?"));
  let turns = 0, wrote = false, modelErrors = 0, memoryLines = 0, handback = false, verdict: string | null = null;
  let first = "", last = "";
  for (const r of rows) {
    if (r.timestamp) { if (!first) first = r.timestamp; last = r.timestamp; }
    if (r.type === "assistant") {
      turns++;
      for (const x of r.message?.content ?? []) {
        if (x.type === "text" && /MEMORY:/.test(x.text ?? "")) memoryLines++;
        if (x.type !== "tool_use") continue;
        if (x.name === "Write" || x.name === "Edit" || x.name === "NotebookEdit") wrote = true;
        if (x.name === "SubagentHandback") { handback = true; verdict = VERDICT.exec(String(x.input?.message ?? ""))?.[1] ?? null; }
      }
    } else if (r.type === "user") {
      const c = r.message?.content;
      if (Array.isArray(c)) for (const x of c) if (x?.type === "tool_result" && /model_not_found|issue with the selected model/.test(typeof x.content === "string" ? x.content : textOf(x.content))) modelErrors++;
    }
  }
  const seconds = first && last ? Math.max(0, (Date.parse(last) - Date.parse(first)) / 1000) : 0;
  return { type, shape: String(meta.requestShape ?? "?"), session, project, turns, seconds, handback, verdict, wrote, modelErrors, memoryLines, started: first };
}

function median(xs: number[]): number { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

export function report(sessions: SessionStats[], agents: AgentRun[]): string {
  const L: string[] = [];
  L.push(`# Trajectory report — ${sessions.length} sessions, ${agents.length} sub-agent runs, ${new Set(sessions.map((s) => s.project)).size} project(s)`, "");
  L.push("Real transcripts, not a benchmark. A number here is a lead: read the trace behind it before it becomes a finding.", "");

  // skills
  const bySkill = new Map<string, SkillEpisode[]>();
  for (const s of sessions) for (const e of s.skills) bySkill.set(e.name, [...(bySkill.get(e.name) ?? []), e]);
  L.push("## Skills — invocations in real sessions", "", "| skill | fires | sessions | ends with a verdict | interrupted by the user | median assistant turns until the next prompt |", "|---|---:|---:|---:|---:|---:|");
  for (const [name, eps] of [...bySkill].sort((a, b) => b[1].length - a[1].length)) {
    const judged = eps.filter((e) => e.endsWithVerdict !== null);
    L.push(`| ${name} | ${eps.length} | ${new Set(eps.map((e) => e.session)).size} | ${pct(judged.filter((e) => e.endsWithVerdict).length, judged.length)} | ${pct(eps.filter((e) => e.interrupted).length, eps.length)} | ${median(eps.map((e) => e.turnsToNextPrompt))} |`);
  }
  L.push("");

  // agents
  const byAgent = new Map<string, AgentRun[]>();
  for (const a of agents) byAgent.set(a.type, [...(byAgent.get(a.type) ?? []), a]);
  // The hand-back tool has a birthday; before it, no run could hand back, so the rate is
  // measured over the runs that could.
  const hbSince = agents.filter((a) => a.handback).map((a) => a.started).sort()[0] ?? "";
  L.push("## Agents — sub-agent runs", "", `Hand-back rate is over runs since ${hbSince.slice(0, 10) || "n/a"}, the first hand-back in the corpus. "Died early" is a run of two turns or fewer.`, "", "| agent | runs | background | handed back | died early | verdicts | wrote (read-only lens) | model errors | median turns | median minutes |", "|---|---:|---:|---:|---:|---|---:|---:|---:|---:|");
  for (const [type, runs] of [...byAgent].sort((a, b) => b[1].length - a[1].length)) {
    const verdicts = new Map<string, number>();
    for (const r of runs) if (r.verdict) verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
    const vs = [...verdicts].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(", ") || "—";
    const ro = READ_ONLY_AGENTS.has(type);
    const eligible = runs.filter((r) => r.started >= hbSince);
    L.push(`| ${type} | ${runs.length} | ${pct(runs.filter((r) => r.shape === "background").length, runs.length)} | ${pct(eligible.filter((r) => r.handback).length, eligible.length)} | ${runs.filter((r) => r.turns <= 2).length} | ${vs} | ${ro ? `${runs.filter((r) => r.wrote).length}` : "n/a"} | ${runs.filter((r) => r.modelErrors > 0).length} | ${median(runs.map((r) => r.turns))} | ${median(runs.map((r) => r.seconds / 60)).toFixed(1)} |`);
  }
  L.push("");

  // hooks, interruptions
  const guards = new Map<string, number>();
  let interruptions = 0, notifications = 0, handbacks = 0, prompts = 0;
  for (const s of sessions) { for (const [g, n] of Object.entries(s.guardBlocks)) guards.set(g, (guards.get(g) ?? 0) + n); interruptions += s.interruptions; notifications += s.notifications; handbacks += s.handbacks; prompts += s.prompts; }
  const noticeReplies = sessions.reduce((a, s) => a + s.noticeReplies, 0);
  L.push("## Hooks and the human", "", `- Human prompts: ${prompts} · user interruptions: ${interruptions} (${pct(interruptions, prompts)} of prompts) · sub-agent completion notices: ${notifications} · hand-backs: ${handbacks} · orchestrator turns that only acknowledge a notice ("already folded in above", "standing by"): ${noticeReplies}`);
  L.push(`- Stop-guard blocks by hook: ${[...guards].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(", ") || "none"}`, "");

  // errors
  const errors = new Map<string, number>();
  for (const s of sessions) for (const [k, n] of Object.entries(s.errors)) errors.set(k, (errors.get(k) ?? 0) + n);
  L.push("## Recurring tool errors (first line, numbers and paths blanked)", "", "| count | error |", "|---:|---|");
  for (const [k, n] of [...errors].sort((a, b) => b[1] - a[1]).slice(0, 15)) L.push(`| ${n} | ${k.replace(/\|/g, "\\|")} |`);
  L.push("");

  // per-session outliers
  L.push("## Sessions worth reading", "", "| project | session | prompts | assistant turns | skills | spawns | guard blocks | interruptions |", "|---|---|---:|---:|---:|---:|---:|---:|");
  for (const s of [...sessions].sort((a, b) => b.assistantTurns - a.assistantTurns).slice(0, 10)) {
    L.push(`| ${s.project} | ${s.session.slice(0, 8)} | ${s.prompts} | ${s.assistantTurns} | ${s.skills.length} | ${s.spawns.length} | ${Object.values(s.guardBlocks).reduce((a, b) => a + b, 0)} | ${s.interruptions} |`);
  }
  return L.join("\n");
}

if (import.meta.main) {
  const o = parseArgs(process.argv.slice(2));
  const root = join(homedir(), ".claude", "projects");
  const sessions: SessionStats[] = [];
  const agents: AgentRun[] = [];
  for (const proj of readdirSync(root)) {
    if (o.project && !proj.includes(o.project)) continue;
    // the eval runner's sandboxes leave transcripts too; they are benchmark runs, not work
    if (/-tmp-rs-(eval|live|grader)-|eval-plugin-/.test(proj)) continue;
    const dir = join(root, proj);
    if (!statSync(dir).isDirectory()) continue;
    const project = proj.replace(/^-/, "").split("-").slice(-1)[0] || proj;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      const s = analyzeSession(join(dir, f), project, o.since);
      if (!s) continue;
      if (!s.skills.length && !s.spawns.length) continue; // no studio trace in this session
      sessions.push(s);
      const sub = join(dir, basename(f, ".jsonl"), "subagents");
      if (existsSync(sub)) for (const g of readdirSync(sub)) if (g.endsWith(".jsonl")) { const a = analyzeAgent(join(sub, g), s.session, project); if (a) agents.push(a); }
    }
  }
  if (o.json) console.log(JSON.stringify({ sessions, agents }, null, 1));
  else console.log(report(sessions, agents));
}
