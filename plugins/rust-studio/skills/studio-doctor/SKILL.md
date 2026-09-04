---
name: studio-doctor
description: "Use when the studio seems inactive: check hooks, runtime, agents, LSP, memory, and cargo tooling."
---

# /studio-doctor — is the studio actually running here?

Every ambient part of this plugin **fails open** by design: a missing runtime, an unapproved
hook, or an absent binary degrades silently rather than wedging the session. That is the right
default and it has one cost — a broken install looks exactly like a working one. This skill
reads the difference and reports it, with the fix per row.

**Diagnose by running, not by assuming.** A hook that exists on disk is not a hook that fires;
a binary on PATH is not a version that works. Each row below has a command that produces
evidence, and a row you could not check reports `?`, never ✓
(`references/integrity-and-evidence.md`).

## When NOT this skill
- The catalog question "what can this thing do?" → `/help`.
- The machine has no Rust toolchain yet → `/env-setup`.
- Memory notes are stale or the index is over budget → `/memory-doctor`.
- The status line is wrong specifically → `/progress-bar`.

## Phase 1 — Probe (read-only, no approval needed)
Run every check; report what each one actually returned.

**Runtime.** The hooks are TypeScript run by `bun`. `bun --version` — absent means *every*
hook is a no-op: no stack briefing, no rule pointers, no memory recall, no verdict check, no
guard. This is the single highest-impact row, and the symptom is silence.

**Hooks reach this session.** Existence is not delivery — a host may require a one-time
interactive approval before a plugin's hooks run at all. Two pieces of evidence:
- the plugin's hook config lists the handlers (read it, count them by event);
- a handler produces output when fed a synthetic payload on stdin.

Pass that payload through a **data heredoc**, not an inline string:

```sh
bun hooks/scripts/<handler>.ts <<'EOF'
{"session_id":"probe","tool_input":{"file_path":"/repo/src/lib.rs"}}
EOF
```

A payload written inline puts its contents into *your own* shell command, so probing the
irreversible-action guard with a destructive command gets your probe blocked by the very guard
you are testing. `stripDataHeredocs` exists for exactly this: a heredoc body belongs to the
program, not the shell, so the guard reads past it. Expect exit 2 plus a block message for a
destructive command and exit 0 for `--force-with-lease`; a guard that allows both is off.

Then state whether this session *shows* the effect: was a stack briefing delivered at session
start, and did a rule pointer arrive on the last source file read? Where the host reports
plugin errors in its own UI, say so and name where to look.

**Version skew.** The hooks that fire in this session come from the *installed* plugin, which
is not necessarily the tree you are editing. Compare the version the host loaded against
`.claude-plugin/plugin.json` in the working copy, and list what else sits in the plugin cache.
This is the answer to a whole class of "I changed it and nothing happened" — an edit to a
working copy reaches the session only after the plugin is updated and a new session starts.

**Sub-agents.** Ask whether the studio's roster is reachable here (`rust-scout`,
`rust-builder`, `rust-reviewer` at minimum). Absent → this is a standalone or portable
install: the named phases still run, inline, in one session, and that is not a failure
(`references/sub-agents.md`). Say which mode is in effect, because it changes what every
orchestrating skill does.

**LSP.** `rust-analyzer --version`. Absent → `rust-scout` falls back to scanning files instead
of resolving symbols, and diagnostics after an edit stop arriving. Slower and blunter, not
broken.

**Memory store.** Does the store resolve to a real directory, and does its index agree with the
files beside it? Report the resolved path, the note count, and the index budget against the
host's load limit. Anything worse than a clean bill routes to `/memory-doctor`
(`references/memory-protocol.md`) — this skill locates the problem, that one fixes it.

**Cargo tooling.** Presence is not compatibility — several of these parse `rustc` output or
rustdoc JSON and break on a toolchain newer than themselves, while still answering `--version`
happily. On this machine `cargo-semver-checks 0.48.0` reported a clean install and then failed
every run with `unsupported rustdoc format v60 (supported formats are v56, v57)` against rustc
1.98. So for anything that consumes compiler output, **run it once** rather than probing
`--version`, and report a tool that installs but cannot run as ✗, not ✓. Map each to what
degrades without it:

| Binary | Missing means | Documented fallback |
|---|---|---|
| `cargo` + `rustc` | nothing works — `/env-setup` | none |
| `rustfmt`, `clippy` components | `/lint` and every gate's evidence step | none |
| `cargo-nextest` | slower, less isolated test runs | `cargo test` |
| `cargo-deny`, `cargo-audit` | `/deps-check`, `/security-audit`, RELEASE-GATE security | each covers part of the other |
| `cargo-semver-checks` | `/api-review` loses a mechanical check | `cargo public-api`, then manual |
| `cargo-llvm-cov` | `/coverage` | `cargo-tarpaulin` |
| `cargo-shear` | `/deps-check` unused-dependency scan | `cargo-machete`, `cargo-udeps` |
| `cargo-mutants`, `cargo-fuzz` | `/mutants`, `/fuzz` | none — the skill is unavailable |
| `miri` (nightly) | SAFETY-GATE loses its strongest evidence | none |

Report a **fallback in use** as ⚠, not ✗ — the skill still runs, with weaker evidence, and the
user should know which. Only a row with no fallback is ✗.

**Configuration.** Report the studio options actually in effect and where each came from
(host plugin settings, or a `RUST_STUDIO_*` environment variable) — gate intensity, test
runner, MSRV fallback, and which ambient toggles are off. A toggle someone disabled months ago
explains more "why didn't it do X?" than any other row.

## Phase 2 — Report
One line per row, worst first, each carrying its evidence and its fix:

```
✓ runtime      bun 1.x                     hooks execute
⚠ lsp          rust-analyzer not on PATH   scout scans files; install rust-analyzer
✗ hooks        no output from <handler>    <the fix, or where the host reports plugin errors>
? sub-agents   could not determine         <what was tried>
```

Close with a one-line verdict — **HEALTHY** (everything live), **DEGRADED** (running, named
capabilities missing), or **INERT** (the ambient layer is not reaching this session at all) —
and then the single highest-impact fix, not a list of everything imperfect.

## Phase 3 — Fix (gate)
Propose the repairs as concrete commands and get approval before any of them runs. Installing
a toolchain component, adding a binary, or writing to the host's settings changes the user's
machine, so each is presented and approved, never applied on the way past
(`references/collaboration.md`). Where the fix is outside your reach — a host-level trust
approval, a plugin re-enable — say exactly what the user has to do and stop there.
