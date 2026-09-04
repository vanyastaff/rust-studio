# Rust Code Studio — `claude plugin eval` suite

Ten cases that ask the studio to do its core job — reject code a strict maintainer would
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

## Run

```bash
claude plugin eval plugins/rust-studio --no-publish                 # full suite, both arms
claude plugin eval plugins/rust-studio --case security-injection --runs 1 --ablation none
claude plugin eval plugins/rust-studio --threshold 0.8 --max-cost-usd 15   # CI-style gate
```

`plugin eval` is early access: on an account without it the command prints
"`plugin eval` is currently in early access" and does nothing. `/eval-agents` runs the same
fixtures inside a session and needs no enablement. Results land in `evals/results/` (ignored).

## Editing

Keep prompts and graders free of absolute paths and `~/` (cases run in a sandbox cwd), set
`timeout_seconds` / `max_turns` to the work (a review with sub-agents is not a one-shot
answer), and derive every `llm` rubric from the fixture's `ground-truth.md` — the fixture is
the source of truth, the rubric restates it as checkable claims. A missed defect is a gap in
the agent's prompt, not a reason to soften the rubric (`benchmarks/README.md`).

## When a case gets added

**A defect that escapes becomes a permanent case.** Any time the studio lets something through
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
