import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const script = resolve(import.meta.dir, "generate-codex-agents.mjs");
const roots: string[] = [];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "studio-codex-")); roots.push(root);
  mkdirSync(join(root, "agents"));
  mkdirSync(join(root, "scripts")); writeFileSync(join(root, "scripts/generate-codex-agents.mjs"), readFileSync(script));
  mkdirSync(join(root, "out"));
  writeFileSync(join(root, "catalog.json"), JSON.stringify({ agents: { implementer: { model: "sonnet", legacy: { "rust-builder": "implementation" } } } }));
  writeFileSync(join(root, "agents/implementer.md"), "---\nname: implementer\ndescription: Implement scoped Rust changes.\nmodel: sonnet\n---\nImplement changes.\n");
  return root;
}
function run(root: string) { return Bun.spawnSync(["node", join(root, "scripts/generate-codex-agents.mjs"), join(root, "out")], { timeout: 10000 }); }

test("ownership migration retires only unchanged owned legacy definitions", () => {
  const root = fixture();
  const legacy = "previous generated definition\n";
  writeFileSync(join(root, "out/rust-builder.toml"), legacy);
  writeFileSync(join(root, "out/.rust-studio-agents.json"), JSON.stringify({ version: 1, files: { "rust-builder.toml": hash(legacy) } }));
  const result = run(root);
  expect(result.exitCode).toBe(0);
  expect(existsSync(join(root, "out/rust-builder.toml"))).toBe(false);
  expect(existsSync(join(root, "out/implementer.toml"))).toBe(true);
});

test("unknown and customized definitions are preserved and reported", () => {
  const root = fixture();
  writeFileSync(join(root, "out/implementer.toml"), "custom active\n");
  writeFileSync(join(root, "out/rust-builder.toml"), "custom legacy\n");
  writeFileSync(join(root, "out/unrelated.toml"), "unrelated\n");
  writeFileSync(join(root, "out/.rust-studio-agents.json"), JSON.stringify({ version: 1, files: { "rust-builder.toml": hash("original") } }));
  const result = run(root);
  expect(result.exitCode).toBe(0);
  expect(readFileSync(join(root, "out/implementer.toml"), "utf8")).toBe("custom active\n");
  expect(readFileSync(join(root, "out/rust-builder.toml"), "utf8")).toBe("custom legacy\n");
  expect(readFileSync(join(root, "out/unrelated.toml"), "utf8")).toBe("unrelated\n");
  expect(result.stderr.toString()).toContain("preserved");
});


test("public generator preserves CRLF parsing and catalog model routing for five roles", () => {
  const root = fixture();
  const catalog = JSON.parse(readFileSync(resolve(import.meta.dir, "../catalog.json"), "utf8"));
  writeFileSync(join(root, "catalog.json"), JSON.stringify(catalog));
  for (const [name, def] of Object.entries(catalog.agents) as [string, { model: string }][]) {
    const text = `---\nname: ${name}\ndescription: ${name} scoped Rust work.\nmodel: ${def.model}\n${name === "implementer" ? "" : "disallowedTools: Write, Edit, NotebookEdit\n"}---\nRead \u0024{CLAUDE_PLUGIN_ROOT}/docs/contract.md.\n`;
    writeFileSync(join(root, `agents/${name}.md`), text);
  }
  expect(run(root).exitCode).toBe(0);
  const original = new Map(Object.keys(catalog.agents).map(name => [name, readFileSync(join(root, `out/${name}.toml`), "utf8")]));
  expect(original.size).toBe(5);
  for (const [name, toml] of original) {
    expect(toml).toContain(`name = "${name}"`);
    expect(toml).toContain("developer_instructions = '''");
    expect(toml).not.toMatch(/^(model|color|disallowedTools|memory) =/m);
    expect(toml).not.toContain("${CLAUDE_PLUGIN_ROOT}");
    expect(toml).toContain(root);
    expect(toml.includes('sandbox_mode = "read-only"')).toBe(name !== "implementer");
    const brief = join(root, `agents/${name}.md`);
    writeFileSync(brief, readFileSync(brief, "utf8").replace(/\n/g, "\r\n"));
  }
  expect(run(root).exitCode).toBe(0);
  for (const [name, toml] of original) expect(readFileSync(join(root, `out/${name}.toml`), "utf8")).toBe(toml);
  const routing = join(root, "routing.json");
  writeFileSync(routing, JSON.stringify({ haiku: { model: "fast-model", model_reasoning_effort: "low" }, sonnet: { model: "standard-model", model_reasoning_effort: "medium" } }));
  const result = Bun.spawnSync(["node", join(root, "scripts/generate-codex-agents.mjs"), join(root, "out"), "--routing", routing], { timeout: 10000 });
  expect(result.exitCode).toBe(0);
  expect(readFileSync(join(root, "out/researcher.toml"), "utf8")).toContain('model = "fast-model"');
  expect(readFileSync(join(root, "out/implementer.toml"), "utf8")).toContain('model_reasoning_effort = "medium"');
  expect(readFileSync(join(root, "out/reviewer.toml"), "utf8")).not.toMatch(/^model(?:_reasoning_effort)? =/m);
});

test("unknown legacy with a generated header remains unowned across repeated runs", () => {
  const root = fixture();
  const legacy = "# Generated by rust-studio scripts/generate-codex-agents.mjs — do not edit by hand.\n";
  writeFileSync(join(root, "out/rust-builder.toml"), legacy);
  for (let i = 0; i < 2; i++) {
    const result = run(root);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toContain("rust-builder.toml");
    expect(readFileSync(join(root, "out/rust-builder.toml"), "utf8")).toBe(legacy);
    expect(JSON.parse(readFileSync(join(root, "out/.rust-studio-agents.json"), "utf8")).files["rust-builder.toml"]).toBeUndefined();
  }
});

test("customization after generation survives future runs without becoming owned", () => {
  const root = fixture();
  expect(run(root).exitCode).toBe(0);
  const original = JSON.parse(readFileSync(join(root, "out/.rust-studio-agents.json"), "utf8"));
  writeFileSync(join(root, "out/implementer.toml"), "custom\n");
  for (let i = 0; i < 2; i++) {
    expect(run(root).exitCode).toBe(0);
    expect(readFileSync(join(root, "out/implementer.toml"), "utf8")).toBe("custom\n");
    expect(JSON.parse(readFileSync(join(root, "out/.rust-studio-agents.json"), "utf8"))).toEqual(original);
  }
});

test("invalid manifest fails before replacing files", () => {
  const root = fixture();
  writeFileSync(join(root, "out/.rust-studio-agents.json"), JSON.stringify({ version: 1, files: { "../outside.toml": hash("outside") } }));
  expect(run(root).exitCode).not.toBe(0);
  expect(existsSync(join(root, "out/implementer.toml"))).toBe(false);
});

test("invalid catalog brief fails before any output mutation", () => {
  const root = fixture();
  writeFileSync(join(root, "catalog.json"), JSON.stringify({ agents: { implementer: { model: "sonnet" }, reviewer: { model: "inherit" } } }));
  expect(run(root).exitCode).not.toBe(0);
  expect(existsSync(join(root, "out/implementer.toml"))).toBe(false);
  expect(existsSync(join(root, "out/.rust-studio-agents.json"))).toBe(false);
});
