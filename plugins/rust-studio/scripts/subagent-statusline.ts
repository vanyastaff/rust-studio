#!/usr/bin/env bun
// Rust Code Studio — sub-agent status line.
//
// Shipped plugin-native via the plugin `settings.json` `subagentStatusLine` key (the only
// status key a plugin may set, alongside `agent`). It renders each sub-agent row in the agent
// panel below the prompt with a status glyph + type + description + elapsed + token count — so a
// running fan-out reads as live progress instead of a bare `name · description · tokens` row.
//
// Input (stdin JSON): { columns, tasks: [{ id, name, type, status, description, label,
//   startTime, tokenCount, ... }] }.
// Output: one JSON line per row to override — {"id","content"}. Omit a row's id to keep the
// default; an empty content hides it. Never throws: on any error it prints nothing, so every
// row simply keeps its default rendering.

interface Task {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
  description?: string;
  label?: string;
  startTime?: number | string;
  tokenCount?: number;
}

const GLYPH: Record<string, string> = {
  running: "●",
  in_progress: "●",
  active: "●",
  completed: "✓",
  done: "✓",
  success: "✓",
  error: "✗",
  failed: "✗",
  pending: "·",
  queued: "·",
};

function fmtTokens(n?: number): string {
  if (!n || n <= 0) return "";
  if (n < 1000) return `${n}tok`;
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}

function fmtElapsed(start?: number | string, now = Date.now()): string {
  if (start == null) return "";
  const t = typeof start === "number" ? start : Date.parse(String(start));
  if (!Number.isFinite(t) || t <= 0) return "";
  const ms = now - t;
  if (ms < 0 || ms > 36 * 3_600_000) return ""; // implausible → skip
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60}s`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

/** Build the override content for one sub-agent row, truncated to the row width. */
export function rowContent(task: Task, columns = 80, now = Date.now()): string {
  const status = (task.status ?? "").toLowerCase();
  const glyph = GLYPH[status] ?? "≡";
  const who = task.type || task.name || "agent";
  const desc = (task.description || task.label || "").replace(/\s+/g, " ").trim();
  const meta: string[] = [];
  const el = fmtElapsed(task.startTime, now);
  const tok = fmtTokens(task.tokenCount);
  if (el) meta.push(el);
  if (tok) meta.push(tok);
  let line = `${glyph} ${who}` + (desc ? `: ${desc}` : "");
  if (meta.length) line += `  ·  ${meta.join(" · ")}`;
  const max = Math.max(20, (columns || 80) - 1);
  if (line.length > max) line = line.slice(0, max - 1) + "…";
  return line;
}

/** Pure: map a parsed input object to the override lines (JSON strings). */
export function renderRows(data: any, now = Date.now()): string[] {
  const cols = typeof data?.columns === "number" ? data.columns : 80;
  const tasks: Task[] = Array.isArray(data?.tasks) ? data.tasks : [];
  const out: string[] = [];
  for (const t of tasks) {
    if (!t || !t.id) continue; // no id → leave default rendering
    out.push(JSON.stringify({ id: t.id, content: rowContent(t, cols, now) }));
  }
  return out;
}

if (import.meta.main) {
  try {
    const raw = await new Response(Bun.stdin).text();
    const data = raw ? JSON.parse(raw) : {};
    const out = renderRows(data);
    if (out.length) process.stdout.write(out.join("\n"));
  } catch {
    /* print nothing → default rendering for every row */
  }
  process.exit(0);
}
