# Rust Code Studio — agent benchmarks

A tiny evaluation harness that checks whether the studio's review agents actually catch the
bugs they claim to. It tests the **studio itself** (quality assurance for the plugin), not your
project's code. Driven by the `/eval-agents` skill.

## Layout
```
benchmarks/
  fixtures/
    <agent>/<case>/
      input.rs         # Rust with one or more planted defects
      ground-truth.md  # the defects that must be caught (id, line, type, severity)
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

## Adding a fixture
Drop a new `fixtures/<agent>/<case>/` with `input.rs` (plant realistic, identifiable defects)
and `ground-truth.md` (one entry per defect: id, line, type, severity, why). Keep `input.rs`
small and self-contained — it does not need to compile, but it should be plausible Rust. The
harness auto-discovers it.

## Honesty
A missed planted defect is a **real gap in the agent's prompt**, not a test to relax. Fix the
agent, not the fixture. This is the studio's own "when it looks clean, look harder" applied to
itself.
