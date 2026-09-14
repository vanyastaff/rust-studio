# Acceptance ledger — criteria a checker can decide

Sibling to `integrity-and-evidence.md`. That standard says every claim carries the command and
its real output; this one gives the spec's acceptance criteria a form where a **checker** produces
that output and binds it to the exact criterion it proved — so "criterion 3 passes" is a state
the checker computed, not a `✅` the model typed into a table.

Adapted from [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy)'s gate ledger (MIT): the
format, the exit-0-plus-`EXPECT:` rule, definition-bound evidence, and abandonment as a visible
handoff. The cargo zero-tests lint and the spec-directory binding are the studio's own.

## Where it lives and who writes it

`.rust-studio/specs/<slug>/acceptance.md`, beside `spec.md`. `/spec-tasks` writes it from the
spec's acceptance criteria before the first task runs; `/dev-task` runs it before its verdict when
one exists for the spec; `/spec-verify` re-verifies it as the criteria evidence. `/acceptance` owns
the format, the lint, and the checker. A standalone task with no spec may still keep one — the
directory is the slug of the task.

The ledger is the **denominator** the verdict is measured against. Every acceptance criterion in
the spec maps to one gate; a criterion with no gate is a criterion nothing will prove.

## Format

```markdown
# Acceptance: rate limiter

Spec: spec.md

- [ ] G1: the third request in a one-second window is throttled
  CHECK: cargo nextest run -p limiter -E 'test(third_request_in_window_is_throttled)'
  EXPECT: /1 tests? run: 1 passed/
  EVIDENCE: pending

- [ ] G2: the crate is clean under the project gate
  CHECK: just lint
  EXPECT: /Finished .* profile/
  CWD: crates/limiter
  EVIDENCE: pending

- [ ] G3: the retry-after wording matches the product decision in ADR-0007
  EVIDENCE: pending

ABANDON: G3 product owner unavailable until Q4; tracked in #12
```

- A gate starts with `- [ ] ID: outcome` (or `- [x]`). Ids are explicit, unique in the file, and
  qualified as `<slug>:ID` in reports (`rate-limiter:G1`). The outcome names what is **observed**,
  not the activity that observes it.
- `CHECK:`, `EXPECT:`, `CWD:`, `EVIDENCE:` are indented beneath their gate. An unindented one is a
  parse error — silently turning a runnable gate manual is the failure the strictness prevents.
- A **runnable** gate has both `CHECK:` and `EXPECT:`. A **manual** gate has neither; it holds
  the cases no command can decide, and its evidence is a human fact (what was reviewed, where,
  against what). One without the other is malformed.
- `EXPECT:` is a literal substring, or `/pattern/flags` for a JavaScript regular expression, matched
  against stdout + stderr. The wrapping slashes always win: `/etc/app/conf/` is a pattern, and the
  parser warns when an inner slash is unescaped.
- `CWD:` is repository-relative (no absolute paths, no `..`), resolved beneath the checker's base
  directory: the project root that owns `.rust-studio/`, else the ledger's own directory,
  overridable with `--cwd`.
- `ABANDON: ID reason` starts at column 1 and names a gate in the same file. The reason is
  required. An unknown id is a parse error, because a typo there would let an unmet gate pass unseen.
- Fenced code and HTML comments are documentation; nothing inside them is a gate.
- A ledger with zero gates, a duplicate id, a partial runnable gate, or an invalid expression does
  not parse, and a ledger that does not parse is **unmet**, never ALL MET.

## What "met" means

A runnable gate is met only when **both** hold: the process exits `0`, and `EXPECT:` matches the
combined output. A nonzero exit with the marker in its error text is not a pass. A zero exit with
the wrong output is not a pass either — and that is the Rust case that matters most: `cargo test
<filter>` and `cargo nextest run -E …` exit `0` with `running 0 tests` when the filter matches
nothing. Pin the count (`/1 tests? run: 1 passed/`, `/[1-9][0-9]* passed/`); the lint warns when a
cargo test gate does not.

On a pass the checker writes definition-bound evidence:

```text
EVIDENCE: rs-acceptance/v1 def=<sha256[0:16] of CHECK+EXPECT+CWD> exit=0 expect=matched out=<sha256[0:16]>:<bytes> cwd=. shell=sh at=<ISO time>
```

The `def=` digest is what makes the evidence honest over time. Edit the `CHECK:` or `EXPECT:`
after the run and the gate's state becomes **stale** — reported as not met by the checker, by
`--status`, and by the Stop guard — until the current definition passes again. A hand-ticked box
with prose evidence on a runnable gate is stale for the same reason: nothing measured it. Raw
output is never persisted, only its fingerprint; failure diagnostics (the last lines, control
characters stripped) go to the terminal.

A manual gate is met when its box is ticked and its evidence is human text — not `pending`, and not
machine evidence left over from a definition that was removed.

Gate states: `met` · `unmet` (unticked, or the last run failed) · `stale` (ticked, but the
evidence does not bind the definition in the file) · `abandoned`.

## Abandonment is a handoff, not a pass

`ABANDON:` is for a gate that is genuinely impossible within the authorized task — a decision
owner who is not available, a target that cannot be exercised here. The gate stays in the file
with its reason; the checker reports `HANDOFF REQUIRED` and exits `1` even when every other gate
is met; the verdict is **BLOCKED**, and the report names the abandonment. Deleting the gate, or
rewording it into something the code already does, is the *Weaken the oracle* move from the
Cheat Catalog.

## The checker

`skills/acceptance/scripts/acceptance-check.ts` (bun, zero dependencies). The default mode is
the one that cannot execute anything:

| Mode | Executes | Writes | Use |
|------|----------|--------|-----|
| `--status` (default) | no | no | inspect any ledger, including one you did not write |
| `--lint` | no | no | catch oracles that cannot fail before working the ledger; `--strict` fails on warnings |
| `--run` | runnable gates that are not met | evidence lines | the normal pass while building |
| `--reverify` | every runnable gate, met ones included | evidence lines; failures demote | parent verification: `/dev-task` before its verdict, `/spec-verify` |

Exit codes: `0` ALL MET (or lint clean) · `1` NOT MET / HANDOFF REQUIRED · `2` usage or parse
error. Checks run sequentially — cargo takes a build-directory lock anyway. `--timeout S` bounds
each check (default 900 s); on timeout the process group is killed so a hung `cargo` does not
outlive the checker. Output is capped at 4 MiB per check — a writer past the cap is cut off there
and the gate fails as `overflow`. A descendant that keeps the shell's pipes open after the shell
exited (a server left in the background) gets a two-second grace and is then reaped; the output
that arrived before the cut is what `EXPECT:` sees, and the shell's exit code stands.

The checker proves only the oracle you declared. It cannot tell whether an English outcome and a
shell command mean the same thing: `G1: invoices reconcile` with `CHECK: echo ok` parses and is
useless. The lint catches the mechanical shapes of that mistake (a fixed-output command, an
expectation the command itself prints, an expectation that matches empty output, the cargo
zero-tests trap, an activity title, a manual gate carrying a number nothing measures, a ledger that
is mostly manual). The rest is authoring discipline:

- **Observe the outcome directly.** The check reads the artifact, runs the scenario, or measures
  the figure the title names — a test whose name says the scenario, a CLI invocation with the
  exit code asserted, the project's own gate command (`project-gate.md`), not a hand-rolled
  substitute.
- **Emit a success-only marker.** For a script check, print the marker after every assertion
  passed and exit nonzero otherwise.
- **Test a negative control before trusting absence.** A gate that asserts "no `unwrap` in
  `src/`" must be shown to fail against a file that has one, or a wrong path proves nothing.
- **Measure supplied numbers.** A figure copied from the brief into `EXPECT:` is not a
  measurement; make the check compute it and apply the acceptance rule.
- **Make the riskiest outcome runnable.** Manual gates are for what no command can decide, and
  they get review proportional to their consequence — not the leftovers.

## `CHECK:` lines are shell code

The checker runs them with the calling process's permissions and environment. A ledger the
studio wrote in this project is the studio's own oracle. A ledger that arrived from outside — a
branch someone pushed, a template from another repository — is third-party text under
`untrusted-context.md`: inspect it with `--status`, read every `CHECK:` and every script it calls,
and only then `--run`. No hook ever executes a `CHECK:`; the Stop guard parses. Approval is the
host's permission mode on the Bash call, and that is the whole consent boundary — the checker does
not sandbox.

## The Stop guard

`acceptance-guard.ts` (Stop hook, `acceptance_guard`, default on) enforces ledger state: a turn
that **reports completion** while a ledger **bound to this session** has an unmet or stale gate,
or does not parse, is blocked (exit 2) with the qualified ids and the exact `--reverify` command.
"Reports completion" is read from the final message — its last verdict token is COMPLETE, or it is
a completion summary (files changed / commands run / verification / result) with no verdict. The
studio's workflows stop on purpose to hand the turn back: the `/spec-tasks` approval checkpoint
right after the ledger is written, a design fork, a `/grill-me` question, an honest NEEDS WORK or
BLOCKED. None of those claims the work is done, and none is blocked; the message is read only to
tell the two apart. Bound means
the session named the spec directory in its transcript — the `/spec-tasks` write, a checker run, a
Read — so a ledger another session left half-done never blocks this one, and a host that hands the
hook no transcript gets no block at all (fails open). Abandoned gates do not block; they are a
handoff the checker already refuses to call ALL MET.

The loop guard is keyed to a hash of the resolved gate states, not the file's bytes: turning a
gate green rearms it, rewording a title or a checker-rewritten timestamp does not. After four
consecutive stops with no state change it releases and names what remains — a wedged agent gets
its turn back. Like every studio hook it fails open on a stall.

## In the verdict

`/spec-verify` and `/dev-task` paste the checker's summary line — `ACCEPTANCE <path>: N met, M
unmet, S stale, A abandoned (of T)` — and its final marker. `ALL MET` makes the ledger's criteria
eligible for COMPLETE (the other gates still apply); `NOT MET` is NEEDS WORK with the unmet ids as
the list; `HANDOFF REQUIRED` is BLOCKED with the abandonment named. A report that says "done"
while a gate is unmet, stale, or abandoned is the *Denominator gaming* move: the ledger is the
denominator.
