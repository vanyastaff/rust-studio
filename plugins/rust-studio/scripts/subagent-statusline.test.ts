// Tests for the sub-agent status line renderer. Behavior-asserting and able to fail.
import { test, expect, describe } from "bun:test";
import { rowContent, renderRows } from "./subagent-statusline.ts";

const NOW = 1_000_000_000_000;

describe("rowContent", () => {
  test("running task: ● glyph, type, description, elapsed, tokens", () => {
    const c = rowContent(
      { id: "1", type: "rust-builder", status: "running", description: "implement X", startTime: NOW - 65_000, tokenCount: 12_345 },
      200,
      NOW,
    );
    expect(c.startsWith("●")).toBe(true);
    expect(c).toContain("rust-builder");
    expect(c).toContain("implement X");
    expect(c).toContain("1m5s");
    expect(c).toContain("12k");
  });

  test("completed task uses ✓", () => {
    expect(rowContent({ id: "2", type: "rust-reviewer", status: "completed" }, 200, NOW).startsWith("✓")).toBe(true);
  });

  test("unknown status falls back to ≡", () => {
    expect(rowContent({ id: "3", type: "x", status: "weird" }, 200, NOW).startsWith("≡")).toBe(true);
  });

  test("truncates to the column width with an ellipsis", () => {
    const c = rowContent({ id: "4", type: "agent", status: "running", description: "x".repeat(200) }, 40, NOW);
    expect(c.length).toBeLessThanOrEqual(40);
    expect(c.endsWith("…")).toBe(true);
  });

  test("small token counts render as Ntok, not k", () => {
    expect(rowContent({ id: "5", type: "a", status: "running", tokenCount: 250 }, 200, NOW)).toContain("250tok");
  });
});

describe("renderRows", () => {
  test("one JSON {id,content} line per task with an id; skips id-less rows", () => {
    const rows = renderRows(
      { columns: 120, tasks: [{ id: "a", type: "t", status: "running" }, { type: "noId" }, { id: "b", status: "completed" }] },
      NOW,
    );
    expect(rows.length).toBe(2);
    const first = JSON.parse(rows[0]);
    expect(first.id).toBe("a");
    expect(typeof first.content).toBe("string");
  });

  test("no tasks → no rows", () => {
    expect(renderRows({}, NOW)).toEqual([]);
  });
});
