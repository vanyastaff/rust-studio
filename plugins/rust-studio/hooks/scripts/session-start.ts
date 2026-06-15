#!/usr/bin/env bun
// Rust Code Studio — SessionStart hook.
//
// 1) Detects a Rust project at the session cwd and injects a concise studio briefing
//    (detected stack + domain classification + collaboration protocol).
// 2) RECALLS the most relevant project memory from the shared Obsidian vault and injects a
//    compact ranked index, so the session starts with a "second brain" already primed.
// A command hook has no MCP access, so recall reads the vault files directly (filesystem) and
// ranks them against a cheap git signal (branch / changed crates / last commit). Deep semantic
// retrieval is `/recall`. Never fails the session: on any error it injects what it can and exits 0.

import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { readInput, emit, watchdog } from "./_lib.ts";

const disarm = watchdog();

// --- minimal Cargo.toml field extraction (no TOML dep; only the fields used) ---
function section(text: string, name: string): string {
  const out: string[] = [];
  let inSec = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) {
      inSec = line.trim() === `[${name}]`;
      continue;
    }
    if (inSec) out.push(line);
  }
  return out.join("\n");
}
function field(body: string, key: string): string | null {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']*)["']`, "m").exec(body);
  return m ? m[1] : null;
}

function classify(textLower: string): string[] {
  const hay = textLower;
  const domains: string[] = [];
  if (
    hay.includes("#![no_std]") ||
    hay.includes("embedded-hal") ||
    hay.includes("cortex-m") ||
    hay.includes("no-std")
  )
    domains.push("systems/embedded");
  if (["tokio", "axum", "actix-web", "actix_web", "hyper", "tower", "sqlx", "async-std"].some((k) => hay.includes(k)))
    domains.push("async/web");
  if (["clap", "ratatui", "crossterm"].some((k) => hay.includes(k)) || hay.includes("[[bin]]"))
    domains.push("cli");
  if (hay.includes("[lib]")) domains.push("library/crate");
  const seen: string[] = [];
  for (const d of domains) if (!seen.includes(d)) seen.push(d);
  return seen.length ? seen : ["(undetermined — run /detect-stack)"];
}

// --- memory recall (reads the shared Obsidian vault directly; no MCP in a command hook) ---
const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "are", "was",
  "main", "master", "feat", "fix", "chore", "refactor", "docs", "test", "wip", "branch",
  "add", "update", "remove", "merge", "rust", "crate", "crates", "src", "lib", "mod",
]);

function fmField(fm: string, key: string): string {
  const m = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im").exec(fm);
  return m ? m[1].trim().replace(/^["'\[]+|["'\]]+$/g, "").trim() : "";
}

function noteMeta(body: string): { title: string; note_type: string; tags: string; hook: string } {
  let fm = "";
  const fmm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body);
  if (fmm) fm = fmm[1];
  const title = fmField(fm, "title") || fmField(fm, "name");
  const note_type = fmField(fm, "note_type") || fmField(fm, "type");
  const tags = fmField(fm, "tags");
  let hook = fmField(fm, "description");
  if (!hook) {
    const after = fmm ? body.slice(fmm[0].length) : body;
    for (const raw of after.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith(">") || line.startsWith("---")) continue;
      hook = line;
      break;
    }
  }
  if (hook.length > 140) hook = hook.slice(0, 137).trimEnd() + "…";
  return { title, note_type, tags, hook };
}

interface Note { title: string; note_type: string; hook: string; score: number; mtime: number; group: string }

// map a note's top-level folder under projects/<project>/ to a display group
function layerGroup(rel: string): string {
  const seg = rel.split(/[\\/]/)[0];
  if (seg === "decisions") return "Decisions (ADRs)";
  if (seg === "planning" || seg === "specs") return "Plans & specs";
  return "Working memory";
}
const GROUP_ORDER = ["Decisions (ADRs)", "Plans & specs", "Working memory"];

function buildRecall(cwd: string): string {
  try {
    const vault = process.env.OBSIDIAN_VAULT_PATH || join(homedir(), "memory");
    const project = basename(cwd);
    const dir = join(vault, "projects", project);
    try {
      if (!statSync(dir).isDirectory()) return "";
    } catch {
      return ""; // project not in the vault yet — nothing to recall
    }

    // cheap git signal (every call fail-open)
    const git = (args: string): string => {
      try {
        return execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 4000 }).trim();
      } catch {
        return "";
      }
    };
    const sig = new Set<string>();
    const addTerms = (s: string): void => {
      for (const t of s.toLowerCase().split(/[^a-z0-9]+/)) if (t.length >= 4 && !STOP.has(t)) sig.add(t);
    };
    addTerms(git("rev-parse --abbrev-ref HEAD"));
    addTerms(git("log -1 --format=%s"));
    const changed = git("diff --name-only HEAD") + "\n" + git("diff --name-only");
    for (const m of changed.matchAll(/crates[\/\\]([a-z0-9_-]+)/gi)) sig.add(m[1].toLowerCase());

    // bounded recursive walk of the project memory (skip large mirror corpora + archives)
    const SKIP_DIRS = new Set(["research", "codebase", "processed", "node_modules"]);
    const notes: Note[] = [];
    let budget = 220;
    const walk = (d: string): void => {
      if (budget <= 0) return;
      let ents;
      try {
        ents = readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of ents) {
        if (budget <= 0) return;
        if (e.name.startsWith(".")) continue;
        const p = join(d, e.name);
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) walk(p);
          continue;
        }
        if (!e.name.endsWith(".md") || e.name === "MEMORY.md" || e.name.startsWith("_Index_of_")) continue;
        budget--;
        let body = "";
        try {
          body = readFileSync(p, "utf8");
        } catch {
          continue;
        }
        const meta = noteMeta(body);
        const title = meta.title || e.name.replace(/\.md$/, "");
        const hay = `${e.name} ${title} ${meta.tags} ${meta.note_type}`.toLowerCase();
        const hayBody = body.toLowerCase();
        let score = 0;
        for (const t of sig) {
          if (hay.includes(t)) score += 3;
          else if (hayBody.includes(t)) score += 1;
        }
        let mtime = 0;
        try {
          mtime = statSync(p).mtimeMs;
        } catch {
          /* keep 0 */
        }
        const rel = p.slice(dir.length + 1);
        notes.push({ title, note_type: meta.note_type, hook: meta.hook, score, mtime, group: layerGroup(rel) });
      }
    };
    walk(dir);
    if (notes.length === 0) return "";

    const fmtBullet = (n: Note): string =>
      `- **${n.title}**${n.note_type ? ` (${n.note_type})` : ""}${n.hook ? ` — ${n.hook}` : ""}`;

    const sigList = [...sig].slice(0, 8).join(", ");
    const matched = notes.filter((n) => n.score > 0).sort((a, b) => b.score - a.score || b.mtime - a.mtime);

    const sections: string[] = [];
    for (const g of GROUP_ORDER) {
      const items = matched.filter((n) => n.group === g).slice(0, 4);
      if (items.length) sections.push(`### ${g}\n` + items.map(fmtBullet).join("\n"));
    }

    let out: string;
    if (sections.length) {
      out =
        `## Recalled project memory — most relevant to this work${sigList ? ` (signal: ${sigList})` : ""}\n` +
        sections.join("\n\n");
    } else {
      const recent = notes.slice().sort((a, b) => b.mtime - a.mtime).slice(0, 4);
      out = `## Recalled project memory — most recent\n` + recent.map(fmtBullet).join("\n");
    }
    return (
      out +
      `\n\n_${notes.length} notes scanned in \`projects/${project}/\` (decisions / planning / specs / agent). ` +
      "Browse the `Dashboard` & `ADR Index` notes or the Projects views; `/recall <topic>` for deep " +
      "semantic search; `/remember` to capture a learning._"
    );
  } catch {
    return "";
  }
}

interface Input {
  cwd?: string;
}

const data = await readInput<Input>();
disarm();

const cwd = data.cwd || process.cwd();
const manifest = join(cwd, "Cargo.toml");

let manifestExists = false;
try {
  manifestExists = statSync(manifest).isFile();
} catch {
  manifestExists = false;
}

let briefing: string;

if (!manifestExists) {
  briefing =
    "## Rust Code Studio active\n\n" +
    "Rust Code Studio plugin is active, but no Cargo.toml was found at the session root. " +
    "If this is a Rust project, run /detect-stack from its root. " +
    "Studio protocol: Question → Options → Decision → Draft → Approval.";
} else {
  let text = "";
  try {
    text = readFileSync(manifest, "utf8");
  } catch {
    text = "";
  }

  const pkg = section(text, "package");
  const name = field(pkg, "name") || "?";
  const edition = field(pkg, "edition") || "?";
  const msrv = field(pkg, "rust-version") || "(unset)";

  const isWorkspace = /^\[workspace\]\s*$/m.test(text);
  let members = 0;
  if (isWorkspace) {
    const ws = section(text, "workspace");
    const mm = /members\s*=\s*\[([\s\S]*?)\]/.exec(ws);
    if (mm) members = (mm[1].match(/["'][^"']+["']/g) || []).length;
  }

  const domains = classify(text.toLowerCase());

  const lines = [
    "## Rust Code Studio active",
    "",
    `Detected Rust project at \`${cwd}\`.`,
    `- Crate/workspace: **${name}**` + (isWorkspace ? ` (workspace, ${members} member globs)` : ""),
    `- Edition: ${edition}   MSRV (rust-version): ${msrv}`,
    `- Domain(s): **${domains.join(", ")}**`,
    "",
    "**Protocol:** a quality loop, **autonomy-first** — decide tactical calls yourself " +
      "(state the choice + one-line rationale, then proceed); ask only on " +
      "strategic/irreversible/outward steps. No quick wins, no shims, finish the cross-crate " +
      "ripple; observability ships in the same pass. See docs/working-preferences.md.",
    "**Team:** directors (chief-architect, product-steward) → leads → specialists. " +
      "Path-scoped Rust standards are injected automatically when you edit matching files.",
    "**Start here:** `/start` for guided onboarding, `/help` for the catalog, " +
      "`/dev-task` to implement one unit of work, `/review` to audit a diff.",
    "**Skills first:** for any non-trivial task, check `/help` for a studio skill that fits " +
      "before improvising — prefer the skill's discipline (gates, agents, evidence) over ad-hoc steps.",
  ];

  if (isWorkspace && members) {
    lines.push(
      "",
      `**Large workspace (${members} member globs):** scope context to the crate you ` +
        "touch — per-crate CLAUDE.md, `permissions.deny` on target/generated, and " +
        "`rust-analyzer-lsp` for symbol lookup. Run `/adopt` or see docs/large-workspace.md.",
    );
  }

  briefing = lines.join("\n");
}

const recall = buildRecall(cwd);

emit({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: briefing + (recall ? "\n\n" + recall : ""),
  },
});
