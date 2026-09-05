#!/usr/bin/env bun
// Rust Code Studio — in-repo eval runner over the headless Claude Code CLI.
//
// `claude plugin eval` is the host's runner for evals/, and it is early access: on an account
// without it the command prints a notice and scores nothing. This runner executes the same
// cases — and the benchmarks/ fixtures behind /eval-agents, and the live build tasks under
// benchmarks/live/ — with `claude -p --plugin-dir`, so the studio's prompts can be measured on
// any account that can run Claude Code at all. It is a measurement tool for the plugin's own
// source (skills, agents, rules), not for user code.
//
//   bun tools/eval-runner.ts                         # every evals/*/ case, one run each
//   bun tools/eval-runner.ts --case simplify-spaghetti --case routing-start
//   bun tools/eval-runner.ts --runs 3                # three runs per case: min / mean / max
//   bun tools/eval-runner.ts --fixtures              # every benchmarks/fixtures/*/*/ via its agent
//   bun tools/eval-runner.ts --fixture api/leaky-surface
//   bun tools/eval-runner.ts --live                  # every benchmarks/live/*/ build task
//   bun tools/eval-runner.ts --live-task refactor-spaghetti
//   bun tools/eval-runner.ts --parallel 4 --budget 4 --grader-model claude-sonnet-5
//   bun tools/eval-runner.ts --threshold 0.8 --total-budget 15   # CI shape: exit 1 below the bar
//   bun tools/eval-runner.ts --dry-run               # list what would run, spend nothing
//
// Mechanics. Each eval case runs in an EMPTY temp cwd (the case inlines its source, exactly as
// plugin eval's sandbox does), with the case's `allowed_tools` and `max_turns`, the plugin
// loaded, and a fresh session id so nothing rides on the calling session. A case may carry
// `follow-ups.md` — `---`-separated user replies sent in order with `--resume`, so a skill whose
// first phase asks questions is scored on what it does with the answers. The stream-json output
// yields the tool calls (for `tool_used` graders and to see which skill / sub-agent actually
// fired) and the final message (for `regex` and `llm` graders).
//
// Fixture runs copy the fixture's source into the temp cwd and ask the session to spawn the
// mapped `rust-studio:<agent>` on it with the audit prompt the ground truth names, then score the
// agent's reply against the ground truth with an LLM grader that sees both.
//
// Live tasks are real crates: `benchmarks/live/<name>/crate/` is copied, committed as the
// baseline, the task in `task.md` is handed to the named agent (spawned) or skill (invoked by
// slash command) with a shell available, and `check.sh` runs afterwards in the crate with the
// fixture dir in `LIVE_DIR` — its exit code is the score, its output the evidence. That is how
// the writing agents (`rust-builder`, `rust-build-resolver`) and the orchestrating skills are
// measured; a read-only fixture cannot.
//
// Graders run without the plugin, in an empty cwd, so no CLAUDE.md or hook can shape a score.
// Results land under evals/results/<stamp>/ (gitignored): one JSON per run, plus summary.md and
// summary.json. Spend is capped per run with --budget (USD) and reported per run and in total.

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

interface Options {
  cases: string[];
  fixtures: string[];
  allFixtures: boolean;
  liveTasks: string[];
  allLive: boolean;
  parallel: number;
  budget: number;
  model?: string;
  graderModel: string;
  out: string;
  dryRun: boolean;
  timeoutScale: number;
  /** Runs per case / fixture / live task. Omitted: one run (the case's own `runs` is advisory). */
  runs?: number;
  /** Mean eval-case score below which the process exits 1 (plugin eval's --threshold). */
  threshold?: number;
  /** Stop launching new runs once cumulative spend passes this (plugin eval's --max-cost-usd);
   *  runs already in flight finish, the rest are reported as skipped. */
  totalBudget?: number;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    cases: [],
    fixtures: [],
    allFixtures: false,
    liveTasks: [],
    allLive: false,
    parallel: 3,
    budget: 4,
    graderModel: "claude-sonnet-5",
    out: join(PLUGIN_ROOT, "evals", "results", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)),
    dryRun: false,
    timeoutScale: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--case") o.cases.push(next());
    else if (a === "--fixture") o.fixtures.push(next());
    else if (a === "--fixtures") o.allFixtures = true;
    else if (a === "--live-task") o.liveTasks.push(next());
    else if (a === "--live") o.allLive = true;
    else if (a === "--parallel") o.parallel = Number(next());
    else if (a === "--budget") o.budget = Number(next());
    else if (a === "--model") o.model = next();
    else if (a === "--grader-model") o.graderModel = next();
    else if (a === "--out") o.out = resolve(next());
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--timeout-scale") o.timeoutScale = Number(next());
    else if (a === "--runs") o.runs = Math.max(1, Number(next()));
    else if (a === "--threshold") o.threshold = Number(next());
    else if (a === "--total-budget") o.totalBudget = Number(next());
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 22).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

// ---------------------------------------------------------------------------------------------
// Frontmatter + graders
// ---------------------------------------------------------------------------------------------

export function splitFrontmatter(text: string): { fm: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { fm: {}, body: text };
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

/** `[Read, Glob, Grep]` or `Read, Glob` → ["Read","Glob","Grep"]. */
export function parseList(v: string | undefined): string[] {
  if (!v) return [];
  return v.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

/** `follow-ups.md`: user replies separated by lines containing only `---`. */
export function parseFollowUps(text: string): string[] {
  return text.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
}

export interface Grader {
  file: string;
  type: string;
  weight: number;
  fm: Record<string, string>;
  body: string;
}

export function loadGraders(dir: string): Grader[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const { fm, body } = splitFrontmatter(readFileSync(join(dir, f), "utf8"));
      return { file: f, type: fm.type ?? "missing", weight: Number(fm.weight ?? 1) || 1, fm, body: body.trim() };
    });
}

export interface RunTrace {
  lastMessage: string;
  /** Multi-turn cases only: every assistant turn with the scripted user replies between them. */
  transcript?: string;
  toolsUsed: string[]; // tool names in order
  skills: string[]; // Skill tool `skill` inputs
  agents: string[]; // Agent tool `subagent_type` inputs
  costUsd: number;
  turns: number;
  durationMs: number;
  isError: boolean;
  subtype: string;
  stderrTail: string;
}

/** Parse a stream-json transcript into the facts graders need. Tolerant: an unknown line is
 *  skipped, a missing result leaves lastMessage on the last assistant text seen. */
export function parseStream(raw: string): RunTrace {
  const t: RunTrace = { lastMessage: "", toolsUsed: [], skills: [], agents: [], costUsd: 0, turns: 0, durationMs: 0, isError: false, subtype: "", stderrTail: "" };
  let lastAssistantText = "";
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s.startsWith("{")) continue;
    let o: any;
    try {
      o = JSON.parse(s);
    } catch {
      continue;
    }
    if (o.type === "assistant") {
      const blocks = o.message?.content ?? [];
      const texts: string[] = [];
      for (const b of blocks) {
        if (b?.type === "tool_use") {
          t.toolsUsed.push(String(b.name));
          if (b.name === "Skill" && b.input?.skill) t.skills.push(String(b.input.skill));
          if (b.name === "Agent" && b.input?.subagent_type) t.agents.push(String(b.input.subagent_type));
        } else if (b?.type === "text" && typeof b.text === "string") texts.push(b.text);
      }
      if (texts.length) lastAssistantText = texts.join("\n");
    } else if (o.type === "result") {
      t.costUsd = Number(o.total_cost_usd ?? 0);
      t.turns = Number(o.num_turns ?? 0);
      t.durationMs = Number(o.duration_ms ?? 0);
      t.isError = Boolean(o.is_error);
      t.subtype = String(o.subtype ?? "");
      if (typeof o.result === "string" && o.result.trim()) t.lastMessage = o.result;
    }
  }
  if (!t.lastMessage) t.lastMessage = lastAssistantText;
  return t;
}

/** Fold a follow-up turn's trace into the conversation's trace: tools accumulate, the last
 *  message is the latest turn's, cost and turns add up. */
export function mergeTraces(a: RunTrace, b: RunTrace): RunTrace {
  return {
    lastMessage: b.lastMessage || a.lastMessage,
    toolsUsed: [...a.toolsUsed, ...b.toolsUsed],
    skills: [...a.skills, ...b.skills],
    agents: [...a.agents, ...b.agents],
    costUsd: a.costUsd + b.costUsd,
    turns: a.turns + b.turns,
    durationMs: a.durationMs + b.durationMs,
    isError: a.isError || b.isError,
    subtype: b.isError ? b.subtype : a.isError ? a.subtype : b.subtype || a.subtype,
    stderrTail: b.stderrTail || a.stderrTail,
  };
}

export interface GraderResult {
  file: string;
  type: string;
  weight: number;
  score: number | null; // 0..1, null = not applicable
  detail: string;
}

export function gradeRegex(g: Grader, trace: RunTrace): GraderResult {
  const flags = g.fm.flags ?? "";
  let re: RegExp;
  try {
    re = new RegExp(g.body, flags.includes("i") ? "i" : "");
  } catch (e) {
    return { file: g.file, type: g.type, weight: g.weight, score: null, detail: `bad regex: ${e}` };
  }
  const hit = re.test(trace.lastMessage);
  const wantAbsent = (g.fm.match ?? "contains") === "not_contains";
  const pass = wantAbsent ? !hit : hit;
  return { file: g.file, type: g.type, weight: g.weight, score: pass ? 1 : 0, detail: `${wantAbsent ? "must not match" : "must match"} /${g.body.slice(0, 60)}/ → ${hit ? "matched" : "no match"}` };
}

export function gradeToolUsed(g: Grader, trace: RunTrace): GraderResult {
  const tool = g.fm.tool;
  const used = trace.toolsUsed.includes(tool);
  const extra = tool === "Skill" ? ` skills=${JSON.stringify(trace.skills)}` : tool === "Agent" ? ` agents=${JSON.stringify(trace.agents)}` : "";
  return { file: g.file, type: g.type, weight: g.weight, score: used ? 1 : 0, detail: `${tool} ${used ? "used" : "not used"}${extra}` };
}

export function gradeFileExists(g: Grader, cwd: string): GraderResult {
  const want = (g.fm.exists ?? "true") !== "false";
  const pattern = (g.fm.path ?? "").replace(/^["']|["']$/g, "");
  const found = [...new Bun.Glob(pattern).scanSync({ cwd, dot: true })];
  const pass = want ? found.length > 0 : found.length === 0;
  return { file: g.file, type: g.type, weight: g.weight, score: pass ? 1 : 0, detail: `${pattern}: ${found.length} match(es), wanted ${want ? "some" : "none"}` };
}

// ---------------------------------------------------------------------------------------------
// Running claude
// ---------------------------------------------------------------------------------------------

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v == null) continue;
    // Never let a run attach to the session that launched the runner.
    if (k === "CLAUDE_CODE_SESSION_ID" || k === "CLAUDE_CODE_CHILD_SESSION" || k === "CLAUDE_CODE_MESSAGING_SOCKET") continue;
    env[k] = v;
  }
  return env;
}

async function runProcess(cmd: string[], cwd: string, timeoutMs: number, env: Record<string, string> = cleanEnv()): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  const proc = Bun.spawn(cmd, { cwd, env, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill();
    } catch {
      /* already gone */
    }
  }, timeoutMs);
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  clearTimeout(timer);
  return { stdout, stderr, code, timedOut };
}

interface SessionRunArgs {
  prompt: string;
  cwd: string;
  allowedTools: string[];
  maxTurns: number;
  timeoutSec: number;
  budgetUsd: number;
  model?: string;
  withPlugin: boolean;
  sessionId: string;
  resume?: boolean;
}

async function runSession(a: SessionRunArgs): Promise<RunTrace & { raw: string }> {
  const args = ["-p", a.prompt, "--output-format", "stream-json", "--verbose", "--max-turns", String(a.maxTurns), "--max-budget-usd", String(a.budgetUsd)];
  args.push(a.resume ? "--resume" : "--session-id", a.sessionId);
  if (a.withPlugin) args.push("--plugin-dir", PLUGIN_ROOT);
  if (a.allowedTools.length) args.push("--allowedTools", ...a.allowedTools);
  if (a.model) args.push("--model", a.model);
  const r = await runProcess(["claude", ...args], a.cwd, a.timeoutSec * 1000);
  const trace = parseStream(r.stdout);
  trace.stderrTail = r.stderr.slice(-2000);
  if (r.timedOut) {
    trace.isError = true;
    trace.subtype = trace.subtype || "timeout";
  }
  return { ...trace, raw: r.stdout };
}

/** A conversation: the opening prompt, then each follow-up on the same session. */
async function runConversation(a: Omit<SessionRunArgs, "sessionId" | "resume">, followUps: string[]): Promise<RunTrace & { raw: string }> {
  const sessionId = crypto.randomUUID();
  let acc = await runSession({ ...a, sessionId });
  let raw = acc.raw;
  // A multi-turn case is graded on the whole exchange, not on its last turn alone: the
  // questions a design skill asks live in turn 1, the drafted surface in turn 3.
  const transcript: string[] = [`[assistant, turn 1]\n${acc.lastMessage}`];
  for (const [i, reply] of followUps.entries()) {
    if (acc.isError) break;
    const next = await runSession({ ...a, prompt: reply, sessionId, resume: true });
    raw += "\n" + next.raw;
    transcript.push(`[user, scripted reply ${i + 1}]\n${reply}`, `[assistant, turn ${i + 2}]\n${next.lastMessage}`);
    acc = { ...mergeTraces(acc, next), raw };
  }
  return { ...acc, raw, transcript: followUps.length ? transcript.join("\n\n") : undefined };
}

const GRADER_SYSTEM =
  "You are a strict, literal grader for an evaluation of a coding agent. You receive a rubric and the agent's final response. " +
  "Judge only what the response actually says — never infer good intent, never give credit for a defect the response did not name, " +
  "and treat an approving verdict as approving regardless of caveats. Line numbers in the rubric refer to the code the agent was shown; " +
  "accept a finding anchored within two lines. Reply with ONLY a JSON object, no prose, no code fence.";

async function llmJson(prompt: string, graderModel: string, timeoutMs = 240_000): Promise<any> {
  const cwd = mkdtempSync(join(tmpdir(), "rs-grader-"));
  try {
    const r = await runProcess(["claude", "-p", prompt, "--output-format", "json", "--max-turns", "1", "--model", graderModel, "--append-system-prompt", GRADER_SYSTEM, "--session-id", crypto.randomUUID(), "--allowedTools", "NoSuchTool"], cwd, timeoutMs);
    let text = "";
    try {
      text = String(JSON.parse(r.stdout).result ?? "");
    } catch {
      text = r.stdout;
    }
    const m = /\{[\s\S]*\}/.exec(text);
    if (!m) return { error: `no JSON in grader reply: ${text.slice(0, 300)}` };
    try {
      return JSON.parse(m[0]);
    } catch (e) {
      return { error: `grader JSON unparsable: ${e}` };
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

async function gradeLlm(g: Grader, trace: RunTrace, graderModel: string): Promise<GraderResult> {
  const prompt =
    `RUBRIC:\n${g.body}\n\nAGENT RESPONSE (${trace.transcript ? "multi-turn transcript; the user's replies were scripted, judge the assistant turns together" : "final message"}):\n<<<\n${(trace.transcript ?? trace.lastMessage).slice(0, 60_000)}\n>>>\n\n` +
    `Score the response against the rubric. Return {"score": <1 for full credit, 0.5 for partial, 0 for fail>, "verdict": "PASS"|"PARTIAL"|"FAIL", "reason": "<one or two sentences naming which rubric items were met and which were missed>"}.`;
  const j = await llmJson(prompt, graderModel);
  if (j?.error) return { file: g.file, type: g.type, weight: g.weight, score: null, detail: j.error };
  const score = typeof j.score === "number" ? Math.max(0, Math.min(1, j.score)) : j.verdict === "PASS" ? 1 : j.verdict === "PARTIAL" ? 0.5 : 0;
  return { file: g.file, type: g.type, weight: g.weight, score, detail: `${j.verdict ?? "?"}: ${j.reason ?? ""}` };
}

// ---------------------------------------------------------------------------------------------
// Eval cases
// ---------------------------------------------------------------------------------------------

type Trace = Omit<RunTrace, "stderrTail"> & { stderrTail?: string };

interface CaseResult {
  kind: "eval";
  name: string;
  run: number;
  score: number | null;
  graders: GraderResult[];
  followUps: number;
  trace: Trace;
}

async function runCase(name: string, run: number, o: Options): Promise<CaseResult> {
  const dir = join(PLUGIN_ROOT, "evals", name);
  const { fm, body } = splitFrontmatter(readFileSync(join(dir, "prompt.md"), "utf8"));
  const graders = loadGraders(join(dir, "graders"));
  const followUpsFile = join(dir, "follow-ups.md");
  const followUps = existsSync(followUpsFile) ? parseFollowUps(readFileSync(followUpsFile, "utf8")) : [];
  const cwd = mkdtempSync(join(tmpdir(), `rs-eval-${name}-`));
  try {
    const trace = await runConversation(
      {
        prompt: body.trim(),
        cwd,
        allowedTools: parseList(fm.allowed_tools),
        maxTurns: Number(fm.max_turns ?? 15),
        timeoutSec: Number(fm.timeout_seconds ?? 600) * o.timeoutScale,
        budgetUsd: o.budget,
        model: o.model,
        withPlugin: true,
      },
      followUps,
    );
    const results: GraderResult[] = [];
    for (const g of graders) {
      if (g.type === "regex") results.push(gradeRegex(g, trace));
      else if (g.type === "tool_used") results.push(gradeToolUsed(g, trace));
      else if (g.type === "file_exists") results.push(gradeFileExists(g, cwd));
      else if (g.type === "llm") results.push(await gradeLlm(g, trace, o.graderModel));
      else results.push({ file: g.file, type: g.type, weight: g.weight, score: null, detail: "not supported by this runner" });
    }
    const scored = results.filter((r) => r.score != null);
    const wsum = scored.reduce((a, r) => a + r.weight, 0);
    const score = wsum ? scored.reduce((a, r) => a + (r.score as number) * r.weight, 0) / wsum : null;
    const { raw, ...rest } = trace;
    writeFileSync(join(o.out, `${name}.run${run}.stream.jsonl`), raw);
    return { kind: "eval", name, run, score, graders: results, followUps: followUps.length, trace: rest };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Fixtures (the /eval-agents protocol, automated)
// ---------------------------------------------------------------------------------------------

/** Folder → agent under test. Mirrors skills/eval-agents/SKILL.md; keep the two in step. */
export const FIXTURE_AGENTS: Record<string, string> = {
  reviewer: "rust-reviewer",
  integrity: "rust-reviewer",
  naming: "rust-reviewer",
  lifetimes: "rust-reviewer",
  "modern-rust": "rust-reviewer",
  unsafe: "unsafe-auditor",
  security: "security-auditor",
  perf: "perf-engineer",
  api: "api-design-lead",
  architecture: "chief-architect",
  workspace: "chief-architect",
  "active-dev": "chief-architect",
  "prior-art": "chief-architect",
  async: "async-runtime-specialist",
  "error-model": "error-architect",
  testing: "qa-lead",
  cli: "cli-ux-lead",
  ffi: "ffi-specialist",
  macros: "macro-specialist",
  observability: "observability-engineer",
  "cargo-manifest": "dependency-manager",
  database: "database-specialist",
  "build-scripts": "build-engineer",
  embedded: "embedded-specialist",
  wasm: "wasm-specialist",
  scout: "rust-scout",
  docs: "docs-engineer",
  release: "release-lead",
};

/** The audit prompt a ground truth is calibrated for, when it states one. Two shapes are in
 *  use: a blockquoted `> This crate's house rule…` paragraph after "calibrated for", and an
 *  inline `*"…"*` after "Audit prompt the fixture is calibrated for:". */
export function auditPrompt(groundTruth: string): string | null {
  const inline = /calibrated for:\s*\*"([\s\S]*?)"\*/i.exec(groundTruth);
  if (inline) return inline[1].replace(/\s*\n>\s*/g, " ").replace(/\s+/g, " ").trim();
  const quoted = /calibrated for:\s*\n(?:>\s*\n)?((?:>.*\n?)+)/i.exec(groundTruth);
  if (quoted) return quoted[1].split("\n").map((l) => l.replace(/^>\s?/, "")).join(" ").replace(/\s+/g, " ").trim();
  return null;
}

export function fixtureMode(groundTruth: string): "first-pass" | "defect-recall" | "map-recall" {
  const title = groundTruth.split("\n")[0];
  if (/mode:\s*map-recall/i.test(title)) return "map-recall";
  return /verdict:\s*(RESHAPE NEEDED|REDO-TO-BAR)/i.test(title) ? "first-pass" : "defect-recall";
}

export function gtIds(groundTruth: string): string[] {
  return [...new Set([...groundTruth.matchAll(/^\|\s*(GT-\d+)\s*\|/gm)].map((m) => m[1]))];
}

interface FixtureResult {
  kind: "fixture";
  name: string;
  run: number;
  agent: string;
  mode: string;
  spawned: boolean;
  recall: number | null;
  caught: string[];
  missed: string[];
  verdictOk: boolean | null;
  falsePositives: number | null;
  notes: string;
  trace: Trace;
}

async function runFixture(rel: string, run: number, o: Options): Promise<FixtureResult> {
  const dir = join(PLUGIN_ROOT, "benchmarks", "fixtures", rel);
  const folder = rel.split("/")[0];
  const agent = FIXTURE_AGENTS[folder];
  if (!agent) throw new Error(`no agent mapping for fixture folder ${folder}`);
  const gt = readFileSync(join(dir, "ground-truth.md"), "utf8");
  const mode = fixtureMode(gt);
  const ids = gtIds(gt);
  const cwd = mkdtempSync(join(tmpdir(), `rs-fx-${rel.replace(/\//g, "_")}-`));
  try {
    // A single-file fixture ships `input.rs`; a crate or workspace fixture ships everything
    // else (Cargo.toml, src/, tests/, README, scripts). Copy all of it except the answer key.
    const multi = !existsSync(join(dir, "input.rs"));
    let target: string;
    if (multi) {
      for (const entry of readdirSync(dir)) {
        if (entry === "ground-truth.md") continue;
        cpSync(join(dir, entry), join(cwd, entry), { recursive: true });
      }
      target = existsSync(join(dir, "Cargo.toml")) ? "." : "src/";
    } else {
      cpSync(join(dir, "input.rs"), join(cwd, "input.rs"));
      target = "input.rs";
    }
    const task =
      auditPrompt(gt) ??
      (mode === "first-pass"
        ? "Apply the pre-code maintainer gate to this code: what would a strict maintainer of a serious Rust crate reject about its shape? List every finding with file:line and severity, then end with ACCEPTABLE / RESHAPE NEEDED (or REDO-TO-BAR)."
        : mode === "map-recall"
          ? "Map this code: definitions, implementors, callers, and tests. Return the file:line table."
          : "Review this Rust code as the final gate before merge. List every real defect with file:line, severity, and the fix direction; end with a verdict.");
    const prompt =
      `Spawn the \`rust-studio:${agent}\` sub-agent (Agent tool, subagent_type \`rust-studio:${agent}\`) on ${target === "." ? "the crate/workspace rooted in this directory" : `\`${target}\` in this directory`} with exactly this task:\n\n` +
      `"${task}"\n\n` +
      `Tell it to read the code itself and to answer in its own native output format. When it returns, reply with the sub-agent's complete findings and verdict verbatim — add nothing, summarize nothing, and do not review the code yourself.`;
    const trace = await runConversation({ prompt, cwd, allowedTools: ["Read", "Glob", "Grep", "Agent"], maxTurns: 12, timeoutSec: 900 * o.timeoutScale, budgetUsd: o.budget, model: o.model, withPlugin: true }, []);
    const spawned = trace.agents.some((a) => a.endsWith(agent));
    const passRule =
      mode === "first-pass"
        ? " (it must reject the shape: RESHAPE NEEDED / REDO-TO-BAR / NEEDS WORK naming the shape; ACCEPTABLE or a wave-through fails)"
        : mode === "map-recall"
          ? " (a map is complete when every row is present with a correct file and a line within two of the ground truth; a verdict token is not required)"
          : "";
    const gradePrompt =
      `GROUND TRUTH (the planted defects or expected rows; the agent under test never saw this file):\n${gt}\n\n` +
      `AGENT RESPONSE:\n<<<\n${trace.lastMessage.slice(0, 60_000)}\n>>>\n\n` +
      `For every GT-n row decide whether the response caught it — same item at the same code location (within two lines), matched on substance not wording. ` +
      `Then decide whether the response's verdict satisfies the ground truth's Pass condition${passRule}, ` +
      `and whether any "Automatic fail" condition in the ground truth is triggered. Count findings with no ground-truth row as false positives only when they are wrong or noise, not when they are real additional defects. ` +
      `Return {"caught": ["GT-1", …], "missed": ["GT-…"], "verdict_ok": true|false, "auto_fail": true|false, "false_positives": <n>, "notes": "<one or two sentences: what was missed and why the verdict passed or failed>"}.`;
    const j = await llmJson(gradePrompt, o.graderModel);
    const { raw, ...rest } = trace;
    writeFileSync(join(o.out, `fixture__${rel.replace(/\//g, "__")}.run${run}.stream.jsonl`), raw);
    if (j?.error) return { kind: "fixture", name: rel, run, agent, mode, spawned, recall: null, caught: [], missed: ids, verdictOk: null, falsePositives: null, notes: j.error, trace: rest };
    const caught: string[] = Array.isArray(j.caught) ? j.caught.filter((x: unknown) => typeof x === "string") : [];
    const missed = ids.filter((id) => !caught.includes(id));
    const autoFail = Boolean(j.auto_fail);
    return {
      kind: "fixture",
      name: rel,
      run,
      agent,
      mode,
      spawned,
      recall: ids.length ? caught.filter((c) => ids.includes(c)).length / ids.length : null,
      caught,
      missed,
      verdictOk: autoFail ? false : typeof j.verdict_ok === "boolean" ? j.verdict_ok : null,
      falsePositives: typeof j.false_positives === "number" ? j.false_positives : null,
      notes: String(j.notes ?? ""),
      trace: rest,
    };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Live tasks (the writing agents and orchestrating skills, on a real crate)
// ---------------------------------------------------------------------------------------------

interface LiveResult {
  kind: "live";
  name: string;
  run: number;
  target: string;
  targetKind: string;
  passed: boolean | null;
  checkExit: number | null;
  checkOutput: string;
  verdictPresent: boolean;
  trace: Trace;
}

export const VERDICT_TOKEN = /\b(COMPLETE|NEEDS\s+WORK|REDO-TO-BAR|BLOCKED|ACCEPTABLE|RESHAPE\s+NEEDED)\b/;

async function runLive(name: string, run: number, o: Options): Promise<LiveResult> {
  const dir = join(PLUGIN_ROOT, "benchmarks", "live", name);
  const { fm, body } = splitFrontmatter(readFileSync(join(dir, "task.md"), "utf8"));
  const targetKind = fm.kind ?? "agent";
  const target = fm.target;
  if (!target) throw new Error(`benchmarks/live/${name}/task.md has no target`);
  const cwd = mkdtempSync(join(tmpdir(), `rs-live-${name}-`));
  try {
    cpSync(join(dir, "crate"), cwd, { recursive: true });
    for (const cmd of [["git", "init", "-q"], ["git", "add", "-A"], ["git", "-c", "user.name=live", "-c", "user.email=live@example.invalid", "commit", "-q", "-m", "baseline"]]) {
      const r = await runProcess(cmd, cwd, 30_000);
      if (r.code !== 0) throw new Error(`${cmd.join(" ")} failed: ${r.stderr}`);
    }
    const task = body.trim();
    const prompt =
      targetKind === "skill"
        ? `/rust-studio:${target} ${task}`
        : `Spawn the \`rust-studio:${target}\` sub-agent (Agent tool, subagent_type \`rust-studio:${target}\`) in this repository with exactly this task, and let it do the work itself:\n\n${task}\n\nWhen it returns, reply with its complete report and verdict verbatim — add nothing, and do not redo or "improve" its work.`;
    const trace = await runConversation(
      {
        prompt,
        cwd,
        allowedTools: parseList(fm.allowed_tools).length ? parseList(fm.allowed_tools) : ["Read", "Edit", "Write", "Glob", "Grep", "Bash", "Agent", "Skill"],
        maxTurns: Number(fm.max_turns ?? 40),
        timeoutSec: Number(fm.timeout_seconds ?? 1500) * o.timeoutScale,
        budgetUsd: o.budget,
        model: o.model,
        withPlugin: true,
      },
      [],
    );
    const { raw, ...rest } = trace;
    writeFileSync(join(o.out, `live__${name}.run${run}.stream.jsonl`), raw);
    const check = await runProcess(["bash", join(dir, "check.sh")], cwd, 600_000, { ...cleanEnv(), LIVE_DIR: dir });
    const checkOutput = (check.stdout + (check.stderr ? "\n[stderr]\n" + check.stderr : "")).slice(-6000);
    return { kind: "live", name, run, target, targetKind, passed: check.timedOut ? null : check.code === 0, checkExit: check.code, checkOutput, verdictPresent: VERDICT_TOKEN.test(trace.lastMessage), trace: rest };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Orchestration + report
// ---------------------------------------------------------------------------------------------

function listCases(): string[] {
  const dir = join(PLUGIN_ROOT, "evals");
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, "prompt.md"))).sort();
}

function listFixtures(): string[] {
  const root = join(PLUGIN_ROOT, "benchmarks", "fixtures");
  const out: string[] = [];
  for (const folder of readdirSync(root).sort()) {
    const fdir = join(root, folder);
    if (!statSync(fdir).isDirectory()) continue;
    for (const c of readdirSync(fdir).sort()) {
      if (existsSync(join(fdir, c, "ground-truth.md"))) out.push(`${folder}/${c}`);
    }
  }
  return out;
}

function listLive(): string[] {
  const root = join(PLUGIN_ROOT, "benchmarks", "live");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((d) => existsSync(join(root, d, "task.md")) && existsSync(join(root, d, "check.sh")))
    .sort();
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>, stop: () => boolean = () => false): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (next < items.length && !stop()) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function pct(x: number | null | undefined): string {
  return x == null ? "n/a" : `${Math.round(x * 100)}%`;
}

function stats(xs: number[]): { mean: number | null; min: number | null; max: number | null } {
  if (!xs.length) return { mean: null, min: null, max: null };
  return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs) };
}

function groupBy<T extends { name: string }>(items: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) m.set(it.name, [...(m.get(it.name) ?? []), it]);
  return m;
}

export function renderSummary(cases: CaseResult[], fixtures: FixtureResult[], live: LiveResult[], graderModel: string, runs: number): string {
  const lines: string[] = [];
  lines.push(`# Eval run — ${new Date().toISOString()}`, "");
  const cost = [...cases, ...fixtures, ...live].reduce((a, r) => a + (r.trace.costUsd || 0), 0);
  lines.push(`Grader: \`${graderModel}\`. Runs per item: ${runs}. Total spend: $${cost.toFixed(2)} across ${cases.length} eval run(s), ${fixtures.length} fixture run(s), ${live.length} live run(s).`, "");
  if (cases.length) {
    const byCase = groupBy(cases);
    lines.push("## Eval cases", "", `| case | mean | min | max | studio path fired | cost |`, "|---|---|---|---|---|---|");
    for (const [name, rs] of [...byCase.entries()].sort()) {
      const s = stats(rs.map((r) => r.score).filter((x): x is number => x != null));
      const fired = [...new Set(rs.flatMap((r) => [...r.trace.skills.map((k) => `/${k.replace(/^rust-studio:/, "")}`), ...r.trace.agents.map((a) => a.replace(/^rust-studio:/, ""))]))].join(", ") || "—";
      const err = rs.filter((r) => r.trace.isError).map((r) => r.trace.subtype);
      lines.push(`| ${name} | ${pct(s.mean)} | ${pct(s.min)} | ${pct(s.max)} | ${fired} | $${rs.reduce((a, r) => a + r.trace.costUsd, 0).toFixed(2)}${err.length ? ` ⚠ ${err.join(",")}` : ""} |`);
    }
    lines.push("");
    for (const [name, rs] of [...byCase.entries()].sort()) {
      const low = rs.flatMap((r) => r.graders.filter((g) => g.score != null && (g.score as number) < 1).map((g) => ({ run: r.run, g })));
      if (low.length) lines.push(`### ${name}`, ...low.map(({ run, g }) => `- run ${run} **${g.file}** (${g.type}, w${g.weight}) → ${g.score}: ${g.detail}`), "");
    }
  }
  if (fixtures.length) {
    const byFx = groupBy(fixtures);
    lines.push("## Fixtures (agent under test)", "", "| fixture | agent | mode | spawned | recall mean | recall min | verdict ok | cost |", "|---|---|---|---|---|---|---|---|");
    for (const [name, rs] of [...byFx.entries()].sort()) {
      const s = stats(rs.map((r) => r.recall).filter((x): x is number => x != null));
      const vok = rs.filter((r) => r.verdictOk === true).length;
      lines.push(`| ${name} | ${rs[0].agent} | ${rs[0].mode} | ${rs.every((r) => r.spawned) ? "✓" : "✗"} | ${pct(s.mean)} | ${pct(s.min)} | ${vok}/${rs.length} | $${rs.reduce((a, r) => a + r.trace.costUsd, 0).toFixed(2)} |`);
    }
    lines.push("");
    const byAgent = new Map<string, { hits: number; total: number; verdictFails: number; n: number }>();
    for (const f of fixtures) {
      const e = byAgent.get(f.agent) ?? { hits: 0, total: 0, verdictFails: 0, n: 0 };
      e.hits += f.caught.filter((c) => !f.missed.includes(c)).length;
      e.total += f.caught.length + f.missed.length;
      e.n += 1;
      if (f.verdictOk === false) e.verdictFails += 1;
      byAgent.set(f.agent, e);
    }
    lines.push("### Per agent", "", "| agent | fixture runs | recall (rows) | verdict failures |", "|---|---|---|---|");
    for (const [agent, e] of [...byAgent.entries()].sort()) lines.push(`| ${agent} | ${e.n} | ${e.hits}/${e.total} (${e.total ? Math.round((100 * e.hits) / e.total) : 0}%) | ${e.verdictFails} |`);
    lines.push("");
    for (const f of fixtures) {
      if (f.missed.length || f.verdictOk === false || !f.spawned) {
        lines.push(`### ${f.name} (run ${f.run})`, `- spawned ${f.agent}: ${f.spawned ? "yes" : "NO — the session answered itself"}`, `- missed: ${f.missed.join(", ") || "none"}`, `- notes: ${f.notes}`, "");
      }
    }
  }
  if (live.length) {
    lines.push("## Live tasks (real crates)", "", "| task | target | check.sh | verdict in report | turns | cost |", "|---|---|---|---|---|---|");
    for (const l of live) {
      lines.push(`| ${l.name} (run ${l.run}) | ${l.targetKind} ${l.target} | ${l.passed == null ? "timeout" : l.passed ? "PASS" : `FAIL (exit ${l.checkExit})`} | ${l.verdictPresent ? "✓" : "✗"} | ${l.trace.turns} | $${l.trace.costUsd.toFixed(2)}${l.trace.isError ? ` ⚠ ${l.trace.subtype}` : ""} |`);
    }
    lines.push("");
    for (const l of live) lines.push(`### ${l.name} (run ${l.run}) — check.sh`, "```", l.checkOutput.trim(), "```", "");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const o = parseArgs(process.argv.slice(2));
  const explicit = o.cases.length || o.fixtures.length || o.liveTasks.length || o.allFixtures || o.allLive;
  const cases = o.cases.length ? o.cases : explicit ? [] : listCases();
  const fixtures = o.allFixtures ? listFixtures() : o.fixtures;
  const live = o.allLive ? listLive() : o.liveTasks;
  for (const c of cases) if (!existsSync(join(PLUGIN_ROOT, "evals", c, "prompt.md"))) throw new Error(`no such eval case: ${c}`);
  for (const f of fixtures) if (!existsSync(join(PLUGIN_ROOT, "benchmarks", "fixtures", f, "ground-truth.md"))) throw new Error(`no such fixture: ${f}`);
  for (const l of live) if (!existsSync(join(PLUGIN_ROOT, "benchmarks", "live", l, "task.md"))) throw new Error(`no such live task: ${l}`);
  const runs = o.runs ?? 1;
  if (o.dryRun) {
    console.log(`runs per item: ${runs}`);
    console.log(`would run ${cases.length} case(s): ${cases.join(", ") || "—"}`);
    console.log(`would run ${fixtures.length} fixture(s): ${fixtures.map((f) => `${f} → ${FIXTURE_AGENTS[f.split("/")[0]]}`).join(", ") || "—"}`);
    console.log(`would run ${live.length} live task(s): ${live.join(", ") || "—"}`);
    process.exit(0);
  }
  if (!Bun.which("claude")) throw new Error("claude CLI not on PATH");
  mkdirSync(o.out, { recursive: true });
  const started = Date.now();
  const log = (s: string) => console.error(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${s}`);
  let spent = 0;
  const overBudget = () => o.totalBudget != null && spent >= o.totalBudget;
  const expand = <T>(items: T[]): Array<[T, number]> => items.flatMap((it) => Array.from({ length: runs }, (_, k) => [it, k + 1] as [T, number]));

  const caseRaw = await pool(expand(cases), o.parallel, async ([c, k]) => {
    log(`▶ case ${c} run ${k}`);
    try {
      const r = await runCase(c, k, o);
      spent += r.trace.costUsd;
      writeFileSync(join(o.out, `${c}.run${k}.json`), JSON.stringify(r, null, 2));
      log(`✔ case ${c} run ${k} → ${pct(r.score)} ($${r.trace.costUsd.toFixed(2)}, total $${spent.toFixed(2)})`);
      return r;
    } catch (e) {
      log(`✖ case ${c} run ${k} failed: ${e}`);
      const r: CaseResult = { kind: "eval", name: c, run: k, score: null, graders: [{ file: "runner", type: "error", weight: 1, score: null, detail: String(e) }], followUps: 0, trace: { lastMessage: "", toolsUsed: [], skills: [], agents: [], costUsd: 0, turns: 0, durationMs: 0, isError: true, subtype: "runner-error" } };
      writeFileSync(join(o.out, `${c}.run${k}.json`), JSON.stringify(r, null, 2));
      return r;
    }
  }, overBudget);
  const caseResults = caseRaw.filter((r): r is CaseResult => r != null);
  const skipped: string[] = expand(cases).filter((_, i) => caseRaw[i] == null).map(([c, k]) => `case ${c} run ${k}`);

  const fxRaw = await pool(expand(fixtures), o.parallel, async ([f, k]) => {
    log(`▶ fixture ${f} run ${k}`);
    try {
      const r = await runFixture(f, k, o);
      spent += r.trace.costUsd;
      writeFileSync(join(o.out, `fixture__${f.replace(/\//g, "__")}.run${k}.json`), JSON.stringify(r, null, 2));
      log(`✔ fixture ${f} run ${k} → recall ${pct(r.recall)}, verdict ${r.verdictOk} ($${r.trace.costUsd.toFixed(2)}, total $${spent.toFixed(2)})`);
      return r;
    } catch (e) {
      log(`✖ fixture ${f} run ${k} failed: ${e}`);
      return { kind: "fixture", name: f, run: k, agent: FIXTURE_AGENTS[f.split("/")[0]] ?? "?", mode: "?", spawned: false, recall: null, caught: [], missed: [], verdictOk: null, falsePositives: null, notes: String(e), trace: { lastMessage: "", toolsUsed: [], skills: [], agents: [], costUsd: 0, turns: 0, durationMs: 0, isError: true, subtype: "runner-error" } } as FixtureResult;
    }
  }, overBudget);
  const fixtureResults = fxRaw.filter((r): r is FixtureResult => r != null);
  skipped.push(...expand(fixtures).filter((_, i) => fxRaw[i] == null).map(([f, k]) => `fixture ${f} run ${k}`));

  const liveRaw = await pool(expand(live), Math.min(o.parallel, 2), async ([l, k]) => {
    log(`▶ live ${l} run ${k}`);
    try {
      const r = await runLive(l, k, o);
      spent += r.trace.costUsd;
      writeFileSync(join(o.out, `live__${l}.run${k}.json`), JSON.stringify(r, null, 2));
      log(`✔ live ${l} run ${k} → ${r.passed == null ? "timeout" : r.passed ? "PASS" : "FAIL"} ($${r.trace.costUsd.toFixed(2)}, total $${spent.toFixed(2)})`);
      return r;
    } catch (e) {
      log(`✖ live ${l} run ${k} failed: ${e}`);
      return { kind: "live", name: l, run: k, target: "?", targetKind: "?", passed: null, checkExit: null, checkOutput: String(e), verdictPresent: false, trace: { lastMessage: "", toolsUsed: [], skills: [], agents: [], costUsd: 0, turns: 0, durationMs: 0, isError: true, subtype: "runner-error" } } as LiveResult;
    }
  }, overBudget);
  const liveResults = liveRaw.filter((r): r is LiveResult => r != null);
  skipped.push(...expand(live).filter((_, i) => liveRaw[i] == null).map(([l, k]) => `live ${l} run ${k}`));

  let summary = renderSummary(caseResults, fixtureResults, liveResults, o.graderModel, runs);
  if (skipped.length) summary += `\n## Skipped — total budget $${o.totalBudget} reached\n\n${skipped.map((x) => `- ${x}`).join("\n")}\n`;
  const perCase = [...groupBy(caseResults).values()].map((rs) => stats(rs.map((r) => r.score).filter((x): x is number => x != null)).mean).filter((x): x is number => x != null);
  const mean = perCase.length ? perCase.reduce((a, b) => a + b, 0) / perCase.length : null;
  if (perCase.length) summary += `\nMean eval-case score: **${pct(mean)}** over ${perCase.length} case(s), ${runs} run(s) each${o.threshold != null ? ` (threshold ${pct(o.threshold)})` : ""}.\n`;
  writeFileSync(join(o.out, "summary.md"), summary);
  writeFileSync(join(o.out, "summary.json"), JSON.stringify({ runs, cases: caseResults, fixtures: fixtureResults, live: liveResults, skipped, meanCaseScore: mean }, null, 2));
  console.log(summary);
  console.error(`results: ${relative(process.cwd(), o.out)}`);
  if (o.threshold != null && mean != null && mean < o.threshold) {
    console.error(`FAIL: mean eval-case score ${pct(mean)} is below the threshold ${pct(o.threshold)}`);
    process.exit(1);
  }
}
