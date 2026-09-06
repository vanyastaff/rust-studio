#!/usr/bin/env bun
// Tests for the MSRV-gated idiom set. Run with `bun test` from the plugin root.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_IDIOMS,
  cmpVersion,
  editionFloor,
  gateAt,
  loadTimeline,
  parseVersion,
  renderTimeline,
  resolveFloor,
  type Stabilization,
} from "./stdlib-timeline.ts";
import { crateFloor, inherits } from "./cargo-manifest.ts";

const PLUGIN_ROOT = join(import.meta.dir, "..", "..");

const idiom = (version: string, item: string, clippy?: string): Stabilization => ({
  version,
  kind: "idiom",
  item,
  instead: `the old ${item} shape`,
  ...(clippy ? { clippy } : {}),
});

describe("parseVersion / cmpVersion", () => {
  test("minor versions compare numerically, not lexically", () => {
    // The whole gate is this comparison: "1.100" < "1.98" as strings would silently
    // withhold every idiom once the toolchain passes 1.99.
    expect(cmpVersion("1.100", "1.98")).toBeGreaterThan(0);
    expect(cmpVersion("1.98", "1.100")).toBeLessThan(0);
    expect(cmpVersion("1.98", "1.98")).toBe(0);
  });
  test("patch and suffix noise is tolerated", () => {
    expect(parseVersion("1.85.1-nightly")).toEqual([1, 85, 1]);
    expect(cmpVersion("1.85.1", "1.85")).toBeGreaterThan(0);
    expect(cmpVersion("nonsense", "1.85")).toBe(0);
  });
});

describe("editionFloor", () => {
  test("an edition implies its minimum compiler", () => {
    expect(editionFloor("2024")).toBe("1.85");
    expect(editionFloor("2021")).toBe("1.56");
    expect(editionFloor("unknown")).toBeNull();
    expect(editionFloor(null)).toBeNull();
  });
});

describe("resolveFloor", () => {
  test("rust-version wins, and names itself as the source", () => {
    const f = resolveFloor({ msrv: "1.90", edition: "2024", defaultMsrv: "1.75" });
    expect(f?.version).toBe("1.90");
    expect(f?.source).toContain("rust-version");
  });
  test("falls back to the studio default, then to the edition minimum", () => {
    expect(resolveFloor({ msrv: null, edition: "2024", defaultMsrv: "1.75" })?.version).toBe("1.75");
    const ed = resolveFloor({ msrv: null, edition: "2024", defaultMsrv: null });
    expect(ed?.version).toBe("1.85");
    expect(ed?.source).toContain("edition 2024");
  });
  test("no floor at all is null — not a guess", () => {
    expect(resolveFloor({ msrv: null, edition: null, defaultMsrv: null })).toBeNull();
    expect(resolveFloor({ msrv: "  ", edition: "", defaultMsrv: "" })).toBeNull();
  });
});

describe("gateAt", () => {
  const entries: Stabilization[] = [
    idiom("1.65", "let-else"),
    idiom("1.82", "is_none_or"),
    idiom("1.98", "bool::ok_or"),
    { version: "1.98", kind: "breakage", item: "glob imports are hard errors", instead: "assuming green" },
  ];
  test("a low floor sees only what it can compile, and counts the rest", () => {
    const g = gateAt(entries, "1.70");
    expect(g.available.map((e) => e.item)).toEqual(["let-else"]);
    expect(g.blocked).toBe(2);
  });
  test("available idioms are newest first", () => {
    expect(gateAt(entries, "1.98").available.map((e) => e.version)).toEqual(["1.98", "1.82", "1.65"]);
  });
  test("breakage is not MSRV-gated — it tracks the compiler running the build", () => {
    expect(gateAt(entries, "1.65").breakage).toHaveLength(1);
  });
});

describe("renderTimeline", () => {
  const entries: Stabilization[] = [
    idiom("1.65", "`let … else`", "manual_let_else"),
    idiom("1.98", "`bool::ok_or`"),
  ];

  test("names only what the floor allows, and never names what it blocks", () => {
    const out = renderTimeline(entries, { version: "1.70", source: "`rust-version`" });
    expect(out).toContain("MSRV 1.70");
    expect(out).toContain("`let … else`");
    // The defect this module exists to prevent: telling a 1.70 crate about a 1.98 API.
    expect(out).not.toContain("bool::ok_or");
    expect(out).toContain("1 later stabilization(s) sit **above** this floor");
  });

  test("clippy lints are offered as a runnable command", () => {
    const out = renderTimeline(entries, { version: "1.98", source: "`rust-version`" });
    expect(out).toContain("-W clippy::manual_let_else");
    expect(out).toContain("clippy::incompatible_msrv");
  });

  test("no floor withholds the version-keyed set instead of guessing", () => {
    const out = renderTimeline(entries, null);
    expect(out).toContain("No MSRV floor");
    expect(out).toContain("/msrv-check");
    expect(out).not.toContain("1.98");
    expect(out).not.toContain("1.65");
  });

  test("an unreadable or empty timeline renders nothing rather than a header", () => {
    expect(renderTimeline([], { version: "1.98", source: "x" })).toBe("");
    expect(renderTimeline([], null)).toBe("");
  });

  test("output is capped so one edit cannot flood the window", () => {
    const many = Array.from({ length: MAX_IDIOMS + 5 }, (_, i) => idiom(`1.${50 + i}`, `item${i}`));
    const out = renderTimeline(many, { version: "1.99", source: "`rust-version`" });
    expect(out.split("\n").filter((l) => l.startsWith("- item")).length).toBe(MAX_IDIOMS);
    expect(out).toContain("older stabilization(s) at this floor, omitted");
  });
});

describe("loadTimeline", () => {
  test("the shipped data file parses and every entry is usable", () => {
    const entries = loadTimeline(PLUGIN_ROOT);
    expect(entries.length).toBeGreaterThan(10);
    for (const e of entries) {
      expect(parseVersion(e.version).length).toBe(3);
      expect(e.item.length).toBeGreaterThan(0);
      expect(e.instead.length).toBeGreaterThan(0);
      // A `clippy::` prefix in the data would render as `clippy::clippy::…`.
      if (e.clippy) expect(e.clippy).not.toContain("clippy::");
    }
    expect(entries.some((e) => e.kind === "breakage")).toBe(true);
  });
  test("a missing or malformed file is silent, never a thrown hook", () => {
    expect(loadTimeline("/nonexistent-plugin-root")).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), "rs-timeline-"));
    mkdirSync(join(dir, "rules"));
    writeFileSync(join(dir, "rules", "stdlib-timeline.json"), "{ not json");
    expect(loadTimeline(dir)).toEqual([]);
  });
  test("entries missing required fields are dropped, not half-rendered", () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-timeline-"));
    mkdirSync(join(dir, "rules"));
    writeFileSync(
      join(dir, "rules", "stdlib-timeline.json"),
      JSON.stringify({
        entries: [
          { version: "1.98", kind: "idiom", item: "ok", instead: "old" },
          { version: "nope", kind: "idiom", item: "x", instead: "y" },
          { version: "1.90", kind: "typo", item: "x", instead: "y" },
          { version: "1.90", kind: "idiom", instead: "y" },
        ],
      }),
    );
    expect(loadTimeline(dir).map((e) => e.item)).toEqual(["ok"]);
  });
});

describe("crateFloor", () => {
  /** A workspace root plus one member, written to a temp dir. */
  function workspace(rootToml: string, memberToml: string): string {
    const dir = mkdtempSync(join(tmpdir(), "rs-ws-"));
    writeFileSync(join(dir, "Cargo.toml"), rootToml);
    mkdirSync(join(dir, "crates", "member", "src"), { recursive: true });
    writeFileSync(join(dir, "crates", "member", "Cargo.toml"), memberToml);
    return dir;
  }

  test("inherits() distinguishes a declared field from a delegated one", () => {
    expect(inherits('rust-version.workspace = true', "rust-version")).toBe(true);
    expect(inherits('rust-version = "1.85"', "rust-version")).toBe(false);
  });

  test("a member that delegates picks up the workspace floor", () => {
    const dir = workspace(
      '[workspace]\nmembers = ["crates/*"]\n\n[workspace.package]\nedition = "2024"\nrust-version = "1.90"\n',
      '[package]\nname = "member"\nedition.workspace = true\nrust-version.workspace = true\n',
    );
    const f = crateFloor(join(dir, "crates", "member", "src"));
    expect(f.msrv).toBe("1.90");
    expect(f.edition).toBe("2024");
    expect(f.manifestDir).toBe(join(dir, "crates", "member"));
  });

  test("a member's own floor wins over the workspace's", () => {
    const dir = workspace(
      '[workspace]\nmembers = ["crates/*"]\n\n[workspace.package]\nrust-version = "1.90"\n',
      '[package]\nname = "member"\nrust-version = "1.75"\n',
    );
    expect(crateFloor(join(dir, "crates", "member", "src")).msrv).toBe("1.75");
  });

  test("outside any crate there is no floor to report", () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-nocrate-"));
    const f = crateFloor(dir);
    expect(f.manifestDir).toBeNull();
    expect(f.msrv).toBeNull();
  });
});
