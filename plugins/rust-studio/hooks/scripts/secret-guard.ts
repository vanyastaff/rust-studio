#!/usr/bin/env bun
// Rust Code Studio — secret guard.
//
// - PreToolUse(Bash): ASK before a command likely to expose secrets to the
//   transcript (reading .env/.pem/id_rsa, `printenv`, bare `env`, `echo $TOKEN`)
//   or one that embeds a secret literal.
// - PostToolUse(Bash|Read): scan the tool output for secret patterns; if found,
//   inject a non-blocking warning so the model won't echo, log, or commit them.
//
// A PostToolUse hook can't rewrite already-produced output, so this detects and
// warns rather than redacting. Never crashes the session.

import { readInput, emit, done, watchdog } from "./_lib.ts";

const disarm = watchdog();

const SECRET_PATTERNS: [string, RegExp][] = [
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["GitHub fine-grained PAT", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ["secret assignment",
   /\b(?:api[_-]?key|secret|token|passwd|password|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-/+.=]{16,}/i],
];

function scan(text: string): string[] {
  const found: string[] = [];
  for (const [name, rx] of SECRET_PATTERNS) if (rx.test(text)) found.push(name);
  return found;
}

function exposes(cmd: string): string | null {
  const readers = /\b(?:cat|bat|less|more|head|tail|strings|xxd|od|type)\b/;
  const sensitive = /\.(?:env|pem|key|p12|pfx|asc)\b|id_rsa|id_ed25519|id_ecdsa|\.ssh\/|credentials|\.netrc|\.npmrc|\.pgpass|secrets?\.(?:toml|ya?ml|json)/i;
  if (readers.test(cmd) && sensitive.test(cmd))
    return "this reads a secret-bearing file into the transcript";
  if (/\bprintenv\b/.test(cmd))
    return "this dumps environment variables (may include secrets)";
  if (/(?:^|[;&|]\s*)env(?:\s|$)/.test(cmd))
    return "bare `env` dumps all environment variables (may include secrets)";
  if (/\becho\b[^|;&]*\$\{?[A-Za-z_]*(?:TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL|PRIVATE)/i.test(cmd))
    return "this echoes a secret-looking environment variable";
  if (scan(cmd).length) return "this command line contains what looks like a secret literal";
  return null;
}

interface Input {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: { command?: string };
  tool_response?: unknown;
}

const data = await readInput<Input>();
disarm();

const event = data.hook_event_name || "";
const tool = data.tool_name || "";

if (event === "PreToolUse" && tool === "Bash") {
  const cmd = data.tool_input?.command || "";
  const reason = exposes(cmd);
  if (reason) {
    emit({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          `Secret-exposure guard: ${reason}. Confirm you intend to — and never ` +
          "commit, log, or paste the result. Prefer reading specific non-secret keys.",
      },
    });
  }
  done();
}

if (event === "PostToolUse") {
  const resp = data.tool_response;
  let text =
    resp && (typeof resp === "object")
      ? JSON.stringify(resp)
      : String(resp ?? "");
  if (!text) text = String(data.tool_input?.command || "");
  text = text.slice(0, 200_000);
  const found = scan(text);
  if (found.length) {
    const kinds = [...new Set(found)].sort().join(", ");
    emit({
      systemMessage: `Rust Code Studio: possible secret(s) in tool output (${kinds}).`,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          `⚠️ Possible secret(s) detected in the previous tool output (${kinds}). ` +
          "Do NOT echo, summarize, hard-code, or commit them. If they are real " +
          "credentials, treat them as compromised and advise rotating. Do not write " +
          "them into source, tests, or `.rust-studio/` notes.",
      },
    });
  }
  done();
}

done();
