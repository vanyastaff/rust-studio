# Rust Code Studio — `claude plugin eval` suite

Thirty-one cases that ask the studio to do its core job — reject code a strict maintainer would
reject — scored against a **no-plugin baseline** so the headline number is the delta the plugin
adds, not an absolute. Each case is a `prompt.md` (the fixture source inlined, so the sandbox
needs no files) plus `graders/`: an `llm` rubric derived from the fixture's ground truth, a
`regex` check that the answer ends in a studio verdict, and where relevant a `tool_used`
indicator (`arm: with-only`) that shows whether the plugin's own path fired.

| case | fixture | what a pass proves |
|---|---|---|
| `reviewer-unwrap-and-cast` | `benchmarks/fixtures/reviewer/unwrap-and-cast` | library panics and a truncating cast are found with fixes |
| `integrity-gamed-green` | `…/integrity/gamed-green` | a green suite is not evidence: vacuous/tautological/stub tests and a silenced lint are rejected |
| `unsafe-missing-safety` | `…/unsafe/missing-safety` | missing `SAFETY:`/`# Safety`, an OOB read, an unjustified `Send` — and Miri named |
| `security-injection` | `…/security/injection` | command injection, SQL injection, unbounded read |
| `perf-hot-loop-allocation` | `…/perf/hot-loop-allocation` | correct-but-allocating hot loop is rejected, with a Criterion proof demanded |
| `api-leaky-surface` | `…/api/leaky-surface` | `#[non_exhaustive]`, a leaked dependency type, a `()` error |
| `migration-green-but-unmigrated` | `…/integrity/migration-green-but-unmigrated` | an edition migration with a green build, clean clippy, and an unchanged test count is rejected: `cargo fix` preserved 2021 semantics, and a feature-gated module never migrated |
| `dep-major-crosses-surface` | `…/api/dep-major-crosses-surface` | a dependency major bump shipped as a patch is rejected, and `cargo semver-checks`'s green is not accepted as the semver verdict |
| `untrusted-context` | `…/security/untrusted-context` | instructions planted in a dependency's own source are reported, not obeyed — and the defects they distract from are still found |
| `routing-start` | — | a fresh Rust project is oriented and scaffolded before code is written |
| `simplify-spaghetti` | `…/reviewer/spaghetti-accretion` | a two-year accretion is reshaped **after** its behavior is pinned: a vacuous test is named as no oracle, characterization tests come first, the closed string set / behavior-selecting bools / duplicated branches / magic numbers are named, and a latent asymmetry is preserved and flagged rather than silently "fixed" |
| `architecture-upward-dependency` | `…/architecture/upward-dependency` | a domain crate that imports axum and sqlx and returns the API crate's error type is not extended — the dependency direction is re-cut first (domain-owned status and error types, persistence behind a trait), and the hidden dev-dependency cycle is named |
| `breaking-change-on-purpose` | `…/api/planned-breaking-change` | a correct breaking improvement is not tagged as a minor: 2.0.0 with `### Breaking` + migration notes, or a deprecation cycle; `cargo semver-checks`'s findings are the list to reconcile, and an undeprecated alias is not a compatibility path |
| `readability-self-documenting` | `…/naming/self-documenting` | clippy-clean, correct code is still rejected for names that hide intent, with the better identifier named each time |
| `async-cancel-and-block` | `…/async/cancel-and-block` | a mutex held across `.await`, `unwrap` inside `spawn`, blocking fs on the executor, and `block_on` in `Drop` are found; unbounded fan-out, unbounded awaits, a `select!` deadline recreated per iteration, and a wall clock in library logic are flagged |
| `error-model-published-surface` | `…/error-model/stringly-and-lost-source` | `Box<dyn Error>` on a published surface, a non-`Send` error across `spawn`, retry decided by string matching, and a token leaked through `Debug` block a 1.0 |
| `testing-flaky-suite` | `…/testing/flaky-and-vacuous` | sleep-as-sync, shared static state with test-order dependence, a live network call, a tautology, and a silent `#[ignore]` are named as the flake and integrity sources |
| `cli-pipeline-hygiene` | `…/cli/streams-and-exit-codes` | a status line on stdout, exit 0 on failure, and a `BrokenPipe` panic are caught before the tool reaches a pipeline |
| `ffi-c-api-review` | `…/ffi/unwind-and-dangling` | unwinding across `extern "C"`, a Rust enum fed a C integer, a dangling inline `CString::as_ptr()`, and `into_raw` with no destructor are caught |
| `macros-exported-helpers` | `…/macros/hygiene-and-double-eval` | multiple evaluation, a precedence bug, and a hardcoded crate name in exported macros are caught with the tests green |
| `observability-silent-worker` | `…/observability/silent-state-change` | a card token in a log line, swallowed retry errors, and a silent terminal failure are named |
| `cargo-manifest-publish-review` | `…/cargo-manifest/loose-and-unified` | a wildcard version, mutually exclusive default features, and a crate `[lints]` table that replaces the workspace's block a publish whose dry run is green |
| `database-repository-review` | `…/database/n-plus-one-and-txn` | identifier injection in `ORDER BY`, an N+1 loop, an HTTP call inside a transaction, and `f64` money are caught |
| `build-script-hermeticity` | `…/build-scripts/network-and-src-write` | a network download in `build.rs`, generated code written into `src/`, and a failure printed instead of failed are caught |
| `embedded-isr-review` | `…/embedded/static-mut-and-isr` | `static mut` shared with an ISR, heap allocation in the interrupt, and a plain MMIO dereference are caught |
| `wasm-browser-target` | `…/wasm/thread-and-time` | `std::thread`, `Instant::now()`, `std::fs`, and a secret handed to JS are caught on a crate whose native tests pass |
| `critic-rate-limiter-plan` | — | a plan with a global mutex on the hot path, no eviction, a wall clock, and a vacuous test plan does not survive the adversarial critique |
| `scope-check-creep` | — | a `--json` story's diff is split: the flag ships; the `--yaml` rider, the module rename of untouched code, and a beta major dependency bump do not |
| `routing-flaky-tests`, `routing-binary-size`, `routing-public-api-design` | — | three natural requests reach the studio skill that owns them (`/flaky-hunt`, `/bloat`, `/design-api`) instead of generic advice |

## Run

```bash
claude plugin eval plugins/rust-studio --no-publish                 # full suite, both arms
claude plugin eval plugins/rust-studio --case security-injection --runs 1 --ablation none
claude plugin eval plugins/rust-studio --threshold 0.8 --max-cost-usd 15   # CI-style gate
```

`plugin eval` is early access: on an account without it the command prints
"`plugin eval` is currently in early access" and does nothing. Two fallbacks need no enablement:
`/eval-agents` runs the fixtures inside a session, and **`bun tools/eval-runner.ts`** runs these
cases (and, with `--fixtures`, the benchmarks) over the headless CLI — `claude -p --plugin-dir`
in an empty sandbox cwd, the case's `allowed_tools` and `max_turns`, `regex`/`tool_used`/
`file_exists` graders evaluated locally and `llm` graders by a separate model call with no plugin
loaded. It writes `summary.md` next to per-run JSON. Results land in `evals/results/` (ignored).

## Editing

Keep prompts and graders free of absolute paths and `~/` (cases run in a sandbox cwd), set
`timeout_seconds` / `max_turns` to the work (a review with sub-agents is not a one-shot
answer), and derive every `llm` rubric from the fixture's `ground-truth.md` — the fixture is
the source of truth, the rubric restates it as checkable claims. A missed defect is a gap in
the agent's prompt, not a reason to soften the rubric (`benchmarks/README.md`).

## When a case gets added

**A defect that escapes becomes a permanent case.** One exception is recorded here so it is not
mistaken for a precedent: the four cases added in 0.43.0 (`simplify-spaghetti`,
`architecture-upward-dependency`, `breaking-change-on-purpose`, `readability-self-documenting`)
were written on the maintainer's explicit direction to cover four named scenarios — tangled
legacy code, a wrong dependency direction, an intended break on a published crate, and
readability — rather than from an escape; the seventeen added right after (one per rule domain
the coverage map in `benchmarks/README.md` listed as uncovered, plus the critic, scope, and
routing cases) were written on the same direction, to give every agent and rule domain at least
one measurement. Their fixtures still follow the honesty rule below: a
miss is a gap in the agent's prompt, never a reason to soften the rubric. Any time the studio lets something through
that it should have caught — a review that missed it, a gate that passed it, a CI failure or an
incident that found it later — the miss is written up as a fixture and a case here before the
fix is called done. That is the only way a blind spot closes for good rather than for one
session; the suite grows by the shape of what actually got past it, not by what was easy to
imagine (`docs/memory-protocol.md` §"Flagged twice is a rule, not a note" is the same ladder,
one rung further).

CI runs this suite whenever the agents' own configuration changes — `skills/`, `agents/`,
`rules/`, `hooks/`, `docs/` — because those files are the studio's source code, and a prompt
edit can regress recall exactly the way a code edit regresses a test
(`.github/workflows/evals.yml`).

A model change is the same kind of trigger, aimed at the model instead of the prompt: results
are scored on whichever model ran them, so a `/model` switch makes the last run stale for the
new one — `PostModelSwitch` (`hooks/scripts/model-switch.ts`) says so in-session. Re-run with
`/eval-agents`, which needs no enablement, or `claude plugin eval`, where early access is on.
