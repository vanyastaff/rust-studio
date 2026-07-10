import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dir, "generate-codex-agents.mjs");
const outDir = mkdtempSync(join(tmpdir(), "codex-agents-"));
const proc = Bun.spawnSync(["node", script, outDir]);

describe("generate-codex-agents", () => {
  test("writes one TOML per agent brief", () => {
    expect(proc.exitCode).toBe(0);
    const agents = readdirSync(resolve(import.meta.dir, "../agents")).filter((f) =>
      f.endsWith(".md"),
    );
    const tomls = readdirSync(outDir).filter((f) => f.endsWith(".toml"));
    expect(tomls.length).toBe(agents.length);
  });

  test("maps fields and body into the Codex agent format", () => {
    const builder = readFileSync(join(outDir, "rust-builder.toml"), "utf8");
    expect(builder).toContain('name = "rust-builder"');
    expect(builder).toMatch(/description = "Implement, write, build Rust code/);
    expect(builder).toContain("developer_instructions = '''");
    expect(builder).toContain("Rust Builder");
    expect(builder).not.toContain("sandbox_mode");
  });

  test("read-only agents get a read-only sandbox", () => {
    for (const agent of ["rust-scout", "rust-reviewer", "security-auditor", "unsafe-auditor"]) {
      const toml = readFileSync(join(outDir, `${agent}.toml`), "utf8");
      expect(toml).toContain('sandbox_mode = "read-only"');
    }
  });

  test("no Claude-only frontmatter leaks into the TOML", () => {
    for (const file of readdirSync(outDir)) {
      const toml = readFileSync(join(outDir, file), "utf8");
      expect(toml).not.toMatch(/^(model|color|disallowedTools|memory) =/m);
    }
  });
});
