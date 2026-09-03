# Rust Code Studio — `claude plugin eval` suite

Seven cases that ask the studio to do its core job — reject code a strict maintainer would
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
