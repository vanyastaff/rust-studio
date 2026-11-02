#!/usr/bin/env bun
// Read-only status summary for a /implement-change --plan Markdown table.

import { readFileSync } from "node:fs";

export type TaskState = "todo" | "in-progress" | "done" | "blocked";
export type Task = { id: string; dependsOn: string[]; conflictsWith: string[]; state: TaskState };
export type Summary = { tasks: Task[]; ready: string[]; counts: Record<TaskState, number> };

const usage = `usage: plan-status.ts [--json] <tasks.md>

Read a /implement-change --plan plan and report todo, active, blocked, done, and ready task ids.
This command only reads the Markdown file.`;

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function state(value: string): TaskState {
  const text = value.trim().toLowerCase();
  if (/^(☑|done|complete|completed)$/.test(text)) return "done";
  if (/^(⊘|blocked)$/.test(text)) return "blocked";
  if (/^(◐|in[ -]?progress|active)$/.test(text)) return "in-progress";
  if (/^(☐|todo|to-do|pending)$/.test(text)) return "todo";
  throw new Error(`unknown task status: ${value || "(empty)"}`);
}

const taskId = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
function ids(value: string | undefined): string[] {
  if (!value || /^(—|-|none|n\/a)$/i.test(value.trim())) return [];
  const result = value.trim().split(/[,\s]+/);
  if (result.some((id) => !taskId.test(id))) throw new Error(`invalid task references: ${value}`);
  return [...new Set(result)];
}

export function parsePlan(markdown: string): Task[] {
  const lines = markdown.split(/\r?\n/);
  const header = lines.find((line) => /^\|\s*#\s*\|/.test(line));
  if (!header) throw new Error("no task table headed with '#' found");
  const headings = cells(header).map((cell) => cell.toLowerCase());
  const idIndex = headings.indexOf("#");
  const statusIndex = headings.indexOf("status");
  const dependencyIndex = headings.findIndex((cell) => /depends|blocked by/.test(cell));
  const conflictIndex = headings.findIndex((cell) => /conflicts?/.test(cell));
  if (idIndex < 0 || statusIndex < 0) throw new Error("task table needs '#' and 'Status' columns");

  const separator = cells(lines[lines.indexOf(header) + 1] ?? "");
  if (separator.length !== headings.length || separator.some((cell) => !/^:?-+:?$/.test(cell))) {
    throw new Error("task table needs a Markdown separator row");
  }
  const start = lines.indexOf(header) + 2;
  const tasks: Task[] = [];
  for (const line of lines.slice(start)) {
    if (!line.trimStart().startsWith("|")) break;
    const row = cells(line);
    const id = row[idIndex]?.trim();
    if (row.length !== headings.length || !taskId.test(id ?? "")) {
      throw new Error(`malformed task row: ${line.trim()}`);
    }
    tasks.push({
      id,
      dependsOn: ids(row[dependencyIndex]),
      conflictsWith: ids(row[conflictIndex]),
      state: state(row[statusIndex] ?? ""),
    });
  }
  validatePlan(tasks);
  return tasks;
}

function validatePlan(tasks: Task[]): void {
  if (tasks.length === 0) throw new Error("task table is empty");
  const byId = new Map<string, Task>();
  for (const task of tasks) {
    if (byId.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    byId.set(task.id, task);
  }
  for (const task of tasks) {
    for (const id of [...task.dependsOn, ...task.conflictsWith]) {
      if (id === task.id) throw new Error(`task ${task.id} references itself`);
      if (!byId.has(id)) throw new Error(`task ${task.id} references unknown task ${id}`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`dependency cycle at task ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)!.dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of tasks) visit(task.id);
}

export function summarize(tasks: Task[]): Summary {
  validatePlan(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const counts: Record<TaskState, number> = { todo: 0, "in-progress": 0, done: 0, blocked: 0 };
  for (const task of tasks) counts[task.state]++;
  // A conflict is mutual exclusion, not a dependency. Pick a deterministic batch
  // in table order, considering declarations from either side and active tasks.
  const reserved = tasks.filter((task) => task.state === "in-progress");
  const ready: string[] = [];
  for (const task of tasks) {
    if (task.state !== "todo" || !task.dependsOn.every((id) => byId.get(id)?.state === "done")) continue;
    if (reserved.some((other) => task.conflictsWith.includes(other.id) || other.conflictsWith.includes(task.id))) continue;
    ready.push(task.id);
    reserved.push(task);
  }
  return { tasks, ready, counts };
}

function main(argv: string[]): number {
  if (argv[0] === "--help" || argv[0] === "-h") {
    console.log(usage);
    return 0;
  }
  const json = argv[0] === "--json";
  const file = argv[json ? 1 : 0];
  if (!file || argv.length !== (json ? 2 : 1)) {
    console.log(usage);
    return file ? 2 : 0;
  }
  try {
    const summary = summarize(parsePlan(readFileSync(file, "utf8")));
    if (json) console.log(JSON.stringify(summary));
    else {
      const { counts, ready, tasks } = summary;
      console.log(`tasks: ${tasks.length} | todo: ${counts.todo} | active: ${counts["in-progress"]} | blocked: ${counts.blocked} | done: ${counts.done}`);
      console.log(`ready: ${ready.join(", ") || "none"}`);
    }
    return 0;
  } catch (error) {
    console.error(`plan-status: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
