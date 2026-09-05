---
name: lint
description: "Use when running rustfmt and clippy as a zero-warning Rust gate or applying safe automatic fixes."
allowed-tools: "Bash(cargo fmt*) Bash(cargo clippy*) Bash(cargo check*) Bash(cargo test*) Bash(cargo nextest*) Bash(cargo xtask*) Bash(just*) Bash(make*)"
---

# /lint — format + clippy, the static gate

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

One command for the two checks that always run together: `rustfmt` and `clippy -D warnings`.
This is the static gate (BUILD-GATE-adjacent). Evidence over assertion — cite the output.

## Steps
0. **Find the project's gate.** If the repo owns a lint target — `justfile`, `Makefile`, `xtask`,
   cargo-make, lefthook, or a CI lint job — **that** is the gate: run it, read its recipe body,
   and run every invocation it makes (a gate that lints twice over two feature sets is two
   checks). Copy its exact flags and env when narrowing a failure. Steps 1–2 are the fallback for
   a project with no gate — see `references/project-gate.md`. `--all-features` is not a superset
   of the shipped build: it silences lints that fire under default features.
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
- Conform to `references/core.md` (no `#[allow]` without justification).
- Prefer workspace-level lints (`[workspace.lints]`) over `#![deny(warnings)]` in library code:
  a new stable lint shouldn't break consumers' builds. Gate strictness via `RUSTFLAGS="-D warnings"`
  in CI instead. See `references/cargo-manifest.md`.
- Don't silence a real lint to pass — fix the cause.
- Name the command behind the green. "clippy clean" is not evidence once the repo has a gate you
  might not have run (`Off-gate green`, `references/project-gate.md`).
- End with verdict **COMPLETE / NEEDS WORK / BLOCKED** and the clean `clippy`/`fmt` output.
  The `Stop` hook also nudges this if changed `.rs` files aren't formatted.
- Next: `/commit` to commit the clean tree, or `/review` for a deeper correctness audit.
