// Tests for the usage report: the window, the split by hand and project, the "never invoked"
// list against a catalog, names outside the studio, the rendering, and the CLI (--help,
// --json, a missing log, a log copied from elsewhere).
import { test, expect, describe } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReport, readUsage, readCatalog, findPluginRoot, projectOf, renderReport, main, DEFAULT_DAYS } from "./usage-report.ts";
import type { UsageRow } from "./usage-log.ts";

const CLI = new URL("./usage-report.ts", import.meta.url).pathname;
const NOW = new Date("2026-09-21T12:00:00Z");
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();

const row = (p: Partial<UsageRow>): UsageRow => ({ ts: at(1), session_id: "s1", cwd: "/home/me/flui", kind: "skill", name: "review", invoker: "model", ...p });

/** A week of plausible traffic plus one row from before the window and one malformed line. */
const FIXTURE: string = [
  JSON.stringify(row({ ts: at(1), name: "dev-task", session_id: "s1" })),
  JSON.stringify(row({ ts: at(1), name: "dev-task", session_id: "s1", invoker: "user" })),
  JSON.stringify(row({ ts: at(2), name: "dev-task", session_id: "s2", cwd: "/mnt/data/dev/nebula" })),
  JSON.stringify(row({ ts: at(2), name: "review", session_id: "s2", cwd: "/mnt/data/dev/nebula" })),
  JSON.stringify(row({ ts: at(3), name: "prose", session_id: "s3", cwd: "/mnt/data/dev/rust-studio" })),
  JSON.stringify(row({ ts: at(1), kind: "agent", name: "rust-reviewer", session_id: "s1" })),
  JSON.stringify(row({ ts: at(2), kind: "agent", name: "rust-reviewer", session_id: "s2", cwd: "/mnt/data/dev/nebula" })),
  JSON.stringify(row({ ts: at(2), kind: "agent", name: "Explore", session_id: "s2", cwd: "/mnt/data/dev/nebula" })),
  JSON.stringify(row({ ts: at(0.5), name: "code-review", session_id: "s4", cwd: "/home/me/flui/" })),
  JSON.stringify(row({ ts: at(12), name: "fuzz", session_id: "s0" })),
  "this line is not json",
  "",
].join("\n");

/** A catalog on disk: three skills, two agents. */
function fakePlugin(): string {
  const root = mkdtempSync(join(tmpdir(), "plugin-"));
  for (const s of ["dev-task", "review", "prose", "fuzz"]) {
    mkdirSync(join(root, "skills", s), { recursive: true });
    writeFileSync(join(root, "skills", s, "SKILL.md"), "---\nname: x\n---\n");
  }
  mkdirSync(join(root, "skills", "not-a-skill"), { recursive: true }); // no SKILL.md → not counted
  mkdirSync(join(root, "agents"), { recursive: true });
  for (const a of ["rust-reviewer", "rust-scout"]) writeFileSync(join(root, "agents", `${a}.md`), "---\nname: x\n---\n");
  return root;
}

describe("readUsage + projectOf", () => {
  test("keeps well-formed rows and counts the rest", () => {
    const { rows, malformed } = readUsage(FIXTURE);
    expect(rows).toHaveLength(10);
    expect(malformed).toBe(1);
  });
  test("the project is the cwd's basename, trailing slash or not; unknown is ?", () => {
    expect(projectOf(row({ cwd: "/home/me/flui/" }))).toBe("flui");
    expect(projectOf(row({ cwd: "/mnt/data/dev/nebula" }))).toBe("nebula");
    expect(projectOf(row({ cwd: "" }))).toBe("?");
  });
});

describe("readCatalog + findPluginRoot", () => {
  test("lists skill directories that carry a SKILL.md and agent briefs by name", () => {
    const root = fakePlugin();
    expect(readCatalog(root)).toEqual({ root, skills: ["dev-task", "fuzz", "prose", "review"], agents: ["rust-reviewer", "rust-scout"] });
    expect(readCatalog(null)).toEqual({ root: null, skills: [], agents: [] });
  });
  test("finds the real plugin root from hooks/scripts, and refuses a directory that is not one", () => {
    const root = findPluginRoot();
    expect(root).not.toBeNull();
    expect(readCatalog(root).skills).toContain("studio-doctor");
    expect(readCatalog(root).agents).toContain("rust-reviewer");
    expect(findPluginRoot(mkdtempSync(join(tmpdir(), "empty-")))).toBeNull();
  });
});

describe("buildReport", () => {
  const { rows, malformed } = readUsage(FIXTURE);
  const catalog = readCatalog(fakePlugin());
  const report = buildReport(rows, catalog, { file: "/x/usage.jsonl", days: 7, since: NOW.getTime() - 7 * DAY, malformed, now: NOW });

  test("the window drops older rows and counts sessions", () => {
    expect(report.rows).toBe(9);
    expect(report.sessions).toBe(4);
    expect(report.malformed).toBe(1);
    expect(report.since).toBe(at(7));
  });
  test("skills: totals, the split by hand, sessions, projects with plugin-dev flagged", () => {
    const dev = report.skills.used.find((s) => s.name === "dev-task")!;
    expect(dev).toMatchObject({ total: 3, model: 2, user: 1, sessions: 2, outsidePluginDev: 3 });
    expect(dev.projects).toEqual([
      ["flui", 2],
      ["nebula", 1],
    ]);
    const prose = report.skills.used.find((s) => s.name === "prose")!;
    expect(prose).toMatchObject({ total: 1, outsidePluginDev: 0, projects: [["rust-studio", 1]] });
    expect(report.skills.used.map((s) => s.name)).toEqual(["dev-task", "prose", "review"]);
  });
  test("never invoked is the catalog minus the window: the row from 12 days ago does not save fuzz", () => {
    expect(report.skills.never).toEqual(["fuzz"]);
    expect(report.agents.never).toEqual(["rust-scout"]);
    expect(report.skills.onDisk).toBe(4);
    expect(report.agents.onDisk).toBe(2);
  });
  test("names that are not on disk are listed outside the studio, not as skills or agents", () => {
    expect(report.outside.map((s) => [s.name, s.total])).toEqual([
      ["code-review", 1],
      ["Explore", 1],
    ]);
    expect(report.agents.used.map((s) => s.name)).toEqual(["rust-reviewer"]);
  });
  test("with no window everything counts, and with no catalog nothing is 'never'", () => {
    const all = buildReport(rows, catalog, { file: "f", days: null, since: null, malformed: 0, now: NOW });
    expect(all.rows).toBe(10);
    expect(all.skills.never).toEqual([]);
    const blind = buildReport(rows, readCatalog(null), { file: "f", days: 7, since: NOW.getTime() - 7 * DAY, malformed: 0, now: NOW });
    expect(blind.root).toBeNull();
    expect(blind.skills.never).toEqual([]);
    expect(blind.outside).toEqual([]);
    expect(blind.skills.used.map((s) => s.name)).toContain("code-review");
  });

  test("renders the window, both tables, both never-lists and the outside table", () => {
    const text = renderReport(report);
    expect(text).toContain("last 7 days (since 2026-09-14): 9 invocations across 4 sessions");
    expect(text).toContain("(1 malformed line skipped)");
    expect(text).toContain("Skills — 3 invoked of 4 on disk");
    expect(text).toMatch(/dev-task\s+3\s+2\s+1\s+2\s+flui×2, nebula×1/);
    expect(text).toMatch(/prose\s+1\s+1\s+0\s+1\s+rust-studio \(plugin-dev\)×1/);
    expect(text).toContain("Never invoked — skills (1):\n  fuzz");
    expect(text).toContain("Never spawned — agents (1):\n  rust-scout");
    expect(text).toContain("Outside the studio (not on disk here) — 2:");
    expect(text).toContain("docs/usage-telemetry.md");
  });
});

describe("the CLI", () => {
  const capture = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s) }, out, err };
  };
  test("--help prints usage and exits 0", () => {
    const c = capture();
    expect(main(["--help"], c.io)).toBe(0);
    expect(c.out.join("")).toContain("--days N");
    expect(c.out.join("")).toContain(`default ${DEFAULT_DAYS}`);
  });
  test("an unknown flag or a bad --days exits 2 with the usage on stderr", () => {
    const c = capture();
    expect(main(["--bogus"], c.io)).toBe(2);
    expect(c.err.join("")).toContain("unknown argument --bogus");
    expect(main(["--days", "-1"], capture().io)).toBe(2);
  });
  test("--file with --json reports the fixture as one object; --days 0 widens to everything", () => {
    const dir = mkdtempSync(join(tmpdir(), "report-"));
    const file = join(dir, "usage.jsonl");
    writeFileSync(file, FIXTURE);
    const root = fakePlugin();
    const c = capture();
    // the fixture is dated relative to a fixed NOW; with --days 0 the wall clock does not matter
    expect(main(["--file", file, "--json", "--days", "0", "--plugin-root", root], c.io)).toBe(0);
    const report = JSON.parse(c.out.join(""));
    expect(report.rows).toBe(10);
    expect(report.days).toBeNull();
    expect(report.skills.never).toEqual([]);
    expect(report.file).toBe(file);
  });
  test("a missing log is an empty report, not an error", () => {
    const c = capture();
    expect(main(["--file", "/nowhere/usage.jsonl", "--plugin-root", fakePlugin()], c.io)).toBe(0);
    expect(c.out.join("")).toContain("0 invocations across 0 sessions");
    expect(c.out.join("")).toContain("Never invoked — skills (4):");
  });
  test("the script runs from the shell and reads the plugin's own log location", () => {
    const dir = mkdtempSync(join(tmpdir(), "report-"));
    writeFileSync(join(dir, "usage.jsonl"), JSON.stringify({ ts: new Date().toISOString(), session_id: "s", cwd: "/p/x", kind: "skill", name: "review", invoker: "user" }) + "\n");
    const r = Bun.spawnSync(["bun", CLI], { env: { ...process.env, CLAUDE_PLUGIN_DATA: dir }, stdout: "pipe", stderr: "pipe" });
    expect(r.exitCode).toBe(0);
    const text = new TextDecoder().decode(r.stdout);
    expect(text).toContain("1 invocation across 1 session");
    expect(text).toMatch(/review\s+1\s+0\s+1\s+1\s+x×1/);
    expect(text).toContain("Never invoked — skills (");
  });
});
