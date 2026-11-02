import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readMigrationCatalog, resolveAgent, resolveSkill, selectAgent } from "./catalog.ts";

describe("read-only catalog migration", () => {
  const registry = readMigrationCatalog();
  test("every old skill resolves to its explicit operation without granting authorization", () => {
    for (const [skill, entry] of Object.entries(registry.catalog.skills)) for (const old of entry.legacy) {
      expect(resolveSkill(old, registry)).toEqual({ rawName: old, skill, mode: entry.operations[old].mode });
    }
    expect(resolveSkill("rust-studio:publish", registry)).toEqual({ rawName: "rust-studio:publish", skill: "publish-change", mode: "release" });
    expect(resolveSkill("unknown", registry)).toBeNull();
    expect(resolveSkill("brainstorm", registry)).toEqual({ rawName: "brainstorm", skill: "design-change", mode: "explore" });
    expect(resolveSkill("spec-tasks", registry)).toEqual({ rawName: "spec-tasks", skill: "implement-change", mode: "plan" });
  });
  test("legacy task provenance, status and repair count remain immutable", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-task-"));
    const path = join(root, "tasks.md");
    const original = "| T1 | async-runtime-specialist | NEEDS WORK | repairs: 2 | old evidence |\n";
    writeFileSync(path, original);
    expect(resolveAgent("async-runtime-specialist", registry)).toEqual({ rawName: "async-runtime-specialist", role: "implementer", profile: "async", model: "sonnet" });
    expect(readFileSync(path, "utf8")).toBe(original);
  });
  test("review selection keeps domain knowledge but never inherits a writer role or model", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-profile-"));
    mkdirSync(join(root, "docs/profiles"), { recursive: true });
    writeFileSync(join(root, "docs/profiles/async.md"), "Async invariants");
    const selected = selectAgent("async-runtime-specialist", "reviewer", [], { ...registry, root });
    expect(selected.role).toBe("reviewer");
    expect(selected.model).toBe("inherit");
    expect(selected.profiles).toEqual(["async"]);
    // Resolution is deliberately not a freshness receipt or sign-off.
    expect(selected).not.toHaveProperty("fresh");
    expect(selected).not.toHaveProperty("approved");
    expect(() => selectAgent("unsafe-auditor", "reviewer", [], { ...registry, root })).toThrow("required profile is missing");
  });
  test("standalone profile files and the preserved model classes resolve", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-bundle-"));
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "references/profiles"), { recursive: true });
    writeFileSync(join(root, "scripts/catalog.json"), JSON.stringify(registry.catalog));
    writeFileSync(join(root, "references/profiles/navigation.md"), "Navigation");
    const bundle = readMigrationCatalog(join(root, "scripts"));
    expect(selectAgent("rust-scout", "researcher", [], bundle).model).toBe("haiku");
    expect(resolveAgent("implementer", bundle)?.model).toBe("sonnet");
    for (const role of ["designer", "reviewer", "verifier"]) expect(resolveAgent(role, bundle)?.model).toBe("inherit");
  });
});

describe("public catalog CLI", () => {
  const cli = fileURLToPath(new URL("./catalog.ts", import.meta.url));
  const run = (...args: string[]) => {
    const result = Bun.spawnSync([process.execPath, cli, ...args], { stdout: "pipe", stderr: "pipe" });
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  };
  test("resolves a legacy skill but does not run its explicit operation", () => {
    const result = run("skill", "publish");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ rawName: "publish", skill: "publish-change", mode: "release" });
  });
  test("requires an explicit action role and never fabricates freshness", () => {
    const absent = run("agent", "async-runtime-specialist");
    expect(absent.code).toBe(2);
    expect(absent.stderr).toContain("--role is required");
    const registry = readMigrationCatalog();
    const root = mkdtempSync(join(tmpdir(), "catalog-cli-"));
    writeFileSync(join(root, "catalog.json"), JSON.stringify(registry.catalog));
    mkdirSync(join(root, "docs/profiles"), { recursive: true });
    writeFileSync(join(root, "docs/profiles/async.md"), "Async invariants");
    const result = run("agent", "async-runtime-specialist", "--role", "reviewer", "--root", root);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ rawName: "async-runtime-specialist", role: "reviewer", model: "inherit", profiles: ["async"] });
    expect(JSON.parse(result.stdout)).not.toHaveProperty("fresh");
    expect(run("agent", "async-runtime-specialist", "--role", "reviewer", "--profiles", "security", "--root", root).code).toBe(2);
  });
  test("unknown names fail and help states the authority boundary", () => {
    expect(run("agent", "invented", "--role", "reviewer").code).toBe(2);
    expect(run("skill", "invented").code).toBe(2);
    expect(run("--help").stdout).toContain("no task edits, dispatch, authorization, or freshness claim");
  });
});
