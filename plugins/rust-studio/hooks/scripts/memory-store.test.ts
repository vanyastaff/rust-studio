// Tests for the host-native memory store helpers. Each test pins a concrete
// resolution, parse, or health result (docs/integrity-and-evidence.md).
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  projectKey,
  expandHome,
  parseIndex,
  readIndex,
  listNotes,
  noteMeta,
  indexHealth,
  terms,
  rankEntries,
  hostMemorySettings,
  hostAutoMemoryOn,
  resolveStore,
  budgetLine,
  INDEX_LINE_CAP,
  INDEX_BYTE_CAP,
} from "./memory-store.ts";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "rs-memstore-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("projectKey", () => {
  test("mirrors the host: every char outside [A-Za-z0-9-] becomes '-'", () => {
    expect(projectKey("/mnt/data/dev/rust-studio")).toBe("-mnt-data-dev-rust-studio");
    expect(projectKey("/home/u/my_repo.v2")).toBe("-home-u-my-repo-v2");
  });
  test("empty root → unknown", () => {
    expect(projectKey("")).toBe("unknown");
  });
});

describe("expandHome", () => {
  test("~/x expands, absolute passes through", () => {
    expect(expandHome("~/mem")).toMatch(/\/mem$/);
    expect(expandHome("~/mem")).not.toContain("~");
    expect(expandHome("/abs/mem")).toBe("/abs/mem");
  });
});

describe("parseIndex", () => {
  test("host form: - [Title](file.md) — hook", () => {
    const [e] = parseIndex("# Memory index\n\n- [Guard blocks heredoc](guard-heredoc.md) — use Write + python3\n");
    expect(e).toMatchObject({ title: "Guard blocks heredoc", file: "guard-heredoc.md", hook: "use Write + python3", line: 2 });
  });
  test("legacy vault form: - [[slug|Title]] — hook resolves to slug.md", () => {
    const [e] = parseIndex("- [[flui-layer-drift|AGENTS.md edition note is stale]] — check Cargo.toml first");
    expect(e).toMatchObject({ title: "AGENTS.md edition note is stale", file: "flui-layer-drift.md", hook: "check Cargo.toml first" });
  });
  test("a bare [[slug]] uses the slug as title; a hook-less line parses with an empty hook", () => {
    const es = parseIndex("- [[only-slug]]\n* [Plain](plain.md)");
    expect(es[0]).toMatchObject({ title: "only-slug", file: "only-slug.md", hook: "" });
    expect(es[1]).toMatchObject({ title: "Plain", file: "plain.md", hook: "" });
  });
  test("prose and headings are not entries", () => {
    expect(parseIndex("# Index\nSome prose with [a link](x.md) inline.\n")).toHaveLength(0);
  });
});

describe("noteMeta", () => {
  test("reads the host's nested metadata block plus name/description", () => {
    const m = noteMeta(
      "---\nname: guard-heredoc\ndescription: \"Guard blocks heredoc prose\"\nmetadata:\n  node_type: memory\n  type: feedback\n  kind: gotcha\n  modified: 2026-09-03T10:06:07.510Z\n---\n\nBody.\n",
    );
    expect(m).toMatchObject({ name: "guard-heredoc", description: "Guard blocks heredoc prose", type: "feedback", kind: "gotcha" });
    expect(m.modified).toBe("2026-09-03T10:06:07.510Z");
  });
  test("reads the flat docs form and the legacy vault form", () => {
    expect(noteMeta("---\nname: n\ntype: project\nmodified: 2026-08-01\n---\nbody").type).toBe("project");
    const v = noteMeta("---\ntitle: \"Old note\"\nnote_type: convention\nupdated: 2026-08-10\n---\n\nFirst line.\n");
    expect(v).toMatchObject({ name: "Old note", kind: "convention", modified: "2026-08-10", description: "First line." });
  });
  test("no frontmatter → first body line is the description", () => {
    expect(noteMeta("# Heading\n\n> quote\n\nThe fact.\n").description).toBe("The fact.");
  });
});

describe("indexHealth", () => {
  test("reports dangling entries, unindexed files, duplicates, and budget fill", () => {
    writeFileSync(join(tmp, "a.md"), "---\nname: a\n---\nA");
    writeFileSync(join(tmp, "b.md"), "---\nname: b\n---\nB");
    mkdirSync(join(tmp, "archive"));
    writeFileSync(join(tmp, "archive", "old.md"), "old"); // subfolders are not memory
    writeFileSync(join(tmp, "MEMORY.md"), "# Memory index\n- [A](a.md) — a\n- [A again](a.md) — dup\n- [Gone](gone.md) — missing\n");
    const h = indexHealth(tmp);
    expect(h.dangling).toEqual(["gone.md"]);
    expect(h.unindexed).toEqual(["b.md"]);
    expect(h.duplicates).toEqual(["a.md"]);
    expect(h.lineCount).toBe(4);
    expect(h.overCap).toBe(false);
    expect(h.nearCap).toBe(false);
    expect(listNotes(tmp)).toEqual(["a.md", "b.md"]);
  });
  test("crossing the host's line cap flags overCap; 85% flags nearCap", () => {
    const line = "- [T](t.md) — h\n";
    writeFileSync(join(tmp, "t.md"), "t");
    writeFileSync(join(tmp, "MEMORY.md"), line.repeat(INDEX_LINE_CAP));
    expect(indexHealth(tmp).overCap).toBe(true);
    writeFileSync(join(tmp, "MEMORY.md"), line.repeat(Math.ceil(INDEX_LINE_CAP * 0.85)));
    const h = indexHealth(tmp);
    expect(h.nearCap).toBe(true);
    expect(h.overCap).toBe(false);
    expect(budgetLine(h)).toContain(`/${INDEX_LINE_CAP} lines`);
  });
  test("the byte cap counts too", () => {
    writeFileSync(join(tmp, "MEMORY.md"), "- [T](t.md) — " + "x".repeat(INDEX_BYTE_CAP) + "\n");
    expect(indexHealth(tmp).overCap).toBe(true);
  });
  test("no index → zero budget, everything unindexed", () => {
    writeFileSync(join(tmp, "a.md"), "A");
    expect(readIndex(tmp)).toBeNull();
    const h = indexHealth(tmp);
    expect(h.lineCount).toBe(0);
    expect(h.unindexed).toEqual(["a.md"]);
  });
});

describe("ranking", () => {
  test("terms drops stop words and short tokens", () => {
    expect([...terms("Fix the tokio runtime hang in crates/net")]).toEqual(["tokio", "runtime", "hang"]);
  });
  test("a slug/title hit outranks a hook hit; multiple weak hits add up; unmatched entries drop", () => {
    const entries = parseIndex(
      [
        "- [Tokio runtime hang](tokio-runtime-hang.md) — select! loop starves",
        "- [Cargo cooldown](cargo-cooldown.md) — runtime note: the hang was elsewhere",
        "- [Unrelated](unrelated.md) — nothing here",
      ].join("\n"),
    );
    const r = rankEntries(entries, terms("tokio runtime hang"));
    expect(r.map((e) => e.file)).toEqual(["tokio-runtime-hang.md", "cargo-cooldown.md"]);
    expect(r[0].score).toBe(9);
    expect(r[1].score).toBe(2);
  });
});

describe("host settings + store resolution", () => {
  const saved: Record<string, string | undefined> = {};
  const keys = ["CLAUDE_CONFIG_DIR", "CLAUDE_PLUGIN_ROOT", "CLAUDECODE", "CLAUDE_CODE_DISABLE_AUTO_MEMORY", "RUST_STUDIO_MEMORY_DIR", "CLAUDE_PLUGIN_OPTION_MEMORY_DIR"];
  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  test("local settings override user settings for autoMemoryDirectory; enabled falls through", () => {
    const cfg = join(tmp, "cfg");
    const root = join(tmp, "repo");
    mkdirSync(join(root, ".claude"), { recursive: true });
    mkdirSync(cfg, { recursive: true });
    writeFileSync(join(cfg, "settings.json"), JSON.stringify({ autoMemoryDirectory: "~/user-mem", autoMemoryEnabled: false }));
    writeFileSync(join(root, ".claude", "settings.local.json"), JSON.stringify({ autoMemoryDirectory: "/local-mem" }));
    const s = hostMemorySettings(root, cfg);
    expect(s.dir).toBe("/local-mem");
    expect(s.enabled).toBe(false);
    expect(hostAutoMemoryOn(s)).toBe(false);
  });

  test("default store is <config>/projects/<key>/memory and Claude injects its index", () => {
    process.env.CLAUDE_CONFIG_DIR = join(tmp, "cfg");
    process.env.CLAUDE_PLUGIN_ROOT = "/plugin";
    const root = join(tmp, "repo");
    mkdirSync(root, { recursive: true });
    const st = resolveStore(root);
    expect(st.dir).toBe(join(tmp, "cfg", "projects", projectKey(root), "memory"));
    expect(st.source).toBe("default");
    expect(st.exists).toBe(false);
    expect(st.hostInjectsIndex).toBe(true);
  });

  test("the studio option wins and marks the host as NOT injecting that index", () => {
    process.env.CLAUDE_CONFIG_DIR = join(tmp, "cfg");
    process.env.CLAUDE_PLUGIN_ROOT = "/plugin";
    process.env.RUST_STUDIO_MEMORY_DIR = join(tmp, "custom");
    mkdirSync(join(tmp, "custom"), { recursive: true });
    const st = resolveStore(tmp);
    expect(st.dir).toBe(join(tmp, "custom"));
    expect(st.source).toBe("option");
    expect(st.exists).toBe(true);
    expect(st.hostInjectsIndex).toBe(false);
  });

  test("the env kill-switch turns host injection off; Codex (no CLAUDE_PLUGIN_ROOT) never injects", () => {
    process.env.CLAUDE_CONFIG_DIR = join(tmp, "cfg");
    process.env.CLAUDE_PLUGIN_ROOT = "/plugin";
    process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = "1";
    expect(resolveStore(tmp).hostInjectsIndex).toBe(false);
    delete process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY;
    delete process.env.CLAUDE_PLUGIN_ROOT;
    expect(resolveStore(tmp).hostInjectsIndex).toBe(false);
  });
});
