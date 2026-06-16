---
name: ci-gate
description: "ci gate hang deadlock timeout clippy disallowed lefthook nextest — install or audit the anti-hang / anti-silencing gate so code can't reach CI and hang (deadlock, huge Duration, SystemTime) or silence a lint instead of fixing it. Sets up clippy disallowed_methods, nextest terminate-after, a quiet lefthook pre-push, and a CI timeout backstop."
argument-hint: "[install | audit]  (default: audit, then offer to install)"
user-invocable: true
---

# /ci-gate — stop code from reaching CI and hanging (and from silencing the gate)

Build the layered mechanical gate that catches what **rules can't** (rules only apply while the
studio is in the loop; a hang reaches CI on code that bypassed it). Two failure classes:

1. **Hangs / nondeterminism reaching CI** — `SystemTime::now()`/`Instant::now()` in library logic,
   `thread::sleep`, an accidental huge `Duration`, a deadlock. You cannot lint a deadlock — you
   **bound** it so a hang becomes a fast failure.
2. **Gaming the gate itself** — the agent edits `clippy.toml` / adds `#[allow(...)]` / raises a
   timeout instead of fixing the code. The gate must protect itself.

You are the orchestrator: **delegate file writes to `rust-builder`**; you detect, plan, and verify.
Owners: `tooling-lead` (policy / BUILD-GATE) and `build-engineer` (implementation). Honesty bar:
`${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`.

## How each failure is caught (and why that mechanism)

| Failure | Mechanism | Template |
|---------|-----------|----------|
| `SystemTime::now` / `Instant::now` / `thread::sleep` | clippy `disallowed_methods` = error (runs in your existing clippy gate) | `clippy.toml` + `workspace-lints.toml` |
| Deadlock / hang / huge `Duration` in a test | `nextest` `terminate-after` → killed + failed in ~2× period, never hangs | `nextest.toml` |
| Long sleep with a big literal in non-test code | ripgrep smell-check (it's a *value*, clippy can't see it) | `lefthook.yml` |
| Hung CI job overall | CI `timeout-minutes` hard ceiling | `ci-anti-hang.yml` |
| **Silently `#[allow]`-ing a lint** | clippy `allow_attributes_without_reason = "deny"` → a reason is mandatory and visible to review | `workspace-lints.toml` |
| **Removing a ban / raising a timeout to pass** | `check-gate.sh` asserts the gate is intact (run in lefthook + CI) | `scripts/check-gate.sh` |

Templates: `${CLAUDE_PLUGIN_ROOT}/docs/templates/` — `clippy.toml`, `workspace-lints.toml`,
`nextest.toml`, `lefthook.yml`, `scripts/check-gate.sh`, `ci-anti-hang.yml`, `deny.toml`,
`dependabot.yml`. The full tiered reference (blessed actions, tool suite, security, pitfalls, with
sources) is `${CLAUDE_PLUGIN_ROOT}/docs/ci-best-practices.md` — read it before installing.

**Don't reinvent — start from the community reference.** The richest known turnkey gate is
**`jonhoo/rust-ci-conf`** (check / test / safety / nostd / scheduled workflows, all SHA-pinned).
For anything beyond the anti-hang core, model on it and trim. The studio already owns the broader
gates as skills: MSRV (`/msrv-check`), semver (`/api-review`), deps/licenses (`/deps-check`),
security advisories (`/security-audit`), coverage (`/coverage`) — wire those into CI rather than
re-deriving them.

**Load-bearing gotchas** (from `ci-best-practices.md`): `actions-rs/*` is archived — use
`dtolnay/rust-toolchain` + `Swatinem/rust-cache` + `taiki-e/install-action`; `cargo nextest` does
**not** run doctests, so a separate `cargo test --doc` step is mandatory; a `clippy.toml` ban only
fails CI under `clippy -- -D warnings`; SHA-pin third-party actions; and `deny.toml` must use the
modern (0.16+) schema — pre-0.14 keys hard-error.

## Steps

1. **Detect** (read-only): is this a workspace? Does it use `tokio`/async (so timeouts matter)?
   Is `cargo-nextest` available (`cargo nextest --version`); is `lefthook` installed
   (`lefthook version`)? What already exists: `clippy.toml`, `.config/nextest.toml`, `lefthook.yml`,
   `.github/workflows/`, and `[workspace.lints]` in the root `Cargo.toml`.
   **Tool install method:** prefer **`cargo binstall <tool>`** (prebuilt binaries — fast) over
   `cargo install` (compiles); fall back to `cargo install` only when no prebuilt exists. In CI use
   **`taiki-e/install-action`** (prebuilt, no bootstrap), not `cargo install`.

2. **Audit** (`$ARGUMENTS` empty or `audit`): report which of the six mechanisms are present vs
   missing, and — critically — whether any are **weakened** (a `[lints]` table in a member crate
   that re-opens a workspace deny; `#[allow]` without a reason; a missing/removed ban; a raised or
   absent `terminate-after`). List each gap as a finding. Stop here if the user only asked to audit.

3. **Plan** the install/repair: which templates to add, and how to MERGE (don't clobber an existing
   `clippy.toml`/CI — add the bans/steps into it). Show the diff before writing. State the threshold
   choices (timeout periods, sleep-literal threshold) and that they are tunable.

4. **Approve** (`AskUserQuestion` at this fork): confirm the plan and any threshold choices.

5. **Install** (delegate to `rust-builder`): write/merge `clippy.toml`, the `[workspace.lints]`
   block (+ `lints.workspace = true` in each member), `.config/nextest.toml`, `lefthook.yml`,
   `scripts/check-gate.sh` (`chmod +x`), and the CI job. Adapt async projects to ban the right
   sleep and prefer `tokio::time::timeout`.

6. **Verify** (evidence, not assertion):
   - `cargo clippy --all-targets --all-features -- -D warnings` — must be clean on the real code
     (if it now errors, that is a real footgun the gate just caught — fix the code, do **not** drop
     the ban).
   - `bash scripts/check-gate.sh` → `gate intact`.
   - `cargo nextest run --profile ci` passes; show the summary.
   - If `lefthook` is installed, `lefthook run pre-push` (or note it runs on next push).
   Paste the command output.

7. **Verdict** **COMPLETE / NEEDS WORK / BLOCKED**, then the durable warning: a future change that
   removes a ban, drops `allow_attributes_without_reason`, or raises a timeout to make code pass is
   **gate-disabling** — `rust-reviewer` and `check-gate.sh` will reject it. Suggest CODEOWNERS /
   required review on the gate paths so the gate can't be edited without a human.
   Next: `/verify-loop` to drive the current tree green against the freshly-installed gate, or
   `/lint` for the static pass alone.

## Do not
- Do not weaken a check to make existing code pass — fix the call site (inject a clock, bound the
  duration, resolve the deadlock). A red clippy/check-gate after install is a real defect found.
- Do not silence with a bare `#[allow]` — the gate forbids it; if an allow is genuinely right, add
  `, reason = ".."` so review can judge it.
