// Tests for the rich main status line. Behavior-asserting and able to fail. Color is disabled
// (NO_COLOR) for stable content assertions; one test re-enables it to check escapes are emitted.
import { test, expect, describe, beforeAll } from "bun:test";
import {
  stripModel,
  bar,
  phaseBar,
  fmtDuration,
  fmtTokens,
  fmtResetIn,
  gitText,
  byPct,
  freshProgress,
  effortLabel,
  cacheHitPct,
  cacheHitFromSession,
  missCause,
  rateText,
  prText,
  prColor,
  scopeText,
  alertSlot,
  updateBurn,
  burnRate,
  sparkline,
  displayWidth,
  tierFor,
  osc8,
  truncate,
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
  test("past a day, collapses to days (7d rate windows stay readable)", () => {
    expect(fmtDuration(50 * 3_600_000)).toBe("2d");
  });
  test("zero → empty (smart-hide)", () => expect(fmtDuration(0)).toBe(""));
});

describe("fmtTokens", () => {
  test("scales to k and M", () => {
    expect(fmtTokens(840)).toBe("840");
    expect(fmtTokens(2100)).toBe("2.1k");
    expect(fmtTokens(45_000)).toBe("45k");
    expect(fmtTokens(1_500_000)).toBe("1.5M");
  });
});

describe("fmtResetIn", () => {
  test("epoch SECONDS in the future → countdown", () => {
    expect(fmtResetIn(NOW / 1000 + 3600, NOW)).toBe("1h0m");
  });
  test("already elapsed or absent → empty", () => {
    expect(fmtResetIn(NOW / 1000 - 10, NOW)).toBe("");
    expect(fmtResetIn(undefined, NOW)).toBe("");
  });
});

describe("gitText", () => {
  test("branch + dirty + ahead + behind", () =>
    expect(gitText({ branch: "main", dirty: 3, ahead: 2, behind: 1 })).toBe("main ●3 ↑2 ↓1"));
  test("clean branch → name only", () => expect(gitText({ branch: "main", dirty: 0 })).toBe("main"));
  test("no branch → empty", () => expect(gitText({})).toBe(""));
  test("truncates a long branch when a budget is given", () => {
    expect(gitText({ branch: "feat/v0.39.0-research-driven-hardening" }, 14)).toBe("feat/v0.39.0-…");
  });
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

describe("cacheHitFromSession", () => {
  test("prefers the harness prompt_cache hit ratio when present", () => {
    const session = {
      prompt_cache: { hit_ratio: 0.91, warm: true },
      context_window: { current_usage: { cache_read_input_tokens: 10, input_tokens: 90 } },
    };
    expect(cacheHitFromSession(session)).toBe(91);
  });
  test("falls back to the token split on older Claude Code", () => {
    const session = { context_window: { current_usage: { cache_read_input_tokens: 7200, input_tokens: 2800 } } };
    expect(cacheHitFromSession(session)).toBe(72);
  });
  test("nothing known yields null (segment hidden)", () => {
    expect(cacheHitFromSession({})).toBeNull();
  });
});

describe("missCause", () => {
  test("humanizes the harness cause list", () => {
    expect(missCause({ last_miss_cause: { causes: ["tools_added"] } })).toBe("tools added");
  });
  test("keeps at most two causes", () => {
    expect(missCause({ last_miss_cause: { causes: ["a", "b", "c"] } })).toBe("a, b");
  });
  test("absent attribution → empty", () => {
    expect(missCause({})).toBe("");
    expect(missCause({ last_miss_cause: null })).toBe("");
  });
});

describe("rateText", () => {
  test("percentage plus a reset countdown when resets_at is present", () => {
    expect(rateText({ used_percentage: 23.5, resets_at: NOW / 1000 + 7200 }, "5h", NOW)).toBe("5h 24% ·2h0m");
  });
  test("percentage alone when the window has no reset time", () => {
    expect(rateText({ used_percentage: 41 }, "7d", NOW)).toBe("7d 41%");
  });
  test("absent window → empty (segment hidden)", () => {
    expect(rateText(undefined, "5h", NOW)).toBe("");
  });
});

describe("prText / prColor", () => {
  test("GitHub pull request with review state", () => {
    expect(prText({ number: 42, review_state: "approved" })).toBe("PR #42 ✓");
    expect(prText({ number: 42, review_state: "changes_requested" })).toBe("PR #42 ✗");
    expect(prText({ number: 42, review_state: "draft" })).toBe("PR #42 ○");
  });
  test("GitLab merge request is numbered with ! (pr.kind === 'mr')", () => {
    expect(prText({ number: 7, kind: "mr", review_state: "pending" })).toBe("MR !7 ·");
  });
  test("no review state → bare number", () => expect(prText({ number: 9 })).toBe("PR #9"));
  test("absent PR → empty", () => {
    expect(prText(undefined)).toBe("");
    expect(prText({ number: 0 })).toBe("");
  });
  test("color tracks review state", () => {
    expect(prColor({ review_state: "approved" })).not.toEqual(prColor({ review_state: "changes_requested" }));
  });
});

describe("scopeText", () => {
  test("names a linked worktree from workspace.git_worktree", () => {
    expect(scopeText({ workspace: { git_worktree: "feature-xyz" } })).toContain("feature-xyz");
  });
  test("prefers an explicit --worktree session name", () => {
    expect(scopeText({ worktree: { name: "my-feature" }, workspace: { git_worktree: "other" } })).toContain("my-feature");
  });
  test("main tree → empty", () => expect(scopeText({ workspace: {} })).toBe(""));
});

describe("alertSlot", () => {
  test("healthy session shows nothing — a calm line is the normal state", () => {
    expect(alertSlot({ prompt_cache: { hit_ratio: 0.93 }, rate_limits: { five_hour: { used_percentage: 20 } } }, NOW)).toBeNull();
  });

  test("degraded cache surfaces with its attributed cause", () => {
    const a = alertSlot({ prompt_cache: { hit_ratio: 0.62, last_miss_cause: { causes: ["tools_added"] } } }, NOW);
    expect(a?.text).toContain("62%");
    expect(a?.text).toContain("tools added");
  });

  test("a healthy cache never occupies the slot", () => {
    expect(alertSlot({ prompt_cache: { hit_ratio: 0.72 } }, NOW)).toBeNull();
  });

  test("a rate limit about to bite outranks cache degradation", () => {
    const a = alertSlot(
      {
        prompt_cache: { hit_ratio: 0.5 },
        rate_limits: { five_hour: { used_percentage: 91, resets_at: NOW / 1000 + 900 } },
      },
      NOW,
    );
    expect(a?.text).toContain("5h 91%");
    expect(a?.text).toContain("15m");
  });

  test("spend_limit outranks every other window", () => {
    const a = alertSlot(
      { rate_limits: { spend_limit: { used_percentage: 95 }, five_hour: { used_percentage: 99 } } },
      NOW,
    );
    expect(a?.text).toContain("spend 95%");
  });

  test("added scope directories fill the slot when nothing is wrong", () => {
    const a = alertSlot({ workspace: { added_dirs: ["/a", "/b"] } }, NOW);
    expect(a?.text).toBe("+2 dirs");
  });
});

describe("burn rate", () => {
  test("counts only newly processed tokens, not cache reads", () => {
    const s = updateBurn(null, { output_tokens: 100, cache_creation_input_tokens: 50, cache_read_input_tokens: 9000 }, NOW);
    expect(s.cum).toBe(150);
    expect(s.samples.length).toBe(1);
  });

  test("an unchanged usage object does not double-count across re-renders", () => {
    const usage = { output_tokens: 100, cache_creation_input_tokens: 0 };
    const a = updateBurn(null, usage, NOW);
    const b = updateBurn(a, usage, NOW + 5000);
    expect(b.cum).toBe(100);
    expect(b.samples.length).toBe(1);
  });

  test("a new response accumulates and samples", () => {
    const a = updateBurn(null, { output_tokens: 100 }, NOW);
    const b = updateBurn(a, { output_tokens: 250 }, NOW + 60_000);
    expect(b.cum).toBe(350);
    expect(b.samples.length).toBe(2);
  });

  test("rate is tokens per minute across the window", () => {
    expect(burnRate([{ t: NOW, cum: 0 }, { t: NOW + 60_000, cum: 600 }])).toBe(600);
  });

  test("too little history → null (segment hidden)", () => {
    expect(burnRate([{ t: NOW, cum: 10 }])).toBeNull();
    expect(burnRate([])).toBeNull();
  });

  test("sparkline shows pace, and needs a few samples first", () => {
    expect(sparkline([{ t: 1, cum: 1 }, { t: 2, cum: 2 }])).toBe("");
    const sp = sparkline([
      { t: 1, cum: 0 },
      { t: 2, cum: 10 },
      { t: 3, cum: 15 },
      { t: 4, cum: 55 },
    ]);
    expect(sp.length).toBe(3);
    expect(sp[2]).toBe("█"); // the biggest delta tops the ramp
  });
});

describe("displayWidth", () => {
  test("ANSI color codes cost no columns", () => {
    expect(displayWidth("\x1b[38;2;1;2;3mabc\x1b[0m")).toBe(3);
  });
  test("an OSC 8 link is measured by its visible text", () => {
    expect(displayWidth(osc8("https://example.com/pull/1", "PR #1"))).toBe(5);
  });
  test("emoji occupy two columns", () => {
    expect(displayWidth("\u{1F980}")).toBe(2);
  });
});

describe("tierFor", () => {
  test("width buckets", () => {
    expect(tierFor(140)).toBe("full");
    expect(tierFor(120)).toBe("full");
    expect(tierFor(100)).toBe("compact");
    expect(tierFor(60)).toBe("micro");
  });
  test("unknown width assumes roomy — never degrade on missing info", () => {
    expect(tierFor(undefined)).toBe("full");
    expect(tierFor(0)).toBe("full");
  });
});

describe("osc8", () => {
  test("wraps http(s) urls in a hyperlink escape", () => {
    expect(osc8("https://example.com", "x")).toContain("\x1b]8;;https://example.com");
  });
  test("refuses any other scheme — a hostile field cannot inject escapes", () => {
    expect(osc8("javascript:alert(1)", "x")).toBe("x");
    expect(osc8("https://e.com/\x1b]8;;evil", "x")).toBe("x");
    expect(osc8(undefined, "x")).toBe("x");
  });
});

describe("truncate", () => {
  test("shortens with an ellipsis", () => expect(truncate("abcdefgh", 5)).toBe("abcd…"));
  test("leaves a short string alone", () => expect(truncate("abc", 5)).toBe("abc"));
});

describe("render (full tier, two-line rounded layout)", () => {
  const session = {
    model: { display_name: "Opus 4.8 (1M context)" },
    context_window: { used_percentage: 41, current_usage: { cache_read_input_tokens: 7200, input_tokens: 2800 } },
    effort: { level: "xhigh" },
    workspace: { current_dir: "/home/u/rust-studio" },
    cost: { total_duration_ms: 12 * 60_000, total_lines_added: 318, total_lines_removed: 15, total_cost_usd: 8.42 },
    pr: { number: 42, url: "https://github.com/o/r/pull/42", review_state: "approved" },
    rate_limits: { five_hour: { used_percentage: 23, resets_at: NOW / 1000 + 7200 } },
  };

  test("identity line + metrics line with rounded caps", () => {
    const out = render(session, { phase: "build", step: "2/4", tasks: "5/8" }, {
      git: { branch: "main", dirty: 2, ahead: 1 },
      lspInRust: true,
      now: NOW,
    });
    const lines = out.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("╭─");
    expect(lines[0]).toContain("🦀 "); // studio tag
    expect(lines[0]).toContain("rust-studio"); // project basename
    expect(lines[0]).toContain("main"); // git branch
    expect(lines[0]).toContain("Opus 4.8"); // stripped model
    expect(lines[0]).toContain("think:xhigh"); // effort
    expect(lines[0]).toContain("PR #42 ✓"); // pull request with review state
    expect(lines[1]).toContain("╰─");
    expect(lines[1]).toContain("41%"); // context
    expect(lines[1]).toContain("build"); // phase
    expect(lines[1]).toContain("5/8"); // tasks
    expect(lines[1]).toContain("5h 23%"); // rate limit
    expect(lines[1]).toContain("2h0m"); // …with its reset countdown
    expect(lines[1]).toContain("$8.42"); // session cost
    expect(lines[1]).toContain("12m"); // duration
    expect(lines[1]).toContain("+318"); // lines added
  });

  test("a healthy cache takes no width — the alert slot stays empty", () => {
    const out = render(session, null, { now: NOW });
    expect(out).not.toContain("72%");
  });

  test("a degraded cache claims the alert slot", () => {
    const out = render({ ...session, prompt_cache: { hit_ratio: 0.55, last_miss_cause: { causes: ["tools_added"] } } }, null, { now: NOW });
    expect(out).toContain("55%");
    expect(out).toContain("tools added");
  });

  test("the PR url is emitted as a clickable OSC 8 link", () => {
    const out = render(session, null, { now: NOW });
    expect(out).toContain("\x1b]8;;https://github.com/o/r/pull/42");
  });

  test("fast mode and worktree scope surface when set", () => {
    const out = render(
      { ...session, fast_mode: true, workspace: { ...session.workspace, git_worktree: "feature-xyz" } },
      null,
      { now: NOW },
    );
    expect(out).toContain("feature-xyz");
  });

  test("collapses to a single line when there are no metrics; crab always shown", () => {
    const out = render({ model: { display_name: "Opus" } }, null, {});
    expect(out.split("\n").length).toBe(1);
    expect(out).toContain("╭─");
    expect(out).toContain("🦀");
  });
});

describe("render (adaptive layout)", () => {
  const session = {
    model: { display_name: "Opus 4.8" },
    context_window: { used_percentage: 47 },
    workspace: { current_dir: "/home/u/rust-studio" },
    cost: { total_duration_ms: 72 * 60_000, total_cost_usd: 8.42, total_lines_added: 156, total_lines_removed: 23 },
    pr: { number: 42, review_state: "approved" },
    rate_limits: { five_hour: { used_percentage: 23 } },
  };
  const git = { branch: "feat/v0.39.0-research-driven-hardening", dirty: 1 };

  test("micro (<80 cols): one line, essentials only", () => {
    const out = render(session, null, { git, cols: 60, now: NOW });
    expect(out.split("\n").length).toBe(1);
    expect(out).toContain("47%"); // context survives
    expect(out).toContain("PR #42"); // so does the PR
    expect(out).not.toContain("$8.42"); // cost does not
    expect(out).not.toContain("Opus"); // nor the model
    expect(displayWidth(out)).toBeLessThanOrEqual(60);
  });

  test("compact (80-119 cols): one line, mid-priority kept", () => {
    const out = render(session, null, { git, cols: 110, now: NOW });
    expect(out.split("\n").length).toBe(1);
    expect(displayWidth(out)).toBeLessThanOrEqual(110);
  });

  test("full (>=120 cols): two lines", () => {
    const out = render(session, null, { git, cols: 160, now: NOW });
    expect(out.split("\n").length).toBe(2);
    expect(out).toContain("Opus 4.8");
  });

  test("a long branch is truncated once the terminal is not roomy", () => {
    const out = render(session, null, { git, cols: 100, now: NOW });
    expect(out).not.toContain("research-driven-hardening");
    expect(out).toContain("…");
  });
});

describe("freshProgress", () => {
  test("accepts fresh", () => expect(freshProgress({ phase: "build", ts: NOW - 1000 }, NOW)?.phase).toBe("build"));
  test("rejects stale (>1h)", () => expect(freshProgress({ phase: "build", ts: NOW - 7_200_000 }, NOW)).toBeNull());
  test("rejects missing phase", () => expect(freshProgress({ ts: NOW }, NOW)).toBeNull());
});

describe("powerline rendering (Tokyo Night)", () => {
  test("with color + nerd + powerline on, emits arrow caps and truecolor backgrounds", () => {
    delete process.env.NO_COLOR; // enable color → powerline path
    const out = render({ model: { display_name: "Opus" }, context_window: { used_percentage: 30 } }, null, { git: { branch: "main" } });
    process.env.NO_COLOR = "1"; // restore for the rest of the suite
    expect(out).toContain("\u{E0B0}"); // powerline right cap
    expect(out).toContain("\x1b[48;2;"); // truecolor background (theme segment)
    expect(out).toContain("rust-studio");
  });
});
