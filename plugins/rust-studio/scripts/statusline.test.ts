// Tests for the rich main status line. Behavior-asserting and able to fail. Color is disabled
// (NO_COLOR) for stable content assertions; one test re-enables it to check escapes are emitted.
import { test, expect, describe, beforeAll } from "bun:test";
import {
  stripModel,
  bar,
  phaseBar,
  fmtDuration,
  gitText,
  byPct,
  freshProgress,
  effortLabel,
  cacheHitPct,
  render,
} from "./statusline.ts";

beforeAll(() => {
  process.env.NO_COLOR = "1";
});

const NOW = 1_000_000_000_000;

describe("stripModel", () => {
  test("strips a (… context) suffix", () => expect(stripModel("Opus 4.8 (1M context)")).toBe("Opus 4.8"));
  test("strips a [1m] suffix", () => expect(stripModel("claude-opus-4-8 [1m]")).toBe("claude-opus-4-8"));
  test("leaves a clean name", () => expect(stripModel("Sonnet 4")).toBe("Sonnet 4"));
});

describe("bar", () => {
  test("40% of 10 cells → 4 filled, fixed width", () => {
    const b = bar(40, 10);
    expect([...b].filter((ch) => ch === "█").length).toBe(4);
    expect(b.length).toBe(10);
  });
  test("clamps over and under", () => {
    expect(bar(200, 10)).toBe("█".repeat(10));
    expect(bar(-5, 10)).toBe("░".repeat(10));
  });
});

describe("phaseBar", () => {
  test("2/4 → 2 of 4 filled, fixed width", () => {
    const b = phaseBar("2/4", 4);
    expect(b.length).toBe(4);
    expect([...b].filter((c) => c === "▰").length).toBe(2);
  });
  test("unparseable step → empty", () => expect(phaseBar("build")).toBe(""));
});

describe("fmtDuration", () => {
  test("seconds / minutes / hours", () => {
    expect(fmtDuration(45_000)).toBe("45s");
    expect(fmtDuration(12 * 60_000)).toBe("12m");
    expect(fmtDuration(83 * 60_000)).toBe("1h23m");
  });
  test("zero → empty (smart-hide)", () => expect(fmtDuration(0)).toBe(""));
});

describe("gitText", () => {
  test("branch + dirty + ahead + behind", () =>
    expect(gitText({ branch: "main", dirty: 3, ahead: 2, behind: 1 })).toBe("main ●3 ↑2 ↓1"));
  test("clean branch → name only", () => expect(gitText({ branch: "main", dirty: 0 })).toBe("main"));
  test("no branch → empty", () => expect(gitText({})).toBe(""));
});

describe("byPct color toggling", () => {
  test("NO_COLOR returns the string unchanged", () => expect(byPct(90, "x")).toBe("x"));
  test("with color enabled, wraps in an ANSI escape", () => {
    delete process.env.NO_COLOR;
    const out = byPct(90, "x");
    process.env.NO_COLOR = "1";
    expect(out).not.toBe("x");
    expect(out).toContain("\x1b[");
  });
});

describe("effortLabel", () => {
  test("known level → think:<level>", () => {
    expect(effortLabel("high")).toBe("think:high");
    expect(effortLabel("xhigh")).toBe("think:xhigh");
  });
  test("unknown or empty → empty (smart-hide)", () => {
    expect(effortLabel("turbo")).toBe("");
    expect(effortLabel(undefined)).toBe("");
  });
});

describe("cacheHitPct", () => {
  test("read / (read + input) as a percentage", () => {
    expect(cacheHitPct({ cache_read_input_tokens: 7200, input_tokens: 2800 })).toBe(72);
  });
  test("no usage or zero denominator → null", () => {
    expect(cacheHitPct(undefined)).toBeNull();
    expect(cacheHitPct({ cache_read_input_tokens: 0, input_tokens: 0 })).toBeNull();
  });
});

describe("freshProgress", () => {
  test("accepts fresh", () => expect(freshProgress({ phase: "build", ts: NOW - 1000 }, NOW)?.phase).toBe("build"));
  test("rejects stale (>1h)", () => expect(freshProgress({ phase: "build", ts: NOW - 7_200_000 }, NOW)).toBeNull());
  test("rejects missing phase", () => expect(freshProgress({ ts: NOW }, NOW)).toBeNull());
});

describe("render (two-line rounded layout)", () => {
  const session = {
    model: { display_name: "Opus 4.8 (1M context)" },
    context_window: { used_percentage: 41, current_usage: { cache_read_input_tokens: 7200, input_tokens: 2800 } },
    effort: { level: "xhigh" },
    workspace: { current_dir: "/home/u/rust-studio" },
    cost: { total_duration_ms: 12 * 60_000, total_lines_added: 318, total_lines_removed: 15 },
  };

  test("identity line + metrics line with rounded caps", () => {
    const out = render(session, { phase: "build", step: "2/4", tasks: "5/8" }, { git: { branch: "main", dirty: 2, ahead: 1 }, lspInRust: true });
    const lines = out.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("╭─");
    expect(lines[0]).toContain("🦀 "); // studio tag (rust project)
    expect(lines[0]).toContain("rust-studio"); // tag + project basename
    expect(lines[0]).toContain("main"); // git branch
    expect(lines[0]).toContain("Opus 4.8"); // stripped model
    expect(lines[0]).toContain("think:xhigh"); // effort
    expect(lines[1]).toContain("╰─");
    expect(lines[1]).toContain("41%"); // context (icon replaces the "ctx" label by default)
    expect(lines[1]).toContain("72%"); // prompt-cache hit
    expect(lines[1]).toContain("build"); // phase
    expect(lines[1]).toContain("5/8"); // tasks
    expect(lines[1]).toContain("12m"); // duration
    expect(lines[1]).toContain("+318"); // lines added
  });

  test("collapses to a single line when there are no metrics; crab always shown", () => {
    const out = render({ model: { display_name: "Opus" } }, null, {});
    expect(out.split("\n").length).toBe(1);
    expect(out).toContain("╭─");
    expect(out).toContain("🦀"); // studio tag always present, even outside a Rust project
  });
});

describe("powerline rendering (Tokyo Night)", () => {
  test("with color + nerd + powerline on, emits arrow caps and truecolor backgrounds", () => {
    delete process.env.NO_COLOR; // enable color → powerline path
    const out = render({ model: { display_name: "Opus" }, context_window: { used_percentage: 30 } }, null, { git: { branch: "main" } });
    process.env.NO_COLOR = "1"; // restore for the rest of the suite
    expect(out).toContain(""); // powerline right cap
    expect(out).toContain("\x1b[48;2;"); // truecolor background (theme segment)
    expect(out).toContain("rust-studio");
  });
});
