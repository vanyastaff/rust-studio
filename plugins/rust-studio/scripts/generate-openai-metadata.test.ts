import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("metadata preserves callable names with either description form", () => {
  const root = mkdtempSync(join(tmpdir(), "rs-metadata-"));
  try {
    mkdirSync(join(root, "scripts"));
    const script = join(root, "scripts/generate-openai-metadata.mjs");
    cpSync(new URL("./generate-openai-metadata.mjs", import.meta.url), script);
    const descriptions = {
      "review-work": "Review Rust changes for correctness and missing tests.",
      "inspect-project": "Use when starting Rust work: select an available workflow.",
      "publish-change": "Prepare a Rust crate release and publishing dry run.",
    };
    writeFileSync(join(root, "catalog.json"), JSON.stringify({ skills: Object.fromEntries(Object.keys(descriptions).map(name => [name, { explicitOnly: name === "publish-change" }])) }));
    for (const [name, description] of Object.entries(descriptions)) {
      const dir = join(root, "skills", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: "${description}"\n---\n`);
    }
    const run = Bun.spawnSync(["node", script]);
    expect(run.exitCode).toBe(0);
    for (const name of Object.keys(descriptions)) {
      const metadata = readFileSync(join(root, "skills", name, "agents/openai.yaml"), "utf8");
      expect(metadata).toContain(`Use $${name}`);
      if (name === "publish-change") expect(metadata).toContain("allow_implicit_invocation: false");
      if (name === "review-work") expect(metadata).toContain('display_name: "Review Work"');
    }
    expect(Bun.spawnSync(["node", script, "--check"]).exitCode).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("catalog policy drives all eleven names and exactly three explicit-only entries", () => {
  const root = mkdtempSync(join(tmpdir(), "rs-metadata-catalog-"));
  try {
    mkdirSync(join(root, "scripts"));
    const script = join(root, "scripts/generate-openai-metadata.mjs");
    cpSync(new URL("./generate-openai-metadata.mjs", import.meta.url), script);
    const catalog = JSON.parse(readFileSync(new URL("../catalog.json", import.meta.url), "utf8"));
    writeFileSync(join(root, "catalog.json"), JSON.stringify(catalog));
    for (const name of Object.keys(catalog.skills)) {
      const dir = join(root, "skills", name); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), `---\r\nname: ${name}\r\ndescription: "Inspect the requested Rust project outcome and its evidence."\r\n---\r\n`);
    }
    expect(Bun.spawnSync(["node", script], { timeout: 10000 }).exitCode).toBe(0);
    let explicit = 0;
    for (const [name, config] of Object.entries(catalog.skills) as [string, any][]) {
      const text = readFileSync(join(root, "skills", name, "agents/openai.yaml"), "utf8");
      expect(text).toContain(`Use $${name}`);
      expect(text.includes("allow_implicit_invocation: false")).toBe(config.explicitOnly);
      if (config.explicitOnly) explicit++;
    }
    expect(Object.keys(catalog.skills)).toHaveLength(11);
    expect(explicit).toBe(3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
