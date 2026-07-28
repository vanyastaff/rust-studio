import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
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

describe("doc pointers survive the trip to Codex", () => {
  // Claude Code expands ${CLAUDE_PLUGIN_ROOT} when it loads an agent brief; Codex
  // cannot, because these TOMLs are installed to ~/.codex/agents/ outside any
  // plugin. An unresolved placeholder is the worst kind of defect for a prompt —
  // the agent reads it as a path, silently fails to open it, and carries on
  // without the standard it was told to follow. 159 of them shipped this way.
  const tomls = readdirSync(outDir).filter((f) => f.endsWith(".toml"));

  test("no plugin-root placeholder reaches Codex", () => {
    const offenders = tomls.filter((f) =>
      /\$\{CLAUDE_[A-Z_]*\}/.test(readFileSync(join(outDir, f), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  test("every cited studio doc resolves to a file that exists", () => {
    const root = resolve(import.meta.dir, "..");
    const missing = new Set<string>();
    for (const f of tomls) {
      const body = readFileSync(join(outDir, f), "utf8");
      for (const [, p] of body.matchAll(/(\/[^\s`)"']*\/(?:docs|rules)\/[a-z0-9-]+\.md)/g)) {
        if (p.startsWith(root) && !existsSync(p)) missing.add(`${f}: ${p}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  test("the generated file records which tree its pointers resolve against", () => {
    // Without this a user cannot tell a stale pointer from a moved checkout.
    const body = readFileSync(join(outDir, tomls[0]), "utf8");
    expect(body).toContain("Doc pointers below resolve against:");
  });
});
