// Tests for the main status line renderer. Behavior-asserting and able to fail.
import { test, expect, describe } from "bun:test";
import { render, freshProgress } from "./statusline.ts";

const NOW = 1_000_000_000_000;
const session = {
  model: { display_name: "Opus" },
  context_window: { used_percentage: 42.6 },
  workspace: { current_dir: "/home/u/myproj" },
};

describe("render", () => {
  test("shows the studio tag, project, model, and rounded context %", () => {
    const s = render(session, null);
    expect(s).toContain("rust-studio");
    expect(s).toContain("myproj");
    expect(s).toContain("Opus");
    expect(s).toContain("ctx 43%");
  });

  test("shows the live phase + step when progress is present", () => {
    const s = render(session, { phase: "build", step: "2/4" });
    expect(s).toContain("▸ build 2/4");
  });

  test("omits the phase segment when no progress", () => {
    expect(render(session, null)).not.toContain("▸");
  });
});

describe("freshProgress", () => {
  test("accepts a fresh progress object", () => {
    expect(freshProgress({ phase: "x", ts: NOW - 1000 }, NOW)?.phase).toBe("x");
  });
  test("rejects a stale progress file (> 1h old)", () => {
    expect(freshProgress({ phase: "x", ts: NOW - 7_200_000 }, NOW)).toBeNull();
  });
  test("rejects an object with no phase", () => {
    expect(freshProgress({ ts: NOW }, NOW)).toBeNull();
  });
  test("rejects nullish input", () => {
    expect(freshProgress(null, NOW)).toBeNull();
  });
});
