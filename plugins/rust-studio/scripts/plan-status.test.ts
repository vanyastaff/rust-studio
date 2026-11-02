import { expect, test } from "bun:test";
import { parsePlan, summarize } from "./plan-status.ts";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

function table(rows: string): string {
  return `| # | Depends on | Conflicts with | Status |\n|---|---|---|---|\n${rows}\n`;
}

for (const [label, rows] of [
  ["unknown dependency", "| 1 | E34 | — | ☐ |"],
  ["unknown status", "| 1 | — | — | maybe |"],
  ["duplicate ids", "| 1 | — | — | ☐ |\n| 1 | — | — | ☑ |"],
  ["cycle", "| 1 | 2 | — | ☐ |\n| 2 | 1 | — | ☐ |"],
  ["unknown conflict", "| 1 | — | 9 | ☐ |"],
  ["malformed row", "| 1 | — | ☐ |"],
  ["self dependency", "| 1 | 1 | — | ☐ |"],
  ["empty table", ""],
] as const) {
  test(`public CLI rejects ${label} without reporting readiness`, () => {
    const dir = mkdtempSync(join(tmpdir(), "plan-status-"));
    try {
      const file = join(dir, "tasks.md");
      writeFileSync(file, table(rows));
      const result = Bun.spawnSync([process.execPath, fileURLToPath(new URL("./plan-status.ts", import.meta.url)), "--json", file]);
      expect(result.exitCode).toBe(2);
      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toContain("plan-status:");
      expect(readFileSync(file, "utf8")).toBe(table(rows));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test("symmetric conflicts select a stable non-overlapping ready batch", () => {
  expect(summarize(parsePlan(table("| A1 | — | B2 | ☐ |\n| B2 | — | A1 | ☐ |"))).ready).toEqual(["A1"]);
});

test("active conflicts block either direction, dependencies still wait for done", () => {
  expect(summarize(parsePlan(table("| A1 | — | — | ☐ |\n| B2 | — | A1 | ◐ |\n| C3 | B2 | — | ☐ |"))).ready).toEqual([]);
});

test("rejects a missing table separator rather than dropping the first task", () => {
  expect(() => parsePlan("| # | Status |\n| 1 | ☐ |\n| 2 | ☐ |\n")).toThrow("separator");
});
