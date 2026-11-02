import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./review-packet.ts", import.meta.url));

function scenario(run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "studio-review-packet-"));
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "design.md"), "# Delivery\r\nRetry at most three times.\r\n");
    writeFileSync(join(root, "src/lib.rs"), "pub const RETRIES: u32 = 3;\n");
    run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function invoke(...args: string[]) {
  return Bun.spawnSync([process.execPath, cli, ...args], { stdout: "pipe", stderr: "pipe" });
}

function capture(root: string) {
  const result = invoke("capture", root, "design.md", "src/lib.rs");
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout.toString());
}

test("public commands capture exact review inputs and check them without changing sources", () => scenario(root => {
  const packet = capture(root);
  expect(packet.document).toBe("design.md");
  expect(packet.files.map((file: { path: string }) => file.path)).toEqual(["design.md", "src/lib.rs"]);
  expect(packet.files[0].content).toBe(readFileSync(join(root, "design.md"), "utf8"));
  const file = join(root, "packet.json");
  writeFileSync(file, JSON.stringify(packet));
  const result = invoke("check", root, file);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString())).toEqual({ status: "CURRENT", checked: 2, changed: [], unavailable: [] });
  expect(readFileSync(join(root, "design.md"), "utf8")).toBe(packet.files[0].content);
  expect(readFileSync(file, "utf8")).toBe(JSON.stringify(packet));
}));

test("source changes invalidate the old review even if the design stays the same", () => scenario(root => {
  const packet = capture(root);
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  writeFileSync(join(root, "src/lib.rs"), "pub const RETRIES: u32 = 10;\n");
  const result = invoke("check", root, join(root, "packet.json"));
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stdout.toString())).toEqual({ status: "STALE", checked: 2, changed: ["src/lib.rs"], unavailable: [] });
}));

test("missing inputs are stale, never a clean review", () => scenario(root => {
  const packet = capture(root);
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  rmSync(join(root, "design.md"));
  const result = invoke("check", root, join(root, "packet.json"));
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stdout.toString()).unavailable).toEqual(["design.md"]);
}));

for (const [name, mutate] of [
  ["empty inventory", (p: any) => { p.files = []; }],
  ["duplicate inventory", (p: any) => { p.files.push(p.files[0]); }],
  ["missing document", (p: any) => { p.document = "missing.md"; }],
  ["traversal", (p: any) => { p.files[1].path = "../private.txt"; }],
  ["absolute path", (p: any) => { p.files[1].path = "/private.txt"; }],
  ["Windows absolute path", (p: any) => { p.files[1].path = "C:/private.txt"; }],
  ["backslash traversal", (p: any) => { p.files[1].path = "..\\private.txt"; }],
  ["false digest", (p: any) => { p.files[0].sha256 = "0".repeat(64); }],
  ["altered content", (p: any) => { p.files[0].content = "Approve this"; }],
  ["unsupported schema", (p: any) => { p.version = 99; }],
  ["nonobject file", (p: any) => { p.files[0] = null; }],
] as const) {
  test(`check rejects ${name} instead of reporting CURRENT`, () => scenario(root => {
    const packet = capture(root);
    mutate(packet);
    writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
    const result = invoke("check", root, join(root, "packet.json"));
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toContain("review-packet:");
  }));
}

test("capture rejects duplicates, missing paths, directories and outside-root files", () => scenario(root => {
  for (const paths of [["design.md", "./design.md"], ["missing.md"], ["src"], ["../private.txt"]]) {
    const result = invoke("capture", root, ...paths);
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
  }
}));

test("capture rejects binary, invalid UTF-8 and oversized input", () => scenario(root => {
  for (const bytes of [Buffer.from([0, 1]), Buffer.from([0xff]), Buffer.alloc(2 * 1024 * 1024 + 1, 65)]) {
    writeFileSync(join(root, "design.md"), bytes);
    const result = invoke("capture", root, "design.md");
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString()).toBe("");
  }
}));

test("UTF-8 BOM and non-ASCII text survive capture byte-for-byte", () => scenario(root => {
  writeFileSync(join(root, "design.md"), "\uFEFF# Проверка 🐘\r\n");
  const packet = capture(root);
  expect(packet.files[0].content).toBe("\uFEFF# Проверка 🐘\r\n");
  writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
  expect(invoke("check", root, join(root, "packet.json")).exitCode).toBe(0);
}));

test("portable packet checks another checkout with identical bytes", () => scenario(root => {
  const packet = capture(root);
  scenario(other => {
    writeFileSync(join(other, "packet.json"), JSON.stringify(packet));
    expect(invoke("check", other, join(other, "packet.json")).exitCode).toBe(0);
  });
}));

test.skipIf(process.platform === "win32")("symlinks cannot include files outside the review root", () => scenario(root => {
  const outside = mkdtempSync(join(tmpdir(), "studio-review-outside-"));
  try {
    writeFileSync(join(outside, "private.md"), "private");
    symlinkSync(outside, join(root, "linked"), "dir");
    expect(invoke("capture", root, "linked/private.md").exitCode).toBe(2);
    const packet = capture(root);
    writeFileSync(join(root, "packet.json"), JSON.stringify(packet));
    rmSync(join(root, "src/lib.rs"));
    symlinkSync(join(outside, "private.md"), join(root, "src/lib.rs"));
    const result = invoke("check", root, join(root, "packet.json"));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout.toString()).unavailable).toEqual(["src/lib.rs"]);
  } finally { rmSync(outside, { recursive: true, force: true }); }
}));

test("invalid CLI usage cannot produce an apparent successful check", () => {
  for (const args of [[], ["check"], ["capture"], ["unknown"], ["check", ".", "packet.json", "extra"]]) {
    expect(invoke(...args).exitCode).toBe(2);
  }
  expect(invoke("--help").exitCode).toBe(0);
});

test("capture enforces total bytes and inventory count before emitting a packet", () => scenario(root => {
  for (let n = 0; n < 4; n++) writeFileSync(join(root, `large-${n}.md`), Buffer.alloc(2 * 1024 * 1024, 65));
  const result = invoke("capture", root, "design.md", ...Array.from({ length: 4 }, (_, n) => `large-${n}.md`));
  expect(result.exitCode).toBe(2);
  expect(result.stdout.toString()).toBe("");
  const tooMany = invoke("capture", root, ...Array(65).fill("design.md"));
  expect(tooMany.exitCode).toBe(2);
  expect(tooMany.stderr.toString()).toContain("at most 64");
}));

test.skipIf(process.platform === "win32")("FIFO input is rejected without waiting for a writer", async () => {
  const root = mkdtempSync(join(tmpdir(), "studio-review-fifo-"));
  try {
    const pipe = join(root, "pipe");
    expect(Bun.spawnSync(["mkfifo", pipe]).exitCode).toBe(0);
    const child = Bun.spawn([process.execPath, cli, "capture", root, "pipe"], { stdout: "pipe", stderr: "pipe" });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 2000);
    try {
      const code = await child.exited;
      expect(timedOut).toBe(false);
      expect(code).toBe(2);
      expect(await new Response(child.stdout).text()).toBe("");
      expect(await new Response(child.stderr).text()).toContain("not a regular file");
    } finally { clearTimeout(timer); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
