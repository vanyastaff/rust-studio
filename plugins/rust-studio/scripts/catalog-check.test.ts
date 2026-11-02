import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { checkCatalog } from "./catalog-check.ts";
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "studio-catalog-")); roots.push(root);
  const catalog = JSON.parse(readFileSync(resolve(import.meta.dir, "../catalog.json"), "utf8"));
  function write(file: string, text: string) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); }
  for (const [name, skill] of Object.entries(catalog.skills) as [string, any][]) {
    write(`skills/${name}/SKILL.md`, `---\nname: ${name}\n---\n`);
    for (const operation of Object.values(skill.operations) as any[]) operation.procedure = "docs/procedures/example.md#operation";
    write(`skills/${name}/references/procedures/example.md`, "# Operation\n");
  }
  for (const [name, agent] of Object.entries(catalog.agents) as [string, any][]) write(`agents/${name}.md`, `---\nname: ${name}\nmodel: ${agent.model}\n---\n`);
  for (const file of Object.values(catalog.profiles) as string[]) write(file, "# Profile\n");
  write("docs/procedures/example.md", "# Operation\n");
  const save = () => write("catalog.json", JSON.stringify(catalog)); save();
  return { root, catalog, save, write };
}
test("complete catalog and portable operation destinations pass through public CLI", () => {
  const { root } = fixture();
  expect(checkCatalog(root)).toEqual([]);
  const result = Bun.spawnSync([process.execPath, resolve(import.meta.dir, "catalog-check.ts"), root], { timeout: 10000 });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("11 skills, 5 roles");
});
test("installed aliases and unknown skill directories cannot hide behind expected counts", () => {
  const { root, write } = fixture();
  write("skills/old-wrapper/SKILL.md", "# Alias\n");
  write("agents/rust-builder.md", "# Alias\n");
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("unexpected old-wrapper");
  expect(errors).toContain("legacy agent rust-builder: installed alias remains");
});
test("migration coverage requires each old capability exactly once", () => {
  const { root, catalog, save } = fixture();
  catalog.skills["review-work"].legacy.push("adopt");
  delete catalog.skills["inspect-project"].operations.start;
  save();
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("duplicate migration");
  expect(errors).toContain("missing start");
});
test("operations need canonical procedures, real anchors and portable copies", () => {
  const { root, catalog, save } = fixture();
  delete catalog.skills["inspect-project"].operations.adopt.procedure;
  catalog.skills["inspect-project"].operations.start.procedure = "docs/procedures/example.md#missing";
  rmSync(join(root, "skills/review-work/references/procedures/example.md"));
  save();
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("adopt: missing procedure destination");
  expect(errors).toContain("missing procedure anchor missing");
  expect(errors).toContain("standalone bundle: missing");
});
test("missing profiles or unknown legacy lenses block catalog acceptance", () => {
  const { root, catalog, save } = fixture();
  rmSync(join(root, catalog.profiles.async));
  catalog.agents.implementer.legacy["rust-builder"] = "absent";
  save();
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("profile async: missing");
  expect(errors).toContain("unknown required profile absent");
});
test("effect classification and model classes are checked against metadata", () => {
  const { root, catalog, save, write } = fixture();
  catalog.skills["publish-change"].explicitOnly = false;
  write("agents/reviewer.md", "---\nname: reviewer\nmodel: sonnet\n---\n"); save();
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("expected three explicit-only");
  expect(errors).toContain("reviewer: model class differs");
});

test("standalone executable imports cannot escape their skill or omit dependencies", () => {
  const { root, write } = fixture();
  write("skills/inspect-project/scripts/report.ts", 'import { check } from "./missing.ts";\n');
  write("skills/review-work/scripts/check.ts", 'import { check } from "../../../outside.ts";\n');
  write("outside.ts", "export const check = true;\n");
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("missing or nonportable import ./missing.ts");
  expect(errors).toContain("missing or nonportable import ../../../outside.ts");
});

test("portable profiles cannot retain host-root helpers or omit their executable", () => {
  const { root, write } = fixture();
  write("skills/design-change/references/profiles/structure.md", 'Run `${CLAUDE_PLUGIN_ROOT}/scripts/slop-audit.sh`.\n');
  write("skills/design-change/references/profiles/documentation.md", 'Run `bun scripts/prose-gate.ts`.\n');
  const errors = checkCatalog(root).join("\n");
  expect(errors).toContain("unresolved host-root helper");
  expect(errors).toContain("missing profile helper scripts/prose-gate.ts");
});
