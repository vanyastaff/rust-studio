#!/usr/bin/env bun
// Rust Code Studio — skill catalog generator (run by /help via a `!` block).
//
// Not a hook: takes no stdin. Reads every skills/*/SKILL.md, parses its
// frontmatter, and prints one compact `- /name — <first line of description>`
// per skill so /help's raw list can't drift from the actual skills on disk.
// Fail-open: on any error it prints nothing and exits 0 (so /help still renders).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { watchdog, pluginRoot } from "./_lib.ts";

const disarm = watchdog();

/** Pull a quoted/bare scalar value for `key` out of a YAML frontmatter block. */
function frontmatterValue(fm: string, key: string): string {
  for (const line of fm.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 0) continue;
    if (trimmed.slice(0, idx).trim() !== key) continue;
    return trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return "";
}

/** Reduce a long description to its first line: text up to the first sentence
 *  end or em-dash separator, whichever is sensible, capped for compactness. */
function firstLine(desc: string): string {
  let s = desc.replace(/\s+/g, " ").trim();
  // Studio descriptions often lead with "kw, kw — real summary"; keep the summary.
  const dash = s.indexOf(" — ");
  if (dash >= 0) s = s.slice(dash + 3).trim();
  const period = s.indexOf(". ");
  if (period >= 0) s = s.slice(0, period);
  if (s.length > 120) s = s.slice(0, 117).trimEnd() + "…";
  return s;
}

try {
  const skillsDir = join(pluginRoot(), "skills");
  if (!statSync(skillsDir).isDirectory()) {
    disarm();
    process.exit(0);
  }

  const names = readdirSync(skillsDir)
    .filter((d) => {
      try {
        return statSync(join(skillsDir, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();

  const lines: string[] = [];
  for (const dir of names) {
    let text: string;
    try {
      text = readFileSync(join(skillsDir, dir, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    if (!text.startsWith("---")) continue;
    const end = text.indexOf("\n---", 3);
    if (end < 0) continue;
    const fm = text.slice(3, end);
    const name = frontmatterValue(fm, "name") || dir;
    const desc = firstLine(frontmatterValue(fm, "description"));
    lines.push(desc ? `- \`/${name}\` — ${desc}` : `- \`/${name}\``);
  }

  if (lines.length) process.stdout.write(lines.join("\n") + "\n");
} catch {
  /* fail-open: /help still renders without the generated list */
}

disarm();
process.exit(0);
