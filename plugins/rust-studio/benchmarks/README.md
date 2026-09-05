# Rust Code Studio — agent benchmarks

A tiny evaluation harness that checks whether the studio's review agents actually catch the
bugs they claim to. It tests the **studio itself** (quality assurance for the plugin), not your
project's code. Driven by the `/eval-agents` skill.

## Layout
```
benchmarks/
  fixtures/
    <agent>/<case>/
      input.rs         # Rust with one or more planted defects …
      Cargo.toml, src/, README.md, …   # … or a whole crate / workspace (everything but the key is copied)
      ground-truth.md  # the defects that must be caught (id, line, type, severity)
  live/
    <name>/
      task.md          # kind: skill|agent, target, timeout, the task text
      crate/           # the real crate the target works on (copied to a temp dir, git-committed as baseline)
      check.sh         # the oracle: gate green + golden / probe / forbidden-construct greps → exit 0 = pass
```
`<agent>` maps to the agent under test:
| folder      | agent under test    |
|-------------|---------------------|
| `reviewer`  | `rust-reviewer`     |
| `integrity` | `rust-reviewer`     |
| `unsafe`    | `unsafe-auditor`    |
| `security`  | `security-auditor`  |
| `perf`      | `perf-engineer`     |
| `api`       | `api-design-lead`   |
| `architecture` | `chief-architect` |
| `naming`    | `rust-reviewer`     |
| `scout`     | `rust-scout` (map-recall) |
| `docs`      | `docs-engineer`     |
| `release`   | `release-lead`      |

(Add more folders → agents as you grow it. The full mapping incl. first-pass-bar folders lives
in the `/eval-agents` skill.)

## Running
```
/eval-agents                      # all fixtures
/eval-agents security             # just the security-auditor fixtures
/eval-agents reviewer/unwrap-and-cast
```
The skill spawns the mapped agent on `input.rs` (it never sees `ground-truth.md`), then scores
recall = caught / planted, lists misses, and flags false positives.

Three modes, chosen from the ground truth's title line: **defect-recall** (the default: planted
defects, a NEEDS WORK-class verdict), **first-pass** (`verdict: RESHAPE NEEDED` / `REDO-TO-BAR`:
the pre-code maintainer gate must reject the shape), and **map-recall** (`mode: map-recall`: a
locator's file:line table is checked row by row, no verdict token required — `scout/trait-map`).
A ground truth may carry the audit prompt it is calibrated for (`*"..."*` after "calibrated
for:"); the runner hands exactly that to the agent instead of the generic task.

The **live** tasks under `live/` are the other half: they exercise the agents that *write*
(`rust-builder`, `rust-build-resolver`) and the orchestrating skills (`/refactor`) on a real
crate, and `check.sh` — not an LLM — decides. Run them with `bun tools/eval-runner.ts --live`.

## Adding a fixture
Drop a new `fixtures/<agent>/<case>/` with `input.rs` (plant realistic, identifiable defects)
and `ground-truth.md` (one entry per defect: id, line, type, severity, why). Keep `input.rs`
small and self-contained — it does not need to compile, but it should be plausible Rust. The
harness auto-discovers it.

## What earns a new fixture
Imagination is a poor source of cases. The fixtures that pay for themselves come from **defects
that actually escaped**: a review that missed something, a gate that passed it, a CI failure or
an incident that found it later. When that happens, the write-up is part of the fix — a fixture
lands before the fix is called done, so the blind spot closes permanently instead of for one
session. It is the last rung of the promotion ladder in `../docs/memory-protocol.md`
§"Flagged twice is a rule, not a note": a correction that a rule cannot hold becomes a test.

The same fixtures back the `claude plugin eval` cases in `../evals/`, which CI runs whenever
the studio's own configuration changes (`skills/`, `agents/`, `rules/`, `hooks/`, `docs/`).

## Requested-scenario fixtures (2026-09-05)
Fifteen fixtures were added on the maintainer's explicit direction rather than from an escape,
and are recorded as that exception so the rule above stays the rule. Three cover named
scenarios: `reviewer/spaghetti-accretion`
(a two-year accretion whose only test cannot fail — measures pin-then-reshape, not just the
shape findings), `architecture/upward-dependency` (a domain crate depending upward on transport,
storage, and the API crate's error type through a dev-dependency back-edge), and
`api/planned-breaking-change` (a correct breaking improvement on a published crate shipped as a
minor, with `cargo semver-checks` waved off and an undeprecated alias as the "compatibility"
path). Twelve more cover the rule domains the coverage map listed as unmeasured — one fixture
per domain under `async/`, `error-model/`, `testing/`, `cli/`, `ffi/`, `macros/`,
`observability/`, `cargo-manifest/`, `database/`, `build-scripts/`, `embedded/`, `wasm/` —
each planting only defects its `rules/<domain>.md` already names, so the fixture measures the
agent against the standard it is told to enforce and adds no new doctrine. Each backs an
`evals/` case of the same scenario, and `bun tools/eval-runner.ts --fixtures` runs them all.

## Honesty
A missed planted defect is a **real gap in the agent's prompt**, not a test to relax. Fix the
agent, not the fixture. This is the studio's own "when it looks clean, look harder" applied to
itself.

## Ground-truth coverage map
This is **a map, not a backlog**. It records what fixtures actually exercise today so the gap is
visible — it does not authorize filling the gap by invention. §"What earns a new fixture" above
still governs: a fixture is born from a defect that actually escaped, never from imagination. The
map's job is to make an escape in an uncovered domain recognizable as the trigger it is, the
moment it happens.

Measured 2026-09-05 (re-derive commands below):

**Agent coverage — 18 of 33 agents have fixtures**, via the mapping table in
`skills/eval-agents/SKILL.md` (mirrored in `tools/eval-runner.ts`): `api-design-lead`,
`async-runtime-specialist`, `build-engineer`, `chief-architect`, `cli-ux-lead`,
`database-specialist`, `dependency-manager`, `embedded-specialist`, `error-architect`,
`ffi-specialist`, `macro-specialist`, `observability-engineer`, `perf-engineer`, `qa-lead`,
`rust-reviewer`, `security-auditor`, `unsafe-auditor`, `wasm-specialist`. Two more —
`harsh-critic` and `product-steward` — are exercised by prompt-only eval cases
(`evals/critic-rate-limiter-plan`, `evals/scope-check-creep`) rather than fixtures. The 13 with
neither: `api-designer`, `async-systems-lead`, `cli-specialist`, `concurrency-specialist`,
`docs-engineer`, `release-lead`, `rust-build-resolver`, `rust-builder`, `rust-scout`,
`systems-perf-lead`, `test-engineer`, `tooling-lead`, `web-framework-specialist` — mostly the
writing and orchestrating roles, which a read-only fixture cannot measure; a live build task in a
real crate is the instrument for those.

Re-derive:
```bash
cd plugins/rust-studio
ls agents/*.md | wc -l                                                              # 33 total
sed -n '/Agent folder/,/^`tools\/eval-runner/p' skills/eval-agents/SKILL.md \
  | grep -E '^\| `' | awk -F'|' '{print $3}' | tr -d ' `' | tr ',' '\n' | sort -u    # 18 unique, named
```

**Rule-domain coverage — every one of the 20 domains now has a fixture family behind it.**
`active-dev`, `api`, `architecture`, `core`, `perf`, `security`, `unsafe` from the first pass;
`types` through `reviewer/spaghetti-accretion` (the design-drift tells) and
`architecture/upward-dependency`; and one fixture each for `async`, `build-scripts`,
`cargo-manifest`, `cli`, `database`, `embedded`, `error-model`, `ffi`, `macros`,
`observability`, `testing`, `wasm`, added 2026-09-05 (see the next section for why). Depth is
uneven — most of the new domains have exactly one fixture — so a green here means "measured
once", not "covered".

Re-derive:
```bash
cd plugins/rust-studio
ls rules/*.md | xargs -n1 basename -s .md | sort                                   # 20 domains
ls benchmarks/fixtures/ | sort                                                     # 25 fixture folders
comm -23 <(ls rules/*.md | xargs -n1 basename -s .md | sort) \
         <(ls benchmarks/fixtures/ | sort)                                         # → core, types (covered via reviewer/, architecture/), perf ✓ … see text
```

## Requested-scenario fixtures (2026-09-05)
Fifteen fixtures were added on the maintainer's explicit direction rather than from an escape,
and are recorded as that exception so the rule above stays the rule. Three cover named
scenarios: `reviewer/spaghetti-accretion`
(a two-year accretion whose only test cannot fail — measures pin-then-reshape, not just the
shape findings), `architecture/upward-dependency` (a domain crate depending upward on transport,
storage, and the API crate's error type through a dev-dependency back-edge), and
`api/planned-breaking-change` (a correct breaking improvement on a published crate shipped as a
minor, with `cargo semver-checks` waved off and an undeprecated alias as the "compatibility"
path). Twelve more cover the rule domains the coverage map listed as unmeasured — one fixture
per domain under `async/`, `error-model/`, `testing/`, `cli/`, `ffi/`, `macros/`,
`observability/`, `cargo-manifest/`, `database/`, `build-scripts/`, `embedded/`, `wasm/` —
each planting only defects its `rules/<domain>.md` already names, so the fixture measures the
agent against the standard it is told to enforce and adds no new doctrine. Each backs an
`evals/` case of the same scenario, and `bun tools/eval-runner.ts --fixtures` runs them all.

## Honesty
A missed planted defect is a **real gap in the agent's prompt**, not a test to relax. Fix the
agent, not the fixture. This is the studio's own "when it looks clean, look harder" applied to
itself.

## Ground-truth coverage map
This is **a map, not a backlog**. It records what fixtures actually exercise today so the gap is
visible — it does not authorize filling the gap by invention. §"What earns a new fixture" above
still governs: a fixture is born from a defect that actually escaped, never from imagination. The
map's job is to make an escape in an uncovered domain recognizable as the trigger it is, the
moment it happens.

Measured 2026-09-04:

**Agent coverage — 6 of 33 agents have fixtures**, via the agent mapping table in
`skills/eval-agents/SKILL.md`: `api-design-lead`, `chief-architect`, `perf-engineer`,
`rust-reviewer`, `security-auditor`, `unsafe-auditor`. The other 27 agents (async-runtime-specialist,
async-systems-lead, build-engineer, cli-specialist, cli-ux-lead, concurrency-specialist,
database-specialist, dependency-manager, docs-engineer, embedded-specialist, error-architect,
ffi-specialist, harsh-critic, macro-specialist, observability-engineer, product-steward, qa-lead,
release-lead, rust-build-resolver, rust-builder, rust-scout, systems-perf-lead, test-engineer,
tooling-lead, wasm-specialist, web-framework-specialist, api-designer) have none.

Re-derive:
```bash
cd plugins/rust-studio
ls agents/*.md | wc -l                                                              # 33 total
sed -n '/Agent folder/,/^## Two fixture modes/p' skills/eval-agents/SKILL.md \
  | grep -E '^\| `' | awk -F'|' '{print $3}' | tr -d ' `' | tr ',' '\n' | sort -u    # 6 unique, named
```

**Rule-domain coverage — 7 of 20 domains have a fixture family behind them.** A fixture
*folder* name doesn't always equal the domain it exercises — `naming`, `lifetimes`, `modern-rust`,
and `integrity` all exercise `core.md` (naming, freshness, borrowck-appeasement, gamed-green
review discipline); `workspace` and `prior-art` exercise `architecture.md` alongside the
`architecture` folder itself. Reading each family's `ground-truth.md` against `rules/*.md`'s
scope gives 7 covered domains: `active-dev`, `api`, `architecture`, `core`, `perf`, `security`,
`unsafe`.

**13 domains have no fixture family: `async`, `build-scripts`, `cargo-manifest`, `cli`,
`database`, `embedded`, `error-model`, `ffi`, `macros`, `observability`, `testing`, `types`,
`wasm`.** One of these, `types.md`, is cited once inside `reviewer/audit-at-scale/ground-truth.md`
— but as a backlink noting that fixture's finding was later promoted into the rule, not as a
fixture built to exercise `types.md`'s guidance. It still counts as uncovered.

`async` is the sharpest case: zero fixtures despite shipping a 5.2K `rules/async.md`, two
dedicated agents (`async-runtime-specialist`, `async-systems-lead`), an ASYNC-GATE, and
`/team-async`. No cancellation, `select!`, or `Send`/`'static` defect has ever been planted as a
fixture in this repo.

Re-derive:
```bash
cd plugins/rust-studio
ls rules/*.md | xargs -n1 basename -s .md | sort                                   # 20 domains
ls benchmarks/fixtures/ | sort                                                     # 13 fixture folders
grep -rhoE 'rules/[a-z-]+\.md' benchmarks/fixtures --include=ground-truth.md \
  | sort | uniq -c                                                                 # explicit backlinks (types.md: 1, a citation not a family)
# then read each family's ground-truth.md against rules/*.md's stated scope to assign a domain
# (mechanical only for folders that already share the rule's name); covered set is:
comm -23 <(ls rules/*.md | xargs -n1 basename -s .md | sort) \
         <(printf '%s\n' active-dev api architecture core perf security unsafe | sort)  # → the 13 above
```
