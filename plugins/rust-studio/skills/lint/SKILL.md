---
name: lint
description: "lint format clippy fmt static-gate — run rustfmt and clippy together as the zero-warning static gate. Checks by default; pass --fix to apply formatting and machine-applicable clippy fixes. Use before committing or as a pre-PR gate."
argument-hint: "[--fix to apply; default: check only]"
user-invocable: true
allowed-tools: "Bash(cargo fmt*) Bash(cargo clippy*) Bash(cargo check*) Bash(cargo test*) Bash(cargo nextest*)"
---

# /lint — format + clippy, the static gate

One command for the two checks that always run together: `rustfmt` and `clippy -D warnings`.
This is the static gate (BUILD-GATE-adjacent). Evidence over assertion — cite the output.

## Steps
1. **Format.** Check mode (default): `cargo fmt --all --check`. With `--fix`: `cargo fmt --all`.
   Respect the project's `rustfmt.toml` if present.
2. **Clippy.** `cargo clippy --all-targets --all-features -- -D warnings`. With `--fix`:
   `cargo clippy --fix --all-targets --all-features --allow-dirty` first, then re-run with
   `-D warnings` to confirm clean.
3. **Triage** the findings: group by lint. Separate genuine issues from noise. Fix genuine ones
   (delegate edits to `rust-builder` if non-trivial); for a false positive, add a **scoped**
   `#[allow(clippy::lint, reason = "...")]` with a one-line justification — never a blanket
   crate-level allow.
4. **Re-run** both to green; cite the before/after output.

## Notes
- Conform to `${CLAUDE_PLUGIN_ROOT}/rules/core.md` (no `#[allow]` without justification).
- Don't silence a real lint to pass — fix the cause.
- End with verdict **COMPLETE / NEEDS WORK / BLOCKED** and the clean `clippy`/`fmt` output.
  The `Stop` hook also nudges this if changed `.rs` files aren't formatted.
