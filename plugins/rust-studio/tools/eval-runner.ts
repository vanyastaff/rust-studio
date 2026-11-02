#!/usr/bin/env bun
// Rust Code Studio — in-repo eval runner over the headless Claude Code CLI.
//
// `claude plugin eval` is the host's runner for evals/, and it is early access: on an account
// without it the command prints a notice and scores nothing. This runner executes the same
// cases — and the benchmarks/ fixtures behind /maintain-studio --mode evaluate, and the live build tasks under
// benchmarks/live/ — with `claude -p --plugin-dir`, so the studio's prompts can be measured on
// any account that can run Claude Code at all. It is a measurement tool for the plugin's own
// source (skills, agents, rules), not for user code.
//
//   bun tools/eval-runner.ts                         # every evals/*/ case, one run each
//   bun tools/eval-runner.ts --case simplify-spaghetti --case routing-start
//   bun tools/eval-runner.ts --target implement-change    # every case whose `targets:` names it
//   bun tools/eval-runner.ts --coverage                   # which skills/agents/rules have a case
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
// `handoff_prompt: continuation.md` plus an exact `handoff_files: [...]` list opts into a
// design-author to fresh implementation run. Only the baseline and declared artifacts cross;
// both native session traces are saved and share --budget. See benchmarks/live/cold-handoff/.
//
// Graders run without the plugin, in an empty cwd, so no CLAUDE.md or hook can shape a score.
// Results land under evals/results/<stamp>/ (gitignored): one JSON per run, plus summary.md and
// summary.json. Spend is capped per run with --budget (USD) and reported per run and in total.

import { profilePath, readMigrationCatalog } from "../hooks/scripts/catalog.ts";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, lstatSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VERDICT } from "../hooks/scripts/subagent-stop.ts";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The plugin under test is a SNAPSHOT of the source tree, staged under a name no installed
// plugin can shadow. `claude --plugin-dir` silently loses to an installed plugin of the same
// name: with `rust-studio@vanya` installed, every run loaded `~/.claude/plugins/cache/...` and
// the source tree was never measured (found 2026-09-17 — three /evolve rounds scored noise).
// A renamed copy also pins the tree at launch, so an edit made while cases are in flight
// changes nothing mid-run. Skill and agent ids carry the staged prefix (`rust-studio-eval:`);
// reports strip it back to the bare name.
export interface StagedPlugin { dir: string; name: string; prefix: string }
export function pluginName(root = PLUGIN_ROOT): string {
  return String(JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8")).name);
}
export function stagePlugin(root = PLUGIN_ROOT, opts: { inheritModels?: boolean } = {}): StagedPlugin {
  const name = `${pluginName(root)}-eval`;
  const dir = join(mkdtempSync(join(tmpdir(), "eval-plugin-")), name);
  const skip = new Set(["results", "node_modules", ".git"]);
  cpSync(root, dir, {
    recursive: true,
    filter: (src) => {
      const rel = relative(root, src);
      if (!rel) return true;
      const top = rel.split(/[\\/]/);
      if (top[0] === "evals" && top[1] === "results") return false;
      return !top.some((seg) => skip.has(seg));
    },
  });
  const manifest = join(dir, ".claude-plugin", "plugin.json");
  const m = JSON.parse(readFileSync(manifest, "utf8"));
  m.name = name;
  writeFileSync(manifest, JSON.stringify(m, null, 2) + "\n");
  // The optional rewrite makes an alternative-endpoint evaluation use its declared subject
  // model. Production briefs keep their role classes; this staging-only path avoids an
  // unsupported Claude alias turning a model comparison into a 404 comparison.
  if (opts.inheritModels) {
    const agentsDir = join(dir, "agents");
    if (existsSync(agentsDir)) {
      for (const f of readdirSync(agentsDir)) {
        if (!f.endsWith(".md")) continue;
        const p = join(agentsDir, f);
        writeFileSync(p, readFileSync(p, "utf8").replace(/^model:\s*\S+\s*$/m, "model: inherit"));
      }
    }
  }
  return { dir, name, prefix: `${name}:` };
}
export function bareName(id: string, prefix: string): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id.replace(/^[a-z0-9-]+:/, "");
}
let STAGED: StagedPlugin | null = null;
let STAGE_INHERIT = false;
function staged(): StagedPlugin {
  if (!STAGED) STAGED = stagePlugin(PLUGIN_ROOT, { inheritModels: STAGE_INHERIT });
  return STAGED;
}
// An installed copy of the same plugin would still load beside the snapshot, and a prompt that
// says "/review" could route to either. Every installed plugin whose name matches is switched
// off for the run through `--settings`, which the host merges over the user's settings.
export function installedIdsFor(name: string, listing: string): string[] {
  const ids: string[] = [];
  for (const m of listing.matchAll(/^\s*[❯>*-]?\s*([a-z0-9-]+)@([a-z0-9-]+)\s*$/gim)) if (m[1] === name) ids.push(`${m[1]}@${m[2]}`);
  return ids;
}
let SHADOW_SETTINGS: string | null | undefined;
function shadowSettings(): string | null {
  if (SHADOW_SETTINGS !== undefined) return SHADOW_SETTINGS;
  const r = Bun.spawnSync(["claude", "plugin", "list"], { stdout: "pipe", stderr: "pipe" });
  const ids = installedIdsFor(pluginName(), new TextDecoder().decode(r.stdout));
  SHADOW_SETTINGS = ids.length ? JSON.stringify({ enabledPlugins: Object.fromEntries(ids.map((id) => [id, false])) }) : null;
  return SHADOW_SETTINGS;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

interface Options {
  cases: string[];
  targets: string[];
  coverage: boolean;
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
  /** Runs per item. Omitted: a case's own frontmatter `runs:` (default 1); fixtures and live tasks run once. */
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
    targets: [],
    coverage: false,
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
    else if (a === "--target") o.targets.push(next());
    else if (a === "--coverage") o.coverage = true;
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
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/.exec(text);
  if (!m) return { fm: {}, body: text };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
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
  return text.split(/\r?\n---\r?\n/).map((s) => s.trim()).filter(Boolean);
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
  /** CLI identity assigned to this conversation (never inherited across a cold handoff). */
  sessionId?: string;
  lastMessage: string;
  /** Multi-turn cases only: every assistant turn with the scripted user replies between them. */
  transcript?: string;
  toolsUsed: string[]; // tool names in order
  skills: string[]; // Skill tool `skill` inputs
  agents: string[]; // Agent tool `subagent_type` inputs
  /** Original invocation scope; absent in historical results, never fabricated from role names. */
  skillCalls?: Array<{ name: string; args: string }>;
  agentCalls?: Array<{ name: string; prompt: string }>;
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
  const t: RunTrace = { lastMessage: "", toolsUsed: [], skills: [], agents: [], skillCalls: [], agentCalls: [], costUsd: 0, turns: 0, durationMs: 0, isError: false, subtype: "", stderrTail: "" };
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
          if (b.name === "Skill" && b.input?.skill) {
            t.skills.push(String(b.input.skill));
            t.skillCalls!.push({ name: String(b.input.skill), args: String(b.input.args ?? "") });
          }
          if (b.name === "Agent" && b.input?.subagent_type) {
            t.agents.push(String(b.input.subagent_type));
            t.agentCalls!.push({ name: String(b.input.subagent_type), prompt: String(b.input.prompt ?? "") });
          }
        } else if (b?.type === "text" && typeof b.text === "string") texts.push(b.text);
      }
      if (texts.length) lastAssistantText = texts.join("\n");
    } else if (o.type === "result") {
      t.costUsd = Number(o.total_cost_usd ?? 0);
      // a resumed session emits one result event per invocation; the run's turns are their sum
      t.turns += Number(o.num_turns ?? 0);
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
    skillCalls: [...(a.skillCalls ?? []), ...(b.skillCalls ?? [])],
    agentCalls: [...(a.agentCalls ?? []), ...(b.agentCalls ?? [])],
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
  // The grader's `flags:` pass through (i, m, s, u) so a rubric written for plugin eval scores the same here.
  const flags = [...new Set((g.fm.flags ?? "").replace(/[^imsu]/g, ""))].join("");
  let re: RegExp;
  try {
    re = new RegExp(g.body, flags);
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
  // `name:` pins WHICH skill or agent had to fire (bare, any plugin prefix): a routing case
  // asserts its route instead of "some studio skill ran". Without it the grader is the old
  // presence check.
  const want = (g.fm.name ?? "").replace(/^["']|["']$/g, "").replace(/^\//, "");
  const nameMatches = (id: string) => !want || id === want || id.endsWith(`:${want}`);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A consolidated entry name alone no longer proves the prior operation or specialist
  // lens fired. Scope evidence must belong to that same invocation, never another call.
  if (g.fm.mode || g.fm.profile) {
    let hit = false;
    if (tool === "Skill" && g.fm.mode && !g.fm.profile) {
      const mode = escape(g.fm.mode);
      const declared = new RegExp(`(?:^|\\s)(?:--mode(?:=|\\s+)|mode\\s*[:=]\\s*)["']?${mode}(?:["']?(?:\\s|$|[,;]))`, "i");
      hit = (trace.skillCalls ?? []).some(call => nameMatches(call.name) && declared.test(call.args));
    } else if (tool === "Agent" && g.fm.profile && !g.fm.mode) {
      const profile = escape(g.fm.profile);
      const declared = new RegExp(`(?:profiles[/\\\\]${profile}\\.md\\b|\\bprofile\\s*:\\s*${profile}\\b|\\b${profile}\\s+profile\\b)`, "i");
      // profileInstruction quotes paths with JSON.stringify; on Windows that leaves
      // doubled backslashes in the Agent prompt even after stream JSON is parsed.
      hit = (trace.agentCalls ?? []).some(call => nameMatches(call.name) && declared.test(call.prompt.replace(/\\+/g, "/")));
    }
    return { file: g.file, type: g.type, weight: g.weight, score: hit ? 1 : 0,
      detail: `${tool} ${want} ${g.fm.mode ? `mode=${g.fm.mode}` : `profile=${g.fm.profile}`} ${hit ? "fired with declared scope" : "has no matching scope evidence"}${extra}` };
  }
  if (want) {
    const ids = tool === "Skill" ? trace.skills : tool === "Agent" ? trace.agents : [];
    const hit = ids.some((id) => id === want || id.endsWith(`:${want}`));
    return { file: g.file, type: g.type, weight: g.weight, score: hit ? 1 : 0, detail: `${tool} ${want} ${hit ? "fired" : "did not fire"}${extra}` };
  }
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

export function cleanEnv(model?: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v == null) continue;
    // Never let a run attach to the session that launched the runner.
    if (k === "CLAUDE_CODE_SESSION_ID" || k === "CLAUDE_CODE_CHILD_SESSION" || k === "CLAUDE_CODE_MESSAGING_SOCKET") continue;
    env[k] = v;
  }
  if (model) {
    env.CLAUDE_CODE_SUBAGENT_MODEL = model;
    env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE = "1";
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
  if (a.withPlugin) {
    args.push("--plugin-dir", staged().dir);
    const shadow = shadowSettings();
    if (shadow) args.push("--settings", shadow);
  }
  if (a.allowedTools.length) args.push("--allowedTools", ...a.allowedTools);
  if (a.model) args.push("--model", a.model);
  // The subject-model override puts each spawned agent on the same model as the orchestrator.
  const env = cleanEnv(a.model);
  const r = await runProcess(["claude", ...args], a.cwd, a.timeoutSec * 1000, env);
  return { ...sessionTrace(r), raw: r.stdout };
}

/** Process failure cannot be hidden by an earlier successful-looking JSON result. */
export function sessionTrace(r: { stdout: string; stderr: string; code: number | null; timedOut: boolean }): RunTrace {
  const trace = parseStream(r.stdout);
  trace.stderrTail = r.stderr.slice(-2000);
  if (r.timedOut) {
    trace.isError = true;
    trace.subtype = "timeout";
  } else if (r.code !== 0) {
    trace.isError = true;
    trace.subtype = `process-exit-${r.code ?? "unknown"}`;
  }
  return trace;
}

/** A conversation: the opening prompt, then each follow-up on the same session. */
async function runConversation(a: Omit<SessionRunArgs, "sessionId" | "resume">, followUps: string[], sharedBudget = false): Promise<RunTrace & { raw: string }> {
  const sessionId = crypto.randomUUID();
  let acc = await runSession({ ...a, sessionId });
  let raw = acc.raw;
  // A multi-turn case is graded on the whole exchange, not on its last turn alone: the
  // questions a design skill asks live in turn 1, the drafted surface in turn 3.
  const transcript: string[] = [`[assistant, turn 1]\n${acc.lastMessage}`];
  for (const [i, reply] of followUps.entries()) {
    if (acc.isError) break;
    const budgetUsd = sharedBudget ? a.budgetUsd - acc.costUsd : a.budgetUsd;
    if (!(budgetUsd > 0)) { acc.isError = true; acc.subtype = "conversation-budget-exhausted"; break; }
    const next = await runSession({ ...a, budgetUsd, prompt: reply, sessionId, resume: true });
    raw += "\n" + next.raw;
    transcript.push(`[user, scripted reply ${i + 1}]\n${reply}`, `[assistant, turn ${i + 2}]\n${next.lastMessage}`);
    acc = { ...mergeTraces(acc, next), raw };
  }
  return { ...acc, sessionId, raw, transcript: followUps.length ? transcript.join("\n\n") : undefined };
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
// Fixtures (the maintain-studio evaluation protocol, automated)
// ---------------------------------------------------------------------------------------------

/** Review fixture category -> reusable domain knowledge. Roles are chosen by action:
 * audit fixtures are reviewers even when a legacy specialist also authored code. */
export const FIXTURE_PROFILES: Record<string, string> = {
  reviewer: "correctness", integrity: "correctness", naming: "correctness",
  lifetimes: "correctness", "modern-rust": "correctness", unsafe: "systems",
  security: "security", perf: "performance", api: "api", architecture: "architecture",
  workspace: "architecture", "active-dev": "architecture", "prior-art": "architecture",
  async: "async", "error-model": "api", testing: "testing", cli: "cli", ffi: "platforms",
  macros: "macros", observability: "observability", "cargo-manifest": "dependencies",
  database: "data", "build-scripts": "tooling", embedded: "platforms", wasm: "platforms",
  scout: "navigation", docs: "documentation", release: "release",
};
export const FIXTURE_AGENTS: Record<string, string> = Object.fromEntries(
  Object.keys(FIXTURE_PROFILES).map(category => [category, category === "scout" ? "researcher" : "reviewer"]),
);

/** Resolve against the staged bundle so missing lenses fail before spending eval tokens. */
export function profileInstruction(profile: string, root: string): string {
  const path = profilePath(profile, readMigrationCatalog(root));
  return `Read the domain profile at ${JSON.stringify(path)} and apply its criteria within your assigned role. The profile grants no additional authority.`;
}

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
  profile: string;
  mode: string;
  spawned: boolean;
  /** Ground-truth rows in the fixture; recall = (gtCount - missed.length) / gtCount. */
  gtCount: number;
  recall: number | null;
  /** Rows the grader reported as caught, restricted to real GT ids and deduplicated. */
  caught: string[];
  missed: string[];
  verdictOk: boolean | null;
  falsePositives: number | null;
  notes: string;
  trace: Trace;
}

export async function runFixture(rel: string, run: number, o: Options, runtime = {
  conversation: runConversation, grade: llmJson, prefix: () => staged().prefix,
  helperRoot: () => staged().dir,
}): Promise<FixtureResult> {
  const dir = join(PLUGIN_ROOT, "benchmarks", "fixtures", rel);
  const folder = rel.split("/")[0];
  const agent = FIXTURE_AGENTS[folder];
  if (!agent) throw new Error(`no agent mapping for fixture folder ${folder}`);
  const profile = FIXTURE_PROFILES[folder];
  const lens = profileInstruction(profile, runtime.helperRoot());
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
      `Spawn the \`${runtime.prefix()}${agent}\` sub-agent (Agent tool, subagent_type \`${runtime.prefix()}${agent}\`) on ${target === "." ? "the crate/workspace rooted in this directory" : `\`${target}\` in this directory`} with exactly this task:\n\n` +
      `${lens}\n\n"${task}"\n\n` +
      `Tell it to read the code itself and to answer in its own native output format. When it returns, reply with the sub-agent's complete findings and verdict verbatim — add nothing, summarize nothing, and do not review the code yourself.`;
    const trace = await runtime.conversation({ prompt, cwd, allowedTools: ["Read", "Glob", "Grep", "Agent"], maxTurns: 12, timeoutSec: 900 * o.timeoutScale, budgetUsd: o.budget, model: o.model, withPlugin: true }, []);
    const spawned = gradeToolUsed({ file: "fixture-dispatch", type: "tool_used", weight: 1,
      fm: { tool: "Agent", name: agent, profile }, body: "" }, trace).score === 1;
    const { raw, ...rest } = trace;
    writeFileSync(join(o.out, `fixture__${rel.replace(/\//g, "__")}.run${run}.stream.jsonl`), raw);
    if (!spawned) return { kind: "fixture", name: rel, run, agent, profile, mode, spawned,
      gtCount: ids.length, recall: null, caught: [], missed: ids, verdictOk: false,
      falsePositives: null, notes: `No observed ${agent} invocation carrying the ${profile} profile; findings cannot be attributed to this lens.`, trace: rest };
    const passRule =
      mode === "first-pass"
        ? " (it must reject the shape: RESHAPE NEEDED / REDO-TO-BAR / NEEDS WORK naming the shape; ACCEPTABLE or a wave-through fails)"
        : mode === "map-recall"
          ? " (a map is complete when every row is present with a correct file and a line within two of the ground truth; a verdict token is not required)"
          : "";
    const gradePrompt =
      `GROUND TRUTH (the planted defects or expected rows; the agent under test never saw this file):\n${gt}\n\n` +
      `AGENT RESPONSE:\n<<<\n${trace.lastMessage.slice(0, 60_000)}\n>>>\n\n` +
      `For every GT-n row decide whether the response caught it — same item at the same code location (within two lines), matched on substance not wording. A row the ground truth marks as negative (NOT-AN-IMPL, "must not be listed", "silence is the correct answer") is caught when the response does NOT report that item, and missed only when it does. ` +
      `Then decide whether the response's verdict satisfies the ground truth's Pass condition${passRule}, ` +
      `and whether any "Automatic fail" condition in the ground truth is triggered. Count findings with no ground-truth row as false positives only when they are wrong or noise, not when they are real additional defects. ` +
      `Return {"caught": ["GT-1", …], "missed": ["GT-…"], "verdict_ok": true|false, "auto_fail": true|false, "false_positives": <n>, "notes": "<one or two sentences: what was missed and why the verdict passed or failed>"}.`;
    const j = await runtime.grade(gradePrompt, o.graderModel);
    if (j?.error) return { kind: "fixture", name: rel, run, agent, profile, mode, spawned, gtCount: ids.length, recall: null, caught: [], missed: ids, verdictOk: null, falsePositives: null, notes: j.error, trace: rest };
    const caught: string[] = Array.isArray(j.caught) ? [...new Set(j.caught.filter((x: unknown): x is string => typeof x === "string" && ids.includes(x)))] : [];
    const missed = ids.filter((id) => !caught.includes(id));
    const autoFail = Boolean(j.auto_fail);
    return {
      kind: "fixture",
      name: rel,
      run,
      agent,
      profile,
      mode,
      spawned,
      gtCount: ids.length,
      recall: ids.length ? caught.length / ids.length : null,
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

export interface LiveResult {
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
  handoff?: {
    isolation: "native-fresh-conversation" | "not-established";
    files: string[];
    authorTrace: Trace;
    implementationTrace?: Trace;
    behaviorPassed?: boolean | null;
    lifecycle?: { verified: boolean; reason: string };
    error?: string;
  };
}

function artifactPath(path: string): boolean {
  return path.startsWith("docs/designs/") || path.startsWith("intent/")
    || path.startsWith(".rust-studio/reviews/");
}

/** Conservative observation gate, not a security sandbox or a semantic design grader.
 * Opaque child tools and unknown shell commands cannot establish ordering from this stream. */
export function checkHandoffBoundary(raw: string, config: {
  root: string; helperRoot: string; reconstruction: string; packet: string;
}): { verified: boolean; reason: string } {
  const fail = (reason: string) => ({ verified: false, reason });
  const at = (path: string) => relative(resolve(config.root), resolve(config.root, path)).split(/[\\/]/).join("/");
  let reconstruction = false, accepted = false, current = false;
  let reconstructionCall = "", checkCall = "", productCall = "";
  const pendingWrites = new Set<string>();
  function packetCheck(command: string): boolean {
    if (/[;&|<>`$\r\n]/.test(command)) return false;
    const tokens = command.match(/"[^"\r\n]*"|'[^'\r\n]*'|[^\s"']+/g)?.map(token => token.replace(/^(?:"(.*)"|'(.*)')$/, "$1$2")) ?? [];
    if (tokens.length !== 5 || !/(?:^|[\\/])bun(?:\.exe)?$/.test(tokens[0]) || tokens[2] !== "check") return false;
    const helper = relative(resolve(config.helperRoot), resolve(config.root, tokens[1]));
    return !isAbsolute(helper) && helper.split(/[\\/]/)[0] !== ".."
      && /(?:^|[\\/])design-workflow\.ts$/.test(helper)
      && resolve(config.root, tokens[3]) === resolve(config.root)
      && at(tokens[4]) === config.packet;
  }
  for (const line of raw.split("\n")) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    for (const block of event?.message?.content ?? []) {
      if (event.type === "assistant" && block.type === "text" && /^HANDOFF_RECONSTRUCTION_ACCEPTED\s*$/m.test(block.text ?? "")) {
        if (!reconstruction) return fail("coordinator acceptance preceded successful reconstruction write");
        accepted = true;
      }
      if (block.type === "tool_result") {
        pendingWrites.delete(block.tool_use_id);
        if (productCall && block.tool_use_id === productCall) {
          return block.is_error || pendingWrites.size || !current
            ? fail("first product write failed or has concurrent/stale boundary evidence")
            : { verified: true, reason: "observed reconstruction, coordinator acceptance and CURRENT before first successful product write" };
        }
        if (block.tool_use_id === reconstructionCall) {
          if (block.is_error) return fail("reconstruction write failed");
          reconstruction = true;
        }
        if (block.tool_use_id === checkCall) {
          if (block.is_error) return fail("packet check failed");
          const output = typeof block.content === "string" ? block.content
            : (block.content ?? []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
          let checked: any;
          try { checked = JSON.parse(output.trim()); } catch { return fail("packet check result is not observable JSON"); }
          if (checked.status !== "CURRENT" || !(checked.checked > 0) || !Array.isArray(checked.changed)
              || checked.changed.length || !Array.isArray(checked.unavailable) || checked.unavailable.length) return fail("packet is stale or incompletely checked");
          current = true;
        }
      }
      if (block.type !== "tool_use") continue;
      const name = block.name, input = block.input ?? {};
      if (["Read", "Glob", "Grep", "Skill"].includes(name)) continue;
      if (name === "Write" || name === "Edit") {
        if (typeof input.file_path !== "string" || typeof block.id !== "string") return fail("write lacks observable path/identity");
        if (productCall) return fail("concurrent mutation while first product write is pending");
        // An older in-flight check cannot become current after this mutation completes.
        checkCall = "";
        pendingWrites.add(block.id);
        const path = at(input.file_path);
        if (!path || isAbsolute(path) || path.split("/")[0] === "..") return fail("write is outside the handed-off repository");
        if (path === config.reconstruction) {
          if (name !== "Write" || typeof input.content !== "string" || !input.content.trim()) return fail("reconstruction requires an observable full write");
          reconstructionCall = block.id; reconstruction = false; accepted = false; current = false;
        } else if (artifactPath(path)) {
          // Changed design/evidence requires a new reconstruction and acceptance, not just
          // a freshly captured packet that silently ratifies the previous challenge.
          reconstructionCall = ""; reconstruction = false; accepted = false; current = false;
        } else {
          if (!(reconstruction && accepted && current) || pendingWrites.size !== 1) return fail("product write preceded reconstruction, acceptance or uncontested CURRENT check");
          productCall = block.id;
        }
        continue;
      }
      if (name === "Bash") {
        const command = String(input.command ?? "");
        if (packetCheck(command)) {
          if (!accepted || typeof block.id !== "string" || pendingWrites.size) return fail("packet check preceded acceptance, lacks identity or races a pending write");
          checkCall = block.id; current = false;
          continue;
        }
        // Only exact informational commands have no argument expansion or execution ambiguity.
        if (/^\s*(?:pwd|git (?:status(?: --short)?|diff(?: --stat)?))\s*$/.test(command)) continue;
        return fail("shell effects before first product write are not observable; lifecycle unverified");
      }
      return fail(`opaque ${name} execution before first product write; lifecycle unverified`);
    }
  }
  return fail("missing observable first product write or lifecycle trace");
}

/** The exact primitive used by live runs: no author checkout, history, or implicit files
 * cross this boundary. Buffers are captured before writing to avoid partial validation. */
export function stageLiveHandoff(baselineRoot: string, authorRoot: string, destinationRoot: string, files: string[]): void {
  if (!files.length || new Set(files).size !== files.length) throw new Error("handoff requires unique explicit artifact files");
  for (const path of files) {
    if (/[\\:\x00-\x1f]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..") || !artifactPath(path)) {
      throw new Error(`unsafe or non-artifact handoff path: ${path}`);
    }
  }
  const roots = [baselineRoot, authorRoot, destinationRoot].map(root => resolve(root));
  for (const root of roots) {
    for (let path = root; ; path = dirname(path)) {
      if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`symlink in handoff root ancestry: ${path}`);
      if (dirname(path) === path) break;
    }
  }
  for (let i = 0; i < roots.length; i++) for (let j = 0; j < roots.length; j++) {
    const rel = relative(roots[i], roots[j]);
    if (i !== j && !isAbsolute(rel) && rel.split(/[\\/]/)[0] !== "..") {
      throw new Error("handoff roots must be separate directories");
    }
  }
  if (existsSync(destinationRoot) && (lstatSync(destinationRoot).isSymbolicLink() || readdirSync(destinationRoot).length)) {
    throw new Error("handoff destination must be empty and not a symlink");
  }
  function inventory(root: string): Map<string, Buffer> {
    if (lstatSync(root).isSymbolicLink()) throw new Error(`symlink root: ${root}`);
    const result = new Map<string, Buffer>();
    function walk(dir: string, prefix = "") {
      for (const name of readdirSync(dir)) {
        if (!prefix && [".git", "target"].includes(name)) continue;
        const path = prefix ? `${prefix}/${name}` : name;
        const full = join(dir, name), stat = lstatSync(full);
        if (stat.isSymbolicLink()) throw new Error(`symlink in handoff tree: ${path}`);
        if (stat.isDirectory()) walk(full, path);
        else if (stat.isFile()) result.set(path, readFileSync(full));
        else throw new Error(`not a regular handoff file: ${path}`);
      }
    }
    walk(root);
    return result;
  }
  const baseline = inventory(baselineRoot), author = inventory(authorRoot);
  for (const path of files) {
    if (baseline.has(path)) throw new Error(`handoff artifact would overwrite baseline: ${path}`);
    if (!author.has(path)) throw new Error(`missing regular handoff artifact: ${path}`);
  }
  for (const [path, bytes] of baseline) {
    if (!author.get(path)?.equals(bytes)) throw new Error(`author changed baseline product file: ${path}`);
  }
  for (const path of author.keys()) {
    if (!baseline.has(path) && !artifactPath(path)) throw new Error(`author added product file: ${path}`);
  }
  for (const [path, bytes] of [...baseline, ...files.map(path => [path, author.get(path)!] as const)]) {
    const destination = join(destinationRoot, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes, { flag: "wx" });
  }
}

export async function runLive(name: string, run: number, o: Options, runtime = {
  conversation: runConversation, process: runProcess, prefix: () => staged().prefix,
  helperRoot: () => staged().dir,
}): Promise<LiveResult> {
  const dir = join(PLUGIN_ROOT, "benchmarks", "live", name);
  const { fm, body } = splitFrontmatter(readFileSync(join(dir, "task.md"), "utf8"));
  const targetKind = fm.kind ?? "agent";
  const target = fm.target;
  if (!target) throw new Error(`benchmarks/live/${name}/task.md has no target`);
  const cwd = mkdtempSync(join(tmpdir(), `rs-live-${name}-`));
  let implementationCwd: string | undefined;
  try {
    cpSync(join(dir, "crate"), cwd, { recursive: true });
    for (const cmd of [["git", "init", "-q"], ["git", "add", "-A"], ["git", "-c", "user.name=live", "-c", "user.email=live@example.invalid", "commit", "-q", "-m", "baseline"]]) {
      const r = await runtime.process(cmd, cwd, 30_000);
      if (r.code !== 0) throw new Error(`${cmd.join(" ")} failed: ${r.stderr}`);
    }
    const lens = fm.profile ? profileInstruction(fm.profile, runtime.helperRoot()) : "";
    const task = [lens, body.trim()].filter(Boolean).join("\n\n");
    const prompt =
      targetKind === "skill"
        ? `/${runtime.prefix()}${target}${fm.mode ? ` --mode ${fm.mode}` : ""} ${task}`
        : `Spawn the \`${runtime.prefix()}${target}\` sub-agent (Agent tool, subagent_type \`${runtime.prefix()}${target}\`) in this repository with exactly this task, and let it do the work itself:\n\n${task}\n\nWhen it returns, reply with its complete report and verdict verbatim — add nothing, and do not redo or "improve" its work.`;
    const trace = await runtime.conversation(
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
      // A live task may carry follow-ups.md too: a skill with an approval gate (/dev-task's
      // Phase 3) ends its turn on a question, and the scripted reply is the human answering it.
      existsSync(join(dir, "follow-ups.md")) ? parseFollowUps(readFileSync(join(dir, "follow-ups.md"), "utf8")) : [],
      Boolean(fm.handoff_prompt || fm.handoff_files),
    );
    const { raw, ...rest } = trace;
    if (fm.handoff_prompt || fm.handoff_files) {
      const files = parseList(fm.handoff_files);
      const handoff: NonNullable<LiveResult["handoff"]> = { isolation: "not-established", files, authorTrace: rest };
      let combined: Trace = rest;
      const result = (passed: boolean | null, checkExit: number | null, checkOutput: string): LiveResult => ({
        kind: "live", name, run, target, targetKind, passed, checkExit, checkOutput,
        verdictPresent: Boolean(handoff.implementationTrace && VERDICT.test(handoff.implementationTrace.lastMessage)),
        trace: combined, handoff,
      });
      try {
        writeFileSync(join(o.out, `live__${name}.run${run}.author.stream.jsonl`), raw);
        if (trace.isError || trace.subtype !== "success" || !raw.trim() || !trace.sessionId) throw new Error("author conversation failed or has no completed trace/identity");
        if (!fm.handoff_prompt || /[\\:\x00-\x1f]/.test(fm.handoff_prompt) || fm.handoff_prompt.split("/").some(p => !p || p === "." || p === "..")) throw new Error("invalid handoff_prompt");
        const remainingBudget = o.budget - trace.costUsd;
        if (!(remainingBudget > 0)) throw new Error("author exhausted the shared live-run budget before implementation");
        implementationCwd = mkdtempSync(join(tmpdir(), `rs-live-${name}-fresh-`));
        stageLiveHandoff(join(dir, "crate"), cwd, implementationCwd, files);
        // The new baseline has original product bytes plus only the declared design artifacts.
        for (const cmd of [["git", "init", "-q"], ["git", "add", "-A"], ["git", "-c", "user.name=live", "-c", "user.email=live@example.invalid", "commit", "-q", "-m", "handoff baseline"]]) {
          const r = await runtime.process(cmd, implementationCwd, 30_000);
          if (r.code !== 0) throw new Error(`${cmd.join(" ")} failed: ${r.stderr}`);
        }
        const implementation = await runtime.conversation({
          prompt: readFileSync(join(dir, fm.handoff_prompt), "utf8").replaceAll("{{PLUGIN_PREFIX}}", runtime.prefix()),
          cwd: implementationCwd,
          allowedTools: parseList(fm.allowed_tools).length ? parseList(fm.allowed_tools) : ["Read", "Edit", "Write", "Glob", "Grep", "Bash", "Agent", "Skill"],
          maxTurns: Number(fm.handoff_max_turns ?? fm.max_turns ?? 40),
          timeoutSec: Number(fm.timeout_seconds ?? 1500) * o.timeoutScale,
          budgetUsd: remainingBudget, model: o.model, withPlugin: true,
        }, []);
        const { raw: implementationRaw, ...implementationTrace } = implementation;
        handoff.implementationTrace = implementationTrace;
        combined = { ...implementationTrace, costUsd: rest.costUsd + implementationTrace.costUsd,
          turns: rest.turns + implementationTrace.turns, durationMs: rest.durationMs + implementationTrace.durationMs };
        writeFileSync(join(o.out, `live__${name}.run${run}.stream.jsonl`), implementationRaw);
        if (implementation.isError || implementation.subtype !== "success" || !implementationRaw.trim()
            || !implementation.sessionId || implementation.sessionId === trace.sessionId) throw new Error("implementation failed or lacks a completed, distinct conversation trace");
        handoff.isolation = "native-fresh-conversation";
        handoff.lifecycle = checkHandoffBoundary(implementationRaw, {
          root: implementationCwd, helperRoot: runtime.helperRoot(),
          reconstruction: fm.handoff_reconstruction ?? "docs/designs/cold-handoff/reconstruction.md",
          packet: fm.handoff_packet ?? ".rust-studio/reviews/cold-handoff/packet.json",
        });
        const check = await runtime.process(["bash", join(dir, "check.sh")], implementationCwd, 600_000, { ...cleanEnv(), LIVE_DIR: dir });
        handoff.behaviorPassed = check.timedOut ? null : check.code === 0;
        return result(handoff.lifecycle.verified ? handoff.behaviorPassed : false, check.code,
          (check.stdout + (check.stderr ? "\n[stderr]\n" + check.stderr : "") + `\nLifecycle: ${handoff.lifecycle.verified ? "VERIFIED" : "UNVERIFIED"}: ${handoff.lifecycle.reason}`).slice(-6000));
      } catch (error) {
        handoff.error = String(error);
        combined = { ...combined, isError: true, subtype: "handoff-error" };
        return result(false, null, handoff.error);
      }
    }
    writeFileSync(join(o.out, `live__${name}.run${run}.stream.jsonl`), raw);
    const check = await runtime.process(["bash", join(dir, "check.sh")], cwd, 600_000, { ...cleanEnv(), LIVE_DIR: dir });
    const checkOutput = (check.stdout + (check.stderr ? "\n[stderr]\n" + check.stderr : "")).slice(-6000);
    return { kind: "live", name, run, target, targetKind, passed: check.timedOut ? null : check.code === 0, checkExit: check.code, checkOutput, verdictPresent: VERDICT.test(trace.lastMessage), trace: rest };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    if (implementationCwd) rmSync(implementationCwd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Orchestration + report
// ---------------------------------------------------------------------------------------------

function listCases(): string[] {
  const dir = join(PLUGIN_ROOT, "evals");
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, "prompt.md"))).sort();
}

// Every case declares what it measures: `targets: [skill:review, agent:rust-reviewer, rule:async]`.
// `--target review` (or `skill:review`) selects the cases that name it; `--coverage` lists what
// no case names, which is where a target-driven /evolve round has to write a case first.
export function caseTargets(promptText: string): string[] {
  return parseList(splitFrontmatter(promptText).fm.targets ?? "");
}
export function targetMatches(target: string, ids: string[]): boolean {
  const bare = target.replace(/^\//, "");
  return ids.some((id) => id === bare || id.endsWith(`:${bare}`));
}
export function casesForTargets(targets: string[], all: string[], read: (c: string) => string): string[] {
  return all.filter((c) => targets.some((t) => targetMatches(t, caseTargets(read(c)))));
}
export function coverageReport(all: string[], read: (c: string) => string, names: { skills: string[]; agents: string[]; rules: string[] }): string {
  const count = new Map<string, string[]>();
  for (const c of all) for (const id of caseTargets(read(c))) count.set(id, [...(count.get(id) ?? []), c]);
  const lines: string[] = [];
  for (const [kind, list] of [["skill", names.skills], ["agent", names.agents], ["rule", names.rules]] as const) {
    const covered = list.filter((n) => count.has(`${kind}:${n}`));
    lines.push(`${kind}s with a case: ${covered.length}/${list.length}`);
    for (const n of covered) lines.push(`  ${kind}:${n}  ${count.get(`${kind}:${n}`)!.join(", ")}`);
    const bare = list.filter((n) => !count.has(`${kind}:${n}`));
    if (bare.length) lines.push(`${kind}s with NO case (${bare.length}): ${bare.join(" ")}`);
  }
  return lines.join("\n");
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

export function renderSummary(cases: CaseResult[], fixtures: FixtureResult[], live: LiveResult[], graderModel: string, runs: number | string): string {
  const lines: string[] = [];
  lines.push(`# Eval run — ${new Date().toISOString()}`, "");
  const cost = [...cases, ...fixtures, ...live].reduce((a, r) => a + (r.trace.costUsd || 0), 0);
  lines.push(`Grader: \`${graderModel}\`. Runs per item: ${runs}. Total spend: $${cost.toFixed(2)} across ${cases.length} eval run(s), ${fixtures.length} fixture run(s), ${live.length} live run(s).`, "");
  if (cases.length) {
    const byCase = groupBy(cases);
    lines.push("## Eval cases", "", `| case | mean | min | max | studio path fired | cost |`, "|---|---|---|---|---|---|");
    for (const [name, rs] of [...byCase.entries()].sort()) {
      const s = stats(rs.map((r) => r.score).filter((x): x is number => x != null));
      const fired = [...new Set(rs.flatMap((r) => [...r.trace.skills.map((k) => `/${bareName(k, staged().prefix)}`), ...r.trace.agents.map((a) => bareName(a, staged().prefix))]))].join(", ") || "—";
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
    lines.push("## Fixtures (agent under test)", "", "| fixture | agent | profile | mode | spawned | recall mean | recall min | verdict ok | cost |", "|---|---|---|---|---|---|---|---|---|");
    for (const [name, rs] of [...byFx.entries()].sort()) {
      const s = stats(rs.map((r) => r.recall).filter((x): x is number => x != null));
      const vok = rs.filter((r) => r.verdictOk === true).length;
      lines.push(`| ${name} | ${rs[0].agent} | ${rs[0].profile} | ${rs[0].mode} | ${rs.every((r) => r.spawned) ? "✓" : "✗"} | ${pct(s.mean)} | ${pct(s.min)} | ${vok}/${rs.length} | $${rs.reduce((a, r) => a + r.trace.costUsd, 0).toFixed(2)} |`);
    }
    lines.push("");
    const byAgent = new Map<string, { hits: number; total: number; verdictFails: number; n: number }>();
    for (const f of fixtures) {
      const identity = `${f.agent} + ${f.profile}`;
      const e = byAgent.get(identity) ?? { hits: 0, total: 0, verdictFails: 0, n: 0 };
      e.hits += f.gtCount - f.missed.length;
      e.total += f.gtCount;
      e.n += 1;
      if (f.verdictOk === false) e.verdictFails += 1;
      byAgent.set(identity, e);
    }
    lines.push("### Per role and profile", "", "| role + profile | fixture runs | recall (rows) | verdict failures |", "|---|---|---|---|");
    for (const [agent, e] of [...byAgent.entries()].sort()) lines.push(`| ${agent} | ${e.n} | ${e.hits}/${e.total} (${e.total ? Math.round((100 * e.hits) / e.total) : 0}%) | ${e.verdictFails} |`);
    lines.push("");
    for (const f of fixtures) {
      if (f.missed.length || f.verdictOk === false || !f.spawned) {
        lines.push(`### ${f.name} (run ${f.run})`, `- spawned ${f.agent} + ${f.profile}: ${f.spawned ? "yes" : "NO — required role/profile dispatch was not observed"}`, `- missed: ${f.missed.join(", ") || "none"}`, `- notes: ${f.notes}`, "");
      }
    }
  }
  if (live.length) {
    lines.push("## Live tasks (real crates)", "", "| task | target | check.sh | verdict in report | turns | cost |", "|---|---|---|---|---|---|");
    for (const l of live) {
      const outcome = l.handoff
        ? `${l.passed ? "PASS" : "FAIL"} (behavior ${l.handoff.behaviorPassed === true ? "PASS" : l.handoff.behaviorPassed === false ? "FAIL" : "unscored"}; lifecycle ${l.handoff.lifecycle?.verified ? "VERIFIED" : "UNVERIFIED"})`
        : l.passed == null ? "timeout" : l.passed ? "PASS" : `FAIL (exit ${l.checkExit})`;
      lines.push(`| ${l.name} (run ${l.run}) | ${l.targetKind} ${l.target} | ${outcome} | ${l.verdictPresent ? "✓" : "✗"} | ${l.trace.turns} | $${l.trace.costUsd.toFixed(2)}${l.trace.isError ? ` ⚠ ${l.trace.subtype}` : ""} |`);
    }
    lines.push("");
    for (const l of live) lines.push(`### ${l.name} (run ${l.run}) — check.sh`, "```", l.checkOutput.trim(), "```", "");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const o = parseArgs(process.argv.slice(2));
  const readCase = (c: string) => readFileSync(join(PLUGIN_ROOT, "evals", c, "prompt.md"), "utf8");
  const studioNames = {
    skills: readdirSync(join(PLUGIN_ROOT, "skills")).filter((d) => existsSync(join(PLUGIN_ROOT, "skills", d, "SKILL.md"))).sort(),
    agents: readdirSync(join(PLUGIN_ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort(),
    rules: readdirSync(join(PLUGIN_ROOT, "rules")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort(),
  };
  if (o.coverage) {
    console.log(coverageReport(listCases(), readCase, studioNames));
    process.exit(0);
  }
  if (o.targets.length) {
    const hit = casesForTargets(o.targets, listCases(), readCase);
    if (!hit.length) throw new Error(`no eval case names ${o.targets.join(", ")} in its targets: — write one before tuning it (eval-improvement.md), or run --coverage`);
    for (const c of hit) if (!o.cases.includes(c)) o.cases.push(c);
  }
  const explicit = o.cases.length || o.fixtures.length || o.liveTasks.length || o.allFixtures || o.allLive;
  const cases = o.cases.length ? o.cases : explicit ? [] : listCases();
  const fixtures = o.allFixtures ? listFixtures() : o.fixtures;
  const live = o.allLive ? listLive() : o.liveTasks;
  for (const c of cases) if (!existsSync(join(PLUGIN_ROOT, "evals", c, "prompt.md"))) throw new Error(`no such eval case: ${c}`);
  for (const f of fixtures) if (!existsSync(join(PLUGIN_ROOT, "benchmarks", "fixtures", f, "ground-truth.md"))) throw new Error(`no such fixture: ${f}`);
  for (const l of live) if (!existsSync(join(PLUGIN_ROOT, "benchmarks", "live", l, "task.md"))) throw new Error(`no such live task: ${l}`);
  // A case's frontmatter `runs:` is its default (routing is stochastic; those cases ask for 3);
  // --runs overrides it for everything. Fixtures and live tasks run once unless --runs says otherwise.
  const caseRuns = (c: string): number => o.runs ?? Math.max(1, Number(splitFrontmatter(readFileSync(join(PLUGIN_ROOT, "evals", c, "prompt.md"), "utf8")).fm.runs) || 1);
  const otherRuns = (): number => o.runs ?? 1;
  const runsLabel: number | string = o.runs ?? "per case (frontmatter `runs:`), 1 for fixtures and live tasks";
  if (o.dryRun) {
    console.log(`runs per item: ${runsLabel}`);
    console.log(`would run ${cases.length} case(s): ${cases.map((c) => `${c}×${caseRuns(c)}`).join(", ") || "—"}`);
    console.log(`would run ${fixtures.length} fixture(s): ${fixtures.map((f) => `${f} → ${FIXTURE_AGENTS[f.split("/")[0]]} + ${FIXTURE_PROFILES[f.split("/")[0]]}`).join(", ") || "—"}`);
    console.log(`would run ${live.length} live task(s): ${live.join(", ") || "—"}`);
    process.exit(0);
  }
  if (!Bun.which("claude")) throw new Error("claude CLI not on PATH");
  STAGE_INHERIT = Boolean(o.model);
  mkdirSync(o.out, { recursive: true });
  const started = Date.now();
  const log = (s: string) => console.error(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${s}`);
  log(`plugin under test: ${staged().dir} (snapshot of ${PLUGIN_ROOT}, loaded as \`${staged().name}\`${shadowSettings() ? `; installed copy disabled for the run: ${shadowSettings()}` : ""})`);
  process.on("exit", () => { try { if (STAGED) rmSync(dirname(STAGED.dir), { recursive: true, force: true }); } catch {} });
  let spent = 0;
  const overBudget = () => o.totalBudget != null && spent >= o.totalBudget;
  const EMPTY_TRACE: Trace = { lastMessage: "", toolsUsed: [], skills: [], agents: [], costUsd: 0, turns: 0, durationMs: 0, isError: true, subtype: "runner-error" };

  /** One protocol for every kind of item: log → run → account spend → write `<file>.runN.json` →
   *  log the outcome; a thrown run becomes a runner-error result; runs the budget stop skipped are
   *  listed, not silently dropped. */
  const runAll = async <R extends { trace: Trace }>(
    kind: string,
    items: string[],
    runsFor: (name: string) => number,
    parallel: number,
    file: (name: string, run: number) => string,
    run: (name: string, k: number) => Promise<R>,
    fallback: (name: string, k: number, err: unknown) => R,
    outcome: (r: R) => string,
  ): Promise<{ results: R[]; skipped: string[] }> => {
    const work = items.flatMap((it) => Array.from({ length: runsFor(it) }, (_, k) => [it, k + 1] as [string, number]));
    const raw = await pool(work, parallel, async ([name, k]) => {
      log(`▶ ${kind} ${name} run ${k}`);
      let r: R;
      try {
        r = await run(name, k);
        spent += r.trace.costUsd;
        log(`✔ ${kind} ${name} run ${k} → ${outcome(r)} ($${r.trace.costUsd.toFixed(2)}, total $${spent.toFixed(2)})`);
      } catch (e) {
        log(`✖ ${kind} ${name} run ${k} failed: ${e}`);
        r = fallback(name, k, e);
      }
      writeFileSync(join(o.out, `${file(name, k)}.run${k}.json`), JSON.stringify(r, null, 2));
      return r;
    }, overBudget);
    return {
      results: raw.filter((r): r is R => r != null),
      skipped: work.filter((_, i) => raw[i] == null).map(([name, k]) => `${kind} ${name} run ${k}`),
    };
  };

  const { results: caseResults, skipped } = await runAll<CaseResult>(
    "case", cases, caseRuns, o.parallel, (c) => c,
    (c, k) => runCase(c, k, o),
    (c, k, e) => ({ kind: "eval", name: c, run: k, score: null, graders: [{ file: "runner", type: "error", weight: 1, score: null, detail: String(e) }], followUps: 0, trace: EMPTY_TRACE }),
    (r) => pct(r.score),
  );
  const fx = await runAll<FixtureResult>(
    "fixture", fixtures, otherRuns, o.parallel, (f) => `fixture__${f.replace(/\//g, "__")}`,
    (f, k) => runFixture(f, k, o),
    (f, k, e) => ({ kind: "fixture", name: f, run: k, agent: FIXTURE_AGENTS[f.split("/")[0]] ?? "?", profile: FIXTURE_PROFILES[f.split("/")[0]] ?? "?", mode: "?", spawned: false, gtCount: 0, recall: null, caught: [], missed: [], verdictOk: null, falsePositives: null, notes: String(e), trace: EMPTY_TRACE }),
    (r) => `recall ${pct(r.recall)}, verdict ${r.verdictOk}`,
  );
  const lv = await runAll<LiveResult>(
    "live", live, otherRuns, Math.min(o.parallel, 2), (l) => `live__${l}`,
    (l, k) => runLive(l, k, o),
    (l, k, e) => ({ kind: "live", name: l, run: k, target: "?", targetKind: "?", passed: null, checkExit: null, checkOutput: String(e), verdictPresent: false, trace: EMPTY_TRACE }),
    (r) => (r.passed == null ? "timeout" : r.passed ? "PASS" : "FAIL"),
  );
  const fixtureResults = fx.results;
  const liveResults = lv.results;
  skipped.push(...fx.skipped, ...lv.skipped);
  const runs = runsLabel;

  let summary = renderSummary(caseResults, fixtureResults, liveResults, o.graderModel, runs);
  if (skipped.length) summary += `\n## Skipped — total budget $${o.totalBudget} reached\n\n${skipped.map((x) => `- ${x}`).join("\n")}\n`;
  const perCase = [...groupBy(caseResults).values()].map((rs) => stats(rs.map((r) => r.score).filter((x): x is number => x != null)).mean).filter((x): x is number => x != null);
  const mean = perCase.length ? perCase.reduce((a, b) => a + b, 0) / perCase.length : null;
  if (perCase.length) summary += `\nMean eval-case score: **${pct(mean)}** over ${perCase.length} case(s), ${runs} run(s) each${o.threshold != null ? ` (threshold ${pct(o.threshold)})` : ""}.\n`;
  writeFileSync(join(o.out, "summary.md"), summary);
  writeFileSync(join(o.out, "summary.json"), JSON.stringify({ runs: o.runs ?? null, cases: caseResults, fixtures: fixtureResults, live: liveResults, skipped, meanCaseScore: mean }, null, 2));
  console.log(summary);
  console.error(`results: ${relative(process.cwd(), o.out)}`);
  if (o.threshold != null) {
    // A gate that reports a pass it never measured is the failure mode this replaces: no score,
    // a budget-truncated suite, or errored runs all fail, not only a low mean.
    const unscored = caseResults.filter((r) => r.score == null).length;
    const reasons: string[] = [];
    if (mean == null) reasons.push("no eval case produced a score");
    if (skipped.length) reasons.push(`${skipped.length} run(s) skipped — total budget $${o.totalBudget} reached before the suite finished`);
    if (unscored) reasons.push(`${unscored} run(s) produced no score (runner or CLI error)`);
    if (mean != null && mean < o.threshold) reasons.push(`mean eval-case score ${pct(mean)} is below the threshold ${pct(o.threshold)}`);
    if (reasons.length) {
      for (const r of reasons) console.error(`FAIL: ${r}`);
      process.exit(1);
    }
  }
}
