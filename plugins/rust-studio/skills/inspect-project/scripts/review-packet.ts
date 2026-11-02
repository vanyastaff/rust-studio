#!/usr/bin/env bun
// Snapshot explicit review inputs; check freshness without executing or changing them.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

type ReviewFile = { path: string; sha256: string; content: string };
type Packet = { version: 1; document: string; files: ReviewFile[] };
const maxFileBytes = 2 * 1024 * 1024;
const maxTotalBytes = 8 * 1024 * 1024;
const maxFiles = 64;
const usage = `usage:
  review-packet.ts capture <root> <document> [source ...]
  review-packet.ts check <root> <packet.json>

Both commands emit JSON to stdout and never write files. Paths in capture are relative
to root (absolute paths within root also work). Save capture output outside the inputs.
check exits 0 for CURRENT bytes, 1 for STALE/unavailable inputs, 2 for invalid input.
CURRENT does not establish review completeness, isolation, or semantic correctness.`;

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function sourcePath(root: string, input: string): string {
  const path = resolve(root, input);
  if (!inside(root, path) || !inside(root, realpathSync(path))) {
    throw new Error(`input is outside root: ${input}`);
  }
  return path;
}

// Bound reads before allocation, including a file replaced by a directory or device.
function readBounded(path: string, limit: number): Buffer {
  if (!statSync(path).isFile()) throw new Error(`not a regular file: ${path}`);
  // A FIFO substituted between stat and open must not wait indefinitely for a writer.
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error(`not a regular file: ${path}`);
    if (stat.size > limit) throw new Error(`file exceeds ${limit} bytes: ${path}`);
    const bytes = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > limit) throw new Error(`file grew beyond ${limit} bytes: ${path}`);
    return bytes.subarray(0, length);
  } finally { closeSync(fd); }
}

function text(bytes: Uint8Array): string {
  const value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (value.includes("\0")) throw new Error("binary input is not review text");
  return value;
}

function canonical(path: unknown): path is string {
  return typeof path === "string" && path.length > 0 && !/[\\:\x00-\x1f]/.test(path)
    && path.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePacket(value: unknown): Packet {
  if (!record(value) || value.version !== 1 || !canonical(value.document)
      || !Array.isArray(value.files) || value.files.length === 0 || value.files.length > maxFiles) {
    throw new Error("invalid review packet header or inventory");
  }
  const paths = new Set<string>();
  let total = 0;
  for (const file of value.files) {
    if (!record(file) || !canonical(file.path) || typeof file.content !== "string"
        || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error("invalid review file");
    }
    if (paths.has(file.path)) throw new Error(`duplicate input: ${file.path}`);
    paths.add(file.path);
    const bytes = Buffer.from(file.content, "utf8");
    total += bytes.length;
    if (bytes.length > maxFileBytes || total > maxTotalBytes) throw new Error("review text exceeds size budget");
    if (text(bytes) !== file.content || digest(bytes) !== file.sha256) {
      throw new Error(`content/digest mismatch: ${file.path}`);
    }
  }
  if (!paths.has(value.document)) throw new Error("document missing from inventory");
  return value as Packet;
}

function capture(root: string, inputs: string[]): Packet {
  if (inputs.length > maxFiles) throw new Error(`at most ${maxFiles} inputs`);
  const actualPaths = new Set<string>();
  let total = 0;
  const files = inputs.map(input => {
    const path = sourcePath(root, input);
    const actual = realpathSync(path);
    if (actualPaths.has(actual)) throw new Error(`duplicate input: ${input}`);
    actualPaths.add(actual);
    const bytes = readBounded(path, maxFileBytes);
    total += bytes.length;
    if (total > maxTotalBytes) throw new Error("review text exceeds size budget");
    return { path: relative(root, path).split(sep).join("/"), sha256: digest(bytes), content: text(bytes) };
  });
  return parsePacket({ version: 1, document: files[0].path, files });
}

function check(root: string, packet: Packet) {
  const changed: string[] = [];
  const unavailable: string[] = [];
  for (const file of packet.files) {
    try {
      const bytes = readBounded(sourcePath(root, file.path), maxFileBytes);
      if (digest(bytes) !== file.sha256) changed.push(file.path);
    } catch { unavailable.push(file.path); }
  }
  return { status: changed.length || unavailable.length ? "STALE" : "CURRENT",
    checked: packet.files.length, changed, unavailable };
}

export function loadPacket(path: string): Packet {
  // JSON escaping can multiply content size by six; decoded text is bounded too.
  return parsePacket(JSON.parse(text(readBounded(path, maxTotalBytes * 6 + 65536))));
}

function main(args: string[]): number {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log(usage);
    return 0;
  }
  const [command, rootArg, ...inputs] = args;
  if (!rootArg || !inputs.length || !["capture", "check"].includes(command)
      || (command === "check" && inputs.length !== 1)) {
    console.error(usage);
    return 2;
  }
  try {
    const root = realpathSync(resolve(rootArg));
    if (command === "capture") {
      console.log(JSON.stringify(capture(root, inputs), null, 2));
      return 0;
    }
    const packet = loadPacket(resolve(inputs[0]));
    const result = check(root, packet);
    console.log(JSON.stringify(result));
    return result.status === "CURRENT" ? 0 : 1;
  } catch (error) {
    console.error(`review-packet: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

export { capture as capturePacket, check as checkPacket, parsePacket };
export type { Packet };

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
