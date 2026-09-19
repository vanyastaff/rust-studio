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
      review: "Review Rust changes for correctness and missing tests.",
      start: "Use when starting Rust work: select an available workflow.",
      publish: "Prepare a Rust crate release and publishing dry run.",
    };
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
      if (name === "publish") expect(metadata).toContain("allow_implicit_invocation: false");
      if (name === "review") expect(metadata).toContain('display_name: "Rust Code Review"');
    }
    expect(Bun.spawnSync(["node", script, "--check"]).exitCode).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
