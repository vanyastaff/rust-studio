// Shared design artifact resolution. Existing files are read in place, never migrated.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const DESIGN_ROOTS = ["docs/designs", ".rust-studio/specs"] as const;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface DesignPath {
  slug: string;
  spec: string;
  dir: string;
  kind: "shared" | "legacy" | "custom";
}

function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Resolve a unique default-root slug, or an explicit existing artifact inside root. */
export function resolveDesign(root: string, input: string): DesignPath {
  const base = resolve(root);
  const normalized = input.replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0")) throw new Error("design input is empty or invalid");
  let file: string;
  if (SLUG.test(normalized) && !(normalized.endsWith(".md") && existsSync(resolve(base, normalized)))) {
    const matches = DESIGN_ROOTS.map((dir) => join(base, dir, normalized, "spec.md")).filter(existsSync);
    if (matches.length > 1) throw new Error(`ambiguous design '${input}'; supply its explicit spec path`);
    if (!matches.length) throw new Error(`design '${input}' has no existing spec.md`);
    file = matches[0];
  } else {
    file = resolve(base, normalized);
    if (!within(base, file)) throw new Error("design path is outside the repository root");
    if (!existsSync(file)) throw new Error(`design artifact does not exist: ${input}`);
    if (statSync(file).isDirectory()) file = join(file, "spec.md");
  }
  if (!within(base, file) || !within(realpathSync(base), realpathSync(file))) {
    throw new Error("design path escapes the repository root");
  }
  if (!statSync(file).isFile()) throw new Error("design artifact is not a regular file");
  const spec = relative(base, file).replace(/\\/g, "/");
  const dir = relative(base, dirname(file)).replace(/\\/g, "/") || ".";
  const kind = spec.startsWith(`${DESIGN_ROOTS[0]}/`) ? "shared"
    : spec.startsWith(`${DESIGN_ROOTS[1]}/`) ? "legacy" : "custom";
  const folder = basename(dirname(file));
  const text = readFileSync(file, "utf8");
  const metadata = /^\s*(?:-\s+)?\*\*Slug:\*\*\s*`?([^`\r\n]+?)`?\s*$/m.exec(text)?.[1]?.trim();
  const slug = metadata ?? folder;
  if (!SLUG.test(slug)) throw new Error(`invalid design slug: ${slug}`);
  if (kind !== "custom" && slug !== folder) throw new Error(`design slug '${slug}' conflicts with directory '${folder}'`);
  return { slug, spec, dir, kind };
}

/** Default CHECK cwd: the owner of either standard root, otherwise the ledger directory. */
export function defaultDesignCwd(ledgerPath: string): string {
  const start = dirname(resolve(ledgerPath));
  let dir = start;
  while (true) {
    if (basename(dir) === ".rust-studio") return dirname(dir);
    if (basename(dir) === "designs" && basename(dirname(dir)) === "docs") return dirname(dirname(dir));
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}
