# The Project's Gate — run the commands that govern merging

Sibling to `integrity-and-evidence.md`. That standard says every claim carries command
output. This one says **which command**. A green is evidence about the configuration you
ran, and only that configuration — so when a project owns a gate, the gate's configuration
is the one that counts. A hand-rolled `cargo` invocation reports on a hand-rolled build; the
merge gate reports on the one that ships.

## Axiom

**Run the project's gate before you run cargo.** Discover it, run it, and quote it verbatim
when you need to narrow a failure. Only when a project has no gate do the studio's default
invocations become the instruction rather than the fallback.

## Why a prescribed command set gets it wrong in both directions

Two real failures, in one session, in a workspace whose gate is a `justfile`:

- **A green that the gate would not reproduce.** `cargo clippy --all-targets --all-features`
  passed while `just clippy` — which runs **default** features — failed on `type_complexity`
  and `missing_fields_in_debug`. Enabling every feature changed which code paths compiled and
  silenced lints that fire in the shipped configuration. `--all-features` is not a superset of
  the shipped build; it is a *different* build.
- **A body of code nobody compiled.** The same gate runs clippy **twice**, the second time with
  `--features enable-wgpu-tests`, which gates the GPU readback and blend suites. One
  default-feature pass never compiles them, and sixteen broken call sites stayed invisible until
  the second invocation ran.

And in the other direction, a red that isn't real: `cargo nextest run --workspace` reported ten
failures in a crate that passes under the gate, because the gate supplies `FLUI_HEADLESS=1` and
`xvfb-run` for it. Nothing in a prescribed command set can know that.

## Discovery (read-only, cheap, do it once per session)

Look for a gate in this order, and stop at the first hit:

| Where | How to read it |
|-------|----------------|
| `justfile` / `.justfile` | `just --list`, then read the recipe body — not just its name |
| `Makefile` | `make -n <target>` or read the target |
| `xtask/` (a `cargo xtask` crate) | `cargo xtask --help`, then read `xtask/src/main.rs` |
| `Makefile.toml` (cargo-make) | `cargo make --list-all-steps` |
| `lefthook.yml` / `.pre-commit-config.yaml` | the hook commands are the local gate |
| `.github/workflows/*.yml` (or `.gitlab-ci.yml`) | the lint/test job steps are the gate of record |
| `CONTRIBUTING.md` | often names the one command a contributor is expected to run |

CI is the gate of record when it disagrees with a local target: it is what blocks the merge.
A local `just ci` that mirrors it is the fast path to the same answer, not a second opinion.

## Rules

1. **Run the gate, not a paraphrase of it.** `just clippy`, `make lint`, `cargo xtask ci` —
   whatever the project calls it.
2. **Read the recipe body before you trust the recipe name.** A recipe named `clippy` may run
   clippy two or three times over different feature sets; running it once under different flags
   is a different check with the same name.
3. **Copy the exact invocation to narrow a failure** — feature flags, `--no-default-features`,
   target triple, env vars (`RUSTFLAGS`, `FLUI_HEADLESS=1`), and wrappers (`xvfb-run`) included.
   Dropping the env is how a passing suite turns red and a failing one turns green.
4. **Every invocation the gate runs is part of the gate.** If it lints twice over two feature
   sets, one pass is half the check, and the half you skipped is exactly where feature-gated code
   lives.
5. **Do not add `--all-features` to a gate that does not use it**, and do not treat a green under
   `--all-features` as covering the default build. Where the studio deliberately wants the widest
   compile — `/migrate`'s edition sweep, `/msrv-check`, `cargo hack`'s feature matrix — the doc
   says so and that is a *separate* check, not a substitute for the gate.
6. **Never edit the gate to go green.** Changing `just clippy`, a CI step, or a lint table so
   failing code passes is `Gate disabling` in the Cheat Catalog.
7. **Report which gate you ran.** "`just ci` — green (clippy ×2, nextest 412/412)" is evidence.
   "clippy clean" is not, once a gate exists that you might not have run.

## Fallback — no gate found

Say so ("no `justfile`/`Makefile`/`xtask`/CI lint job found; ran the studio defaults"), then run:

- `cargo nextest run` (fall back to `cargo test`); doc-tests via `cargo test --doc`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo fmt`

`--all-features` is the right default *only* here, where nothing narrower is known to be the
shipped configuration. If the crate's `Cargo.toml` has non-additive or platform-gated features,
check the default build too and say which you ran.

## Who enforces it

- **`rust-builder`** — discovers the gate before step 6 and runs it instead of the defaults.
- **`rust-reviewer`** — an evidence claim backed by a command that is *not* the project's gate is
  an `INTEGRITY` finding: the green is about a configuration nobody merges.
- **`qa-lead` (QA-GATE), `tooling-lead` (BUILD-GATE), `release-lead` (RELEASE-GATE)** — the gate
  they sign is the project's, where the project has one.
- **`/verify-loop`, `/lint`, `/dev-task`, `/ci-gate`, `/fix-build`** — drive the project's gate to
  green; `/ci-gate` installs one where there is none.
