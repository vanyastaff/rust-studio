#!/usr/bin/env bun
// Rust Code Studio — sub-agent brief (SubagentStart; payload and output verified on Claude Code 2.1.261).
//
// A sub-agent starts from an EMPTY window. It never saw the session-start briefing, the
// project gate the orchestrator discovered, or the memory index the host loaded for the
// main thread — and the orchestrator's spawn prompt restates only what it remembers to.
// Measured on real sessions, that gap is where the studio's own rules go unenforced:
// `rust-builder` ran `cargo clippy --all-features` on a workspace whose `justfile` lints
// default features (docs/project-gate.md), because nothing in its window said a gate
// existed. This hook closes the gap with FACTS the session already holds, in a handful of
// lines, once per sub-agent — never a second copy of the doctrine the agent brief carries.
//
// Mechanism: SubagentStart delivers `{agent_id, agent_type, cwd, session_id}` and honors
// `hookSpecificOutput.additionalContext` (verified in the 2.1.261 bundle's hook output
// schema). Roster-gated like SubagentStop: built-in agents (Explore, Plan, general-purpose,
// …) are the host's business and get nothing. Read-only, no child processes, fails open —
// any error exits 0 with no output.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readInput, emit, done, watchdog, option, pluginRoot } from "./_lib.ts";
import { summarizeManifest, type ManifestSummary } from "./cargo-manifest.ts";
import { BUILTIN_DENY, normalizeAgentType, studioRoster } from "./subagent-stop.ts";
import { readIndex, resolveStore } from "./memory-store.ts";

/** Gate files in docs/project-gate.md's discovery order. Presence is reported, never run:
 *  a hook must not execute a recipe, and the agent has to read the body anyway. */
const GATE_FILES: Array<[string, string]> = [
  ["justfile", "justfile"],
  [".justfile", ".justfile"],
  ["Justfile", "Justfile"],
  ["Makefile", "Makefile"],
  ["Makefile.toml", "Makefile.toml (cargo-make)"],
  ["lefthook.yml", "lefthook.yml"],
  [".lefthook.yml", ".lefthook.yml"],
  [".pre-commit-config.yaml", ".pre-commit-config.yaml"],
  [".gitlab-ci.yml", ".gitlab-ci.yml"],
];

/** Which gate mechanisms exist at `cwd`, as short labels. Empty means "no gate found". */
export function gateCandidates(cwd: string): string[] {
  const found: string[] = [];
  for (const [file, label] of GATE_FILES) {
    try {
      if (statSync(join(cwd, file)).isFile()) found.push(label);
    } catch {
      /* absent */
    }
  }
  try {
    if (statSync(join(cwd, "xtask", "Cargo.toml")).isFile()) found.push("xtask/ (cargo xtask)");
  } catch {
    /* absent */
  }
  try {
    const wf = join(cwd, ".github", "workflows");
    const ymls = readdirSync(wf).filter((f) => /\.ya?ml$/.test(f)).sort();
    if (ymls.length) found.push(`.github/workflows/ (${ymls.slice(0, 4).join(", ")}${ymls.length > 4 ? ", …" : ""})`);
  } catch {
    /* absent */
  }
  return found;
}

/** Does this agent get a studio brief? Same gate as the verdict check: roster agents only. */
export function wantsBrief(agentType: string | undefined, roster: Set<string> | null): boolean {
  const n = normalizeAgentType(agentType);
  if (!n) return false; // no type → cannot tell; a wrong brief costs more than a missing one
  if (BUILTIN_DENY.has(n)) return false;
  if (roster && roster.size) return roster.has(n);
  return false;
}

export interface BriefInput {
  agentType: string;
  cwd: string;
  manifest: ManifestSummary | null;
  gates: string[];
  memory: { dir: string; notes: number } | null;
  gateIntensity: string;
  testRunner: string;
  docsDir: string;
  /** The plugin's `default_msrv` option, applied when the manifest declares no `rust-version`
   *  — the same fallback the session brief shows, so the two briefs agree. */
  msrvDefault?: string | null;
}

/** The brief. Facts only — the agent's own file carries the doctrine. */
export function buildBrief(b: BriefInput): string {
  const lines: string[] = [];
  lines.push(
    `Rust Code Studio — brief for \`${b.agentType}\` (you start with an empty window; these are facts the session already established):`,
  );
  if (b.manifest) {
    const m = b.manifest;
    const ws = m.isWorkspace ? ` (workspace, ${m.members} member globs)` : "";
    lines.push(
      `- Project: **${m.name}**${ws} at \`${b.cwd}\` · edition ${m.edition} · MSRV ${m.msrv ?? (b.msrvDefault ? `${b.msrvDefault} (studio default)` : "(unset)")} · domain(s): ${m.domains.join(", ")}.`,
    );
  } else {
    lines.push(`- No \`Cargo.toml\` at \`${b.cwd}\` — if the crate lives in a subdirectory, work from there.`);
  }
  if (b.gates.length) {
    lines.push(
      `- **Project gate found:** ${b.gates.map((g) => `\`${g}\``).join(", ")}. Read the recipe body and run *that* — with its exact features, env, and every invocation it makes — before any \`cargo\` default; a green under other flags is an \`Off-gate green\` (\`${b.docsDir}/project-gate.md\`).`,
    );
  } else {
    lines.push(
      `- **No project gate found** (no justfile / Makefile / xtask / cargo-make / lefthook / CI workflow at the root). Studio defaults apply — say so next to your evidence (\`${b.docsDir}/project-gate.md\`).`,
    );
  }
  lines.push(
    `- Studio config: gate intensity **${b.gateIntensity}**, test runner **${b.testRunner}**. Path-scoped standards arrive as pointers the first time you touch a matching file — read the rule before you shape the edit.`,
  );
  if (b.memory) {
    lines.push(
      `- Project memory: ${b.memory.notes} note(s) in \`${b.memory.dir}\` — read \`MEMORY.md\` there before re-deriving a decision in a known area; surface anything durable you settle on a \`MEMORY:\` line, never write the store yourself.`,
    );
  }
  lines.push(
    "- Finish with your deliverable in full, then one verdict line (COMPLETE / NEEDS WORK / REDO-TO-BAR / BLOCKED; pre-code ACCEPTABLE / RESHAPE NEEDED) and the exact command behind each claim.",
  );
  return lines.join("\n");
}

interface Input {
  session_id?: string;
  cwd?: string;
  agent_id?: string;
  agent_type?: string;
}

if (import.meta.main) {
  const disarm = watchdog(6_000);
  const data = await readInput<Input>();

  try {
    const roster = studioRoster(join(pluginRoot(), "agents"));
    if (!wantsBrief(data.agent_type, roster)) {
      disarm();
      done();
    }
    const cwd = data.cwd || process.cwd();
    let memory: BriefInput["memory"] = null;
    try {
      const store = resolveStore(cwd);
      if (store.exists) {
        const index = readIndex(store.dir);
        const notes = index?.entries.length ?? 0;
        if (notes) memory = { dir: store.dir.replace(/\\/g, "/"), notes };
      }
    } catch {
      memory = null;
    }
    const brief = buildBrief({
      agentType: normalizeAgentType(data.agent_type),
      cwd,
      manifest: summarizeManifest(cwd),
      msrvDefault: option("default_msrv"),
      gates: gateCandidates(cwd),
      memory,
      gateIntensity: option("gate_intensity") || "full",
      testRunner: option("test_runner") || "nextest",
      docsDir: join(pluginRoot(), "docs").replace(/\\/g, "/"),
    });
    disarm();
    emit({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: brief,
      },
    });
  } catch {
    disarm();
    done(); // fail open: a missing brief is cheaper than a broken spawn
  }
}
