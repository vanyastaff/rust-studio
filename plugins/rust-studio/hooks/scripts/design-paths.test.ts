import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESIGN_ROOTS, defaultDesignCwd, resolveDesign } from "./design-paths.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "design-paths-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));
function spec(dir: string, text = "# Spec\n"): string {
  mkdirSync(join(root, dir), { recursive: true });
  const file = join(root, dir, "spec.md");
  writeFileSync(file, text);
  return file;
}

test("default roots resolve existing shared and legacy designs without writing", () => {
  expect(DESIGN_ROOTS).toEqual(["docs/designs", ".rust-studio/specs"]);
  for (const [base, slug, kind] of [["docs/designs", "new", "shared"], [".rust-studio/specs", "old", "legacy"]]) {
    const path = spec(`${base}/${slug}`);
    expect(resolveDesign(root, slug)).toEqual({ slug, spec: `${base}/${slug}/spec.md`, dir: `${base}/${slug}`, kind });
    expect(readFileSync(path, "utf8")).toBe("# Spec\n");
  }
});

test("colliding slugs reject shorthand while explicit directory and spec select one", () => {
  spec("docs/designs/demo");
  spec(".rust-studio/specs/demo");
  expect(() => resolveDesign(root, "demo")).toThrow(/ambig/i);
  expect(resolveDesign(root, "docs/designs/demo").kind).toBe("shared");
  expect(resolveDesign(root, join(root, ".rust-studio/specs/demo/spec.md")).kind).toBe("legacy");
  expect(resolveDesign(root, "docs\\designs\\demo\\spec.md").spec).toBe("docs/designs/demo/spec.md");
});

test("explicit custom artifacts derive a valid folder slug or metadata", () => {
  spec("architecture/custom");
  expect(resolveDesign(root, "architecture/custom/spec.md")).toEqual({ slug: "custom", dir: "architecture/custom", spec: "architecture/custom/spec.md", kind: "custom" });
  spec("architecture/design notes", "# Spec\n- **Slug:** `named-design`\n");
  expect(resolveDesign(root, "architecture/design notes").slug).toBe("named-design");
  spec("architecture/invalid folder", "# Spec\n- **Slug:** `../bad`\n");
  expect(() => resolveDesign(root, "architecture/invalid folder")).toThrow(/slug/i);
});

test("default-root metadata cannot silently rename the artifact identity", () => {
  spec("docs/designs/demo", "# Spec\n- **Slug:** `other`\n");
  expect(() => resolveDesign(root, "demo")).toThrow(/conflict/i);
  spec(".rust-studio/specs/name.md");
  expect(resolveDesign(root, "name.md").slug).toBe("name.md");
});

test("missing artifacts and paths escaping the supplied root reject", () => {
  expect(() => resolveDesign(root, "missing")).toThrow();
  expect(() => resolveDesign(root, "../spec.md")).toThrow(/outside|escape/i);
  const outside = mkdtempSync(join(tmpdir(), "design-outside-"));
  try {
    writeFileSync(join(outside, "spec.md"), "# Outside\n");
    expect(() => resolveDesign(root, join(outside, "spec.md"))).toThrow(/outside|escape/i);
    symlinkSync(outside, join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
    expect(() => resolveDesign(root, "./linked/spec.md")).toThrow(/outside|escape/i);
  } finally { rmSync(join(root, "linked"), { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});

test("checker cwd is the owner of either standard root, else the ledger directory", () => {
  expect(defaultDesignCwd(join(root, "docs/designs/demo/acceptance.md"))).toBe(root);
  expect(defaultDesignCwd(join(root, ".rust-studio/specs/demo/acceptance.md"))).toBe(root);
  expect(defaultDesignCwd(join(root, "custom/acceptance.md"))).toBe(join(root, "custom"));
});
