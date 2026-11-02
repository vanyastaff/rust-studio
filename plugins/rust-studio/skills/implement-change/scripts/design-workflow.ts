#!/usr/bin/env bun
// Read-only artifact resolution and preparation of a cold implementation handoff.
import { realpathSync } from "node:fs";
import { posix, relative, resolve, sep } from "node:path";
import { resolveDesign } from "./design-paths.ts";
import { parsePlan } from "./plan-status.ts";
import { capturePacket, checkPacket, loadPacket, parsePacket, type Packet } from "./review-packet.ts";

type Brief = {
  version: 1; task: string; mode: "start" | "resume"; goal: string;
  context: string; request: string; designReview: string; authorization: string;
  writePaths: string[]; acceptance: string[]; constraints: string[]; sources: string[];
  resumeEvidence?: string;
};
type Handoff = Packet & { status: "PREPARED"; handoff: { task: string; mode: Brief["mode"]; brief: string } };

const usage = `usage:
  design-workflow.ts resolve <root> <slug-or-spec-path>
  design-workflow.ts prepare <root> <slug-or-spec-path> <brief.json>
  design-workflow.ts check <root> <packet.json>

Paths are relative to root, or explicit absolute paths. Brief fields use repository-relative
forward-slash paths. prepare requires a reserved in-progress task, satisfied dependencies
and no declared active conflicts. It emits a PREPARED packet to stdout and writes nothing.
check exits 0 for CURRENT bytes, 1 for STALE, 2 for invalid input. PREPARED/CURRENT do not
prove authorization, actual write-set independence, prerequisite evidence or review quality.`;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function path(value: unknown): value is string {
  return nonempty(value) && !/[\\:\x00-\x1f*?]/.test(value)
    && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

function strings(value: unknown, allowEmpty = false): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(nonempty);
}

function parseBrief(value: unknown): Brief {
  if (!record(value) || value.version !== 1 || !nonempty(value.task)
      || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value.task)
      || !["start", "resume"].includes(String(value.mode)) || !nonempty(value.goal)
      || !nonempty(value.authorization) || !path(value.context) || !path(value.request)
      || !path(value.designReview) || !strings(value.writePaths) || !value.writePaths.every(path)
      || !strings(value.acceptance) || !strings(value.constraints)
      || !strings(value.sources, true) || !value.sources.every(path)) {
    throw new Error("invalid handoff brief: task, mode, goal, evidence paths, authorization, ownership and acceptance are required");
  }
  if (new Set(value.writePaths).size !== value.writePaths.length) throw new Error("duplicate write ownership");
  if (value.mode === "resume" && !nonempty(value.resumeEvidence)) throw new Error("resume requires current execution evidence and retained repair history");
  return value as Brief;
}

function requiredFiles(spec: string, briefPath: string, brief: Brief): string[] {
  return [...new Set([spec, posix.join(posix.dirname(spec), "tasks.md"), briefPath,
    brief.context, brief.request, brief.designReview, ...brief.sources])];
}

function validateHandoff(value: unknown): Handoff {
  const packet = parsePacket(value);
  if (!record(value) || value.status !== "PREPARED" || !record(value.handoff) || !path(value.handoff.brief)) {
    throw new Error("not a prepared implementation handoff");
  }
  const content = new Map(packet.files.map(file => [file.path, file.content]));
  const brief = parseBrief(JSON.parse(content.get(value.handoff.brief) ?? "null"));
  if (value.handoff.task !== brief.task || value.handoff.mode !== brief.mode) throw new Error("handoff metadata differs from the captured brief");
  for (const name of requiredFiles(packet.document, value.handoff.brief, brief)) {
    if (!content.has(name)) throw new Error(`missing handoff evidence: ${name}`);
  }
  const planPath = posix.join(posix.dirname(packet.document), "tasks.md");
  const tasks = parsePlan(content.get(planPath)!);
  const task = tasks.find(task => task.id === brief.task);
  if (!task || task.state !== "in-progress") throw new Error("reserve the selected task as in-progress before preparing its handoff");
  if (task.dependsOn.some(id => tasks.find(task => task.id === id)!.state !== "done")) {
    throw new Error("task has unfinished prerequisites");
  }
  if (tasks.some(other => other.id !== task.id && other.state === "in-progress"
      && (task.conflictsWith.includes(other.id) || other.conflictsWith.includes(task.id)))) {
    throw new Error("task conflicts with another active task");
  }
  return value as Handoff;
}

function prepare(root: string, designInput: string, briefInput: string): Handoff {
  const design = resolveDesign(root, designInput);
  const briefPath = relative(root, resolve(root, briefInput)).split(sep).join("/");
  if (!path(briefPath)) throw new Error("brief must be inside the repository root");
  // Read through the same bounded, text-only path as every other inventoried input.
  const brief = parseBrief(JSON.parse(capturePacket(root, [briefPath]).files[0].content));
  const packet = capturePacket(root, requiredFiles(design.spec, briefPath, brief));
  // Validate captured bytes, not an earlier read: a changed brief/plan must not bypass checks.
  return validateHandoff({ ...packet, status: "PREPARED",
    handoff: { task: brief.task, mode: brief.mode, brief: briefPath } });
}

function main(args: string[]): number {
  if (args.length === 1 && ["-h", "--help"].includes(args[0])) { console.log(usage); return 0; }
  const [command, rootArg, input, brief] = args;
  if (!rootArg || !input || !["resolve", "prepare", "check"].includes(command)
      || args.length !== (command === "prepare" ? 4 : 3)) { console.error(usage); return 2; }
  try {
    const root = realpathSync(resolve(rootArg));
    if (command === "resolve") console.log(JSON.stringify(resolveDesign(root, input)));
    else if (command === "prepare") console.log(JSON.stringify(prepare(root, input, brief), null, 2));
    else {
      const packet = validateHandoff(loadPacket(resolve(root, input)));
      const result = checkPacket(root, packet);
      console.log(JSON.stringify(result));
      return result.status === "CURRENT" ? 0 : 1;
    }
    return 0;
  } catch (error) {
    console.error(`design-workflow: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
