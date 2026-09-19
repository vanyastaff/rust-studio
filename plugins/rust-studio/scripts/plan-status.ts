#!/usr/bin/env bun
// Read-only status summary for a /spec-tasks Markdown table.

import { readFileSync } from "node:fs";

export type TaskState = "todo" | "in-progress" | "done" | "blocked";
export type Task = { id: string; dependsOn: string[]; conflictsWith: string[]; state: TaskState };
export type Summary = { tasks: Task[]; ready: string[]; counts: Record<TaskState, number> };

const usage = `usage: plan-status.ts [--json] <tasks.md>

Read a /spec-tasks plan and report todo, active, blocked, done, and ready task ids.
This command only reads the Markdown file.`;

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function state(value: string): TaskState {
  const text = value.toLowerCase();
  if (value.includes("☑") || /\bdone\b|\bcomplete/.test(text)) return "done";
  if (value.includes("⊘") || /\bblocked\b/.test(text)) return "blocked";
  if (value.includes("◐") || /\bin[ -]?progress\b|\bactive\b/.test(text)) return "in-progress";
  return "todo";
}

function ids(value: string | undefined): string[] {
  if (!value || /^(—|-|none|n\/a)$/i.test(value.trim())) return [];
  return [...value.matchAll(/\b\d+\b/g)].map((match) => match[0]);
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

  const start = lines.indexOf(header) + 2;
  const tasks: Task[] = [];
  for (const line of lines.slice(start)) {
    if (!line.startsWith("|")) break;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    const row = cells(line);
    const id = row[idIndex]?.trim();
    if (!/^\d+$/.test(id ?? "")) continue;
    tasks.push({
      id,
      dependsOn: ids(row[dependencyIndex]),
      conflictsWith: ids(row[conflictIndex]),
      state: state(row[statusIndex] ?? ""),
    });
  }
  return tasks;
}

export function summarize(tasks: Task[]): Summary {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const counts: Record<TaskState, number> = { todo: 0, "in-progress": 0, done: 0, blocked: 0 };
  for (const task of tasks) counts[task.state]++;
  const ready = tasks.filter((task) => task.state === "todo" &&
    task.dependsOn.every((id) => byId.get(id)?.state === "done") &&
    task.conflictsWith.every((id) => byId.get(id)?.state === "done"))
    .map((task) => task.id);
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
