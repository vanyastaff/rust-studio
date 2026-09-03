// Tests for the memory doctor: each pins a concrete finding, conversion, or
// mutation on a fixture store (docs/integrity-and-evidence.md).
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  noteFindings,
  missingPaths,
  auditStore,
  renderAudit,
  convertWikilinks,
  convertVaultNote,
  planImport,
  applyImport,
  planReindex,
  applyReindex,
  planArchive,
  applyArchive,
  UNVERIFIED_DAYS,
  indexTitle,
} from "./memory-doctor.ts";
import { parseIndex, type StoreInfo } from "./memory-store.ts";

let tmp: string;
let root: string;
let mem: string;
const NOW = Date.parse("2026-09-03T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "rs-memdoc-"));
  root = join(tmp, "repo");
  mem = join(tmp, "mem");
  mkdirSync(join(root, "crates", "net", "src"), { recursive: true });
  writeFileSync(join(root, "crates", "net", "src", "lib.rs"), "");
  mkdirSync(mem, { recursive: true });
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const store = (): StoreInfo => ({ dir: mem, source: "option", exists: true, hostInjectsIndex: false, projectKey: "k", root });

const note = (fm: Record<string, string>, body: string, meta: Record<string, string> = {}): string =>
  "---\n" +
  Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n") +
  (Object.keys(meta).length ? "\nmetadata:\n" + Object.entries(meta).map(([k, v]) => `  ${k}: ${v}`).join("\n") : "") +
  "\n---\n\n" +
  body;

describe("missingPaths", () => {
  test("flags a relative path that is gone, keeps one that exists (also below a sub-dir)", () => {
    const body = "see `crates/net/src/lib.rs:12` and `src/lib.rs` and `crates/gone/src/x.rs`; template `crates/<name>/Cargo.toml`";
    expect(missingPaths(body, root)).toEqual(["crates/gone/src/x.rs"]);
  });
});

describe("noteFindings", () => {
  test("a fresh, typed, verified note has no findings", () => {
    const body = note({ name: "n", description: '"Fresh fact"' }, "Body.", { type: "project", kind: "gotcha", modified: "2026-09-01" });
    expect(noteFindings(body, undefined, root, NOW).findings).toEqual([]);
  });
  test("unverified after 90 days; a recent `verified` date resets the clock", () => {
    const old = new Date(NOW - (UNVERIFIED_DAYS + 5) * DAY).toISOString();
    const stale = note({ name: "n" }, "Body.", { type: "project", modified: old });
    expect(noteFindings(stale, undefined, root, NOW).findings.map((f) => f.code)).toContain("unverified");
    const reverified = note({ name: "n" }, "Body.", { type: "project", modified: old, verified: "2026-09-01" });
    expect(noteFindings(reverified, undefined, root, NOW).findings.map((f) => f.code)).not.toContain("unverified");
  });
  test("resolved status or a RESOLVED hook → archive candidate", () => {
    const b = note({ name: "n" }, "Body.", { type: "project", status: "resolved", modified: "2026-09-01" });
    expect(noteFindings(b, undefined, root, NOW).findings.map((f) => f.code)).toContain("resolved");
    const entry = { title: "t", file: "n.md", hook: "RESOLVED: the fling tests flaked", line: 1 };
    const c = note({ name: "n" }, "Body.", { type: "project", modified: "2026-09-01" });
    expect(noteFindings(c, entry, root, NOW).findings.map((f) => f.code)).toContain("resolved");
  });
  test("relative dates, secrets, missing type, long hooks, and old conventions are flagged", () => {
    const b = note({ name: "n" }, "We fixed it yesterday. token = abcdefghijklmnop1234", { kind: "convention", modified: "2026-07-01" });
    const codes = noteFindings(b, { title: "t", file: "n.md", hook: "x".repeat(200), line: 1 }, root, NOW).findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["relative-date", "secret", "untyped", "long-hook", "promote"]));
  });
});

describe("auditStore + renderAudit", () => {
  test("reports integrity and per-note findings on a fixture store", () => {
    writeFileSync(join(mem, "ok.md"), note({ name: "ok", description: '"Fine"' }, "Fine.", { type: "project", modified: "2026-09-01" }));
    writeFileSync(join(mem, "rot.md"), note({ name: "rot" }, "Look at crates/gone/src/x.rs", { type: "project", modified: "2026-09-01" }));
    writeFileSync(join(mem, "MEMORY.md"), "# Memory index\n\n- [Fine](ok.md) — fine\n- [Gone](gone.md) — dangling\n");
    const r = auditStore(store(), NOW);
    expect(r.integrity.dangling).toEqual(["gone.md"]);
    expect(r.integrity.unindexed).toEqual(["rot.md"]);
    expect(r.counts["missing-path"]).toBe(1);
    const text = renderAudit(r);
    expect(text).toContain("1 dangling, 1 unindexed");
    expect(text).toContain("| rot.md |");
    expect(text).toContain("missing-path: crates/gone/src/x.rs");
  });
});

describe("vault import", () => {
  const vaultNote =
    '---\ntitle: "A deadline source has two obligations"\ntags: [gotcha, frame-loop]\nnote_type: gotcha\nstatus: active\ncreated: 2026-08-07\nupdated: 2026-08-10\n---\n\nWiring a deadline is half the job. See [[wake-carrier|A wake needs a carrier]] and [[dirty-predicate]].\n';

  test("convertWikilinks rewrites both forms", () => {
    expect(convertWikilinks("see [[a-b|Title]] and [[c-d]] and [[e#frag|E]]")).toBe("see [Title](a-b.md) and [c-d](c-d.md) and [E](e.md)");
  });

  test("convertVaultNote produces host frontmatter, keeps dates, maps kind → type", () => {
    const c = convertVaultNote("deadline-source", vaultNote, "be in the dirty predicate AND self-clearing", NOW, "flui/deadline-source.md");
    expect(c.file).toBe("deadline-source.md");
    expect(c.content).toContain("name: deadline-source");
    expect(c.content).toContain('description: "A deadline source has two obligations"');
    expect(c.content).toContain("  type: project");
    expect(c.content).toContain("  kind: gotcha");
    expect(c.content).toContain("  modified: 2026-08-10");
    expect(c.content).toContain("  imported: 2026-09-03");
    expect(c.content).toContain("[A wake needs a carrier](wake-carrier.md)");
    expect(c.content).not.toContain("note_type");
    expect(c.indexLine).toBe("- [A deadline source has two obligations](deadline-source.md) — be in the dirty predicate AND self-clearing");
    const ref = convertVaultNote("r", '---\ntitle: "Doc"\nnote_type: reference\n---\nx', "", NOW);
    expect(ref.content).toContain("  type: reference");
  });

  test("planImport + applyImport: creates, indexes, never overwrites, and skips on re-run", () => {
    const vault = join(tmp, "vault");
    mkdirSync(vault);
    writeFileSync(join(vault, "deadline-source.md"), vaultNote);
    writeFileSync(join(vault, "already.md"), '---\ntitle: "Already"\n---\nold text');
    writeFileSync(join(vault, "empty.md"), "   ");
    writeFileSync(join(vault, "MEMORY.md"), "# flui — project memory\n\n- [[deadline-source|A deadline source has two obligations]] — be in the dirty predicate\n");
    writeFileSync(join(mem, "already.md"), "keep me");
    const plan = planImport(vault, mem, NOW);
    expect(plan.create.map((c) => c.file)).toEqual(["deadline-source.md"]);
    expect(plan.skipExists).toEqual(["already.md"]);
    expect(plan.skipEmpty).toEqual(["empty.md"]);
    expect(plan.overCap).toBe(false);
    expect(applyImport(plan).written).toBe(1);
    expect(readFileSync(join(mem, "already.md"), "utf8")).toBe("keep me");
    const index = readFileSync(join(mem, "MEMORY.md"), "utf8");
    expect(index.startsWith("# Memory index")).toBe(true);
    expect(parseIndex(index).map((e) => e.file)).toEqual(["deadline-source.md"]);
    expect(index).toContain("— be in the dirty predicate");
    const again = planImport(vault, mem, NOW);
    expect(again.create).toHaveLength(0);
    expect(again.skipExists).toContain("deadline-source.md");
  });
});

describe("reindex + archive", () => {
  test("reindex appends a line per unindexed note from its frontmatter", () => {
    writeFileSync(join(mem, "MEMORY.md"), "# Memory index\n");
    writeFileSync(join(mem, "loose.md"), note({ name: "loose", description: '"A loose fact"' }, "Body.", { type: "project" }));
    const lines = planReindex(mem);
    expect(lines).toEqual(["- [loose](loose.md) — A loose fact"]);
    applyReindex(mem, lines);
    expect(parseIndex(readFileSync(join(mem, "MEMORY.md"), "utf8")).map((e) => e.file)).toEqual(["loose.md"]);
    expect(planReindex(mem)).toEqual([]);
  });

  test("archive moves the file under archive/ and drops only its index lines", () => {
    writeFileSync(join(mem, "a.md"), "A");
    writeFileSync(join(mem, "b.md"), "B");
    writeFileSync(join(mem, "MEMORY.md"), "# Memory index\n\n- [A](a.md) — a\n- [B](b.md) — b\n");
    expect(planArchive(mem, "a.md")).toEqual({ file: "a.md", indexLines: 1, exists: true });
    applyArchive(mem, "a.md");
    expect(existsSync(join(mem, "a.md"))).toBe(false);
    expect(existsSync(join(mem, "archive", "a.md"))).toBe(true);
    const index = readFileSync(join(mem, "MEMORY.md"), "utf8");
    expect(parseIndex(index).map((e) => e.file)).toEqual(["b.md"]);
    expect(index).toContain("# Memory index");
  });
});

describe("indexTitle", () => {
  test("keeps short titles, cuts a long one at its first clause break", () => {
    expect(indexTitle("A short title")).toBe("A short title");
    expect(indexTitle("A deadline source has two paired obligations — be in the dirty predicate AND self-clearing, or you get one-shot work")).toBe(
      "A deadline source has two paired obligations",
    );
  });
  test("a hook the title already says is dropped from the index line", () => {
    const c = convertVaultNote("x", '---\ntitle: "Check whether the drain snapshots or loops, not the call count"\n---\nbody', "not the call count", NOW);
    expect(c.indexLine).toBe("- [Check whether the drain snapshots or loops, not the call count](x.md)");
  });
});
