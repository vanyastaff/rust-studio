import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./design-workflow.ts", import.meta.url));
const design = "docs/designs/demo";
const briefPath = `${design}/handoff-T1.json`;
const table = (state = "in-progress", dependency = "done", conflict = "—") =>
  `| # | Depends on | Conflicts with | Status |\n|---|---|---|---|\n| T0 | — | — | ${dependency} |\n| T1 | T0 | ${conflict} | ${state} |\n| T2 | — | — | in-progress |\n`;

function setup(run: (root: string, brief: Record<string, unknown>) => void) {
  const root = mkdtempSync(join(tmpdir(), "studio-design-"));
  const brief = { version: 1, task: "T1", mode: "start", goal: "Expose bounded retries",
    context: "docs/designs/CONTEXT.md", request: "intent/demo.md", designReview: `${design}/design-review.md`,
    authorization: "User requested implementation of bounded retries", writePaths: ["src/lib.rs"],
    acceptance: ["cargo test: retry bounds pass"], constraints: ["No new dependencies"], sources: ["src/lib.rs"] };
  try {
    for (const [path, content] of Object.entries({
      [`${design}/spec.md`]: "# Spec\n- **Slug:** `demo`\n",
      [`${design}/tasks.md`]: table(),
      [`${design}/design-review.md`]: "# Design review\nVerdict: READY\n",
      "docs/designs/CONTEXT.md": "# Context\nDependency-free library.\n",
      "intent/demo.md": "# Original request\nBound retries.\n",
      "src/lib.rs": "pub fn attempts() -> u32 { 0 }\n",
      [briefPath]: JSON.stringify(brief),
    })) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), content); }
    run(root, brief);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function invoke(...args: string[]) {
  return Bun.spawnSync([process.execPath, cli, ...args], { stdout: "pipe", stderr: "pipe", timeout: 5000 });
}

function prepare(root: string) {
  const result = invoke("prepare", root, "demo", briefPath);
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout.toString());
}

test("public handoff captures all essential artifacts without granting permission or changing task status", () => setup(root => {
  const before = readFileSync(join(root, design, "tasks.md"), "utf8");
  const packet = prepare(root);
  expect(packet.status).toBe("PREPARED");
  expect(packet.handoff).toEqual({ task: "T1", mode: "start", brief: briefPath });
  expect(packet.files.map((f: { path: string }) => f.path)).toEqual([
    `${design}/spec.md`, `${design}/tasks.md`, briefPath, "docs/designs/CONTEXT.md", "intent/demo.md", `${design}/design-review.md`, "src/lib.rs",
  ]);
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  expect(invoke("check", root, "packet.json").exitCode).toBe(0);
  expect(readFileSync(join(root, design, "tasks.md"), "utf8")).toBe(before);
}));

test("fresh worker pre-write check rejects source mutation after reconstruction", () => setup(root => {
  const packet = prepare(root);
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  writeFileSync(join(root, "src/lib.rs"), "pub fn attempts() -> u32 { 99 }\n");
  const result = invoke("check", root, "packet.json");
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stdout.toString()).changed).toEqual(["src/lib.rs"]);
}));

test("task bookkeeping is frozen during a challenge and changes invalidate pre-write inputs", () => setup(root => {
  writeFileSync(join(root, "packet.json"), JSON.stringify(prepare(root)));
  writeFileSync(join(root, design, "tasks.md"), table("done"));
  expect(invoke("check", root, "packet.json").exitCode).toBe(1);
}));

for (const [label, plan] of [
  ["unreserved task", table("todo")], ["completed task", table("done")],
  ["unfinished prerequisite", table("in-progress", "in-progress")],
  ["active declared conflict", table("in-progress", "done", "T2")],
] as const) {
  test(`prepare rejects ${label}`, () => setup(root => {
    writeFileSync(join(root, design, "tasks.md"), plan);
    const result = invoke("prepare", root, "demo", briefPath);
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
  }));
}

test("active task resumes with preserved evidence instead of resetting it to todo", () => setup((root, brief) => {
  brief.mode = "resume";
  writeFileSync(join(root, briefPath), JSON.stringify(brief));
  expect(invoke("prepare", root, "demo", briefPath).exitCode).toBe(2);
  brief.resumeEvidence = "tasks.md execution entry: integrated partial diff; repair dispatch count 2; next run bounds tests";
  writeFileSync(join(root, briefPath), JSON.stringify(brief));
  expect(prepare(root).handoff.mode).toBe("resume");
  expect(readFileSync(join(root, design, "tasks.md"), "utf8")).toBe(table());
}));

for (const field of ["context", "request", "designReview", "authorization", "goal", "writePaths", "acceptance", "constraints", "sources"]) {
  test(`prepare rejects missing ${field}`, () => setup((root, brief) => {
    delete brief[field];
    writeFileSync(join(root, briefPath), JSON.stringify(brief));
    expect(invoke("prepare", root, "demo", briefPath).exitCode).toBe(2);
  }));
}

test("write ownership and source paths cannot escape the repository", () => setup((root, brief) => {
  for (const paths of [["../other"], ["/tmp/other"], ["C:/other"], ["."], ["src/../other"]]) {
    brief.writePaths = paths;
    writeFileSync(join(root, briefPath), JSON.stringify(brief));
    expect(invoke("prepare", root, "demo", briefPath).exitCode).toBe(2);
  }
}));

test("missing evidence, unknown task and malformed plan never prepare", () => setup((root, brief) => {
  brief.sources = ["not-found.rs"];
  writeFileSync(join(root, briefPath), JSON.stringify(brief));
  expect(invoke("prepare", root, "demo", briefPath).exitCode).toBe(2);
  brief.sources = ["src/lib.rs"]; brief.task = "UNKNOWN";
  writeFileSync(join(root, briefPath), JSON.stringify(brief));
  expect(invoke("prepare", root, "demo", briefPath).exitCode).toBe(2);
  brief.task = "T1";
  writeFileSync(join(root, briefPath), JSON.stringify(brief));
  writeFileSync(join(root, design, "tasks.md"), "# no task table");
  expect(invoke("prepare", root, "demo", briefPath).exitCode).toBe(2);
}));

test("check rejects metadata tampering and an incomplete packet even with valid remaining digests", () => setup(root => {
  const packet = prepare(root);
  packet.handoff.task = "T2";
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  expect(invoke("check", root, "packet.json").exitCode).toBe(2);
  packet.handoff.task = "T1";
  packet.files = packet.files.filter((f: { path: string }) => f.path !== "intent/demo.md");
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  expect(invoke("check", root, "packet.json").exitCode).toBe(2);
}));

test("explicit legacy design resolves, ambiguous slug does not silently choose", () => setup(root => {
  const old = ".rust-studio/specs/demo";
  mkdirSync(join(root, old), { recursive: true });
  writeFileSync(join(root, old, "spec.md"), "# Old design");
  expect(invoke("resolve", root, "demo").exitCode).toBe(2);
  const result = invoke("resolve", root, old);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).kind).toBe("legacy");
  expect(invoke("resolve", root, design).exitCode).toBe(0);
}));

test("an explicit root-level design captures its sibling task plan", () => setup(root => {
  writeFileSync(join(root, "spec.md"), "# Root design\n");
  writeFileSync(join(root, "tasks.md"), table());
  const result = invoke("prepare", root, "spec.md", briefPath);
  expect(result.exitCode).toBe(0);
  const packet = JSON.parse(result.stdout.toString());
  expect(packet.files.map((file: { path: string }) => file.path)).toContain("tasks.md");
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  expect(invoke("check", root, "packet.json").exitCode).toBe(0);
}));

test("a packaged CLI operates after copying only its declared standalone dependencies", () => setup(root => {
  const install = join(root, "standalone");
  mkdirSync(install);
  const sources = {
    "design-workflow.ts": readFileSync(cli, "utf8").replace("../hooks/scripts/design-paths.ts", "./design-paths.ts"),
    "design-paths.ts": readFileSync(fileURLToPath(new URL("../hooks/scripts/design-paths.ts", import.meta.url)), "utf8"),
    "plan-status.ts": readFileSync(fileURLToPath(new URL("./plan-status.ts", import.meta.url)), "utf8"),
    "review-packet.ts": readFileSync(fileURLToPath(new URL("./review-packet.ts", import.meta.url)), "utf8"),
  };
  for (const [name, content] of Object.entries(sources)) writeFileSync(join(install, name), content);
  const result = Bun.spawnSync([process.execPath, join(install, "design-workflow.ts"), "prepare", root, "demo", briefPath], { timeout: 5000 });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).status).toBe("PREPARED");
}));
