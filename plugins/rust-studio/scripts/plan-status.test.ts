import { expect, test } from "bun:test";
import { parsePlan, summarize } from "./plan-status.ts";

const plan = `# Tasks

| # | Outcome | Expected paths | Depends on | Conflicts with | Acceptance | Status |
|---|---------|----------------|------------|----------------|------------|--------|
| 1 | foundation | \`src/lib.rs\` | — | — | test | ☑ |
| 2 | consumer | \`src/api.rs\` | 1 | — | test | ☐ |
| 3 | alternate | \`src/lib.rs\` | — | 2 | test | ☐ |
| 4 | paused | \`src/db.rs\` | 2 | — | test | ⊘ |
`;

test("finds ready tasks from dependencies and declared conflicts", () => {
  const summary = summarize(parsePlan(plan));
  expect(summary.counts).toEqual({ todo: 2, "in-progress": 0, done: 1, blocked: 1 });
  expect(summary.ready).toEqual(["2"]);
});

test("requires the task-table headers", () => {
  expect(() => parsePlan("# Notes\n")).toThrow("no task table");
});
