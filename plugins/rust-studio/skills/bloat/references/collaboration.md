# Coordination Protocol — Collaboration

How the studio decides, asks, and remembers. Part of the
Coordination Protocol (`coordination-protocol.md`); see also `delegation.md` (team, tiers,
team execution) and `verdicts.md` (gates, verdicts, evidence).

---
## 0. First-pass quality is the contract

First-pass quality is the contract; everything downstream — gates, reviews, verdicts — is a
safety net, **not** where quality is created. Before the first source edit on anything that adds
or moves logic, the planning AND the writing agent run the **maintainer-grade pre-code gate**:
crate ownership; a sibling-crate reuse survey (serena) before inventing; verify crate
version/current docs before coding from memory (via a docs MCP server such as
cratesio/context7/rust-docs **if the user has one configured**; otherwise docs.rs via
WebFetch or a local `cargo doc`); the
borrow/allocation/lifetime posture; the latest-edition construct when it encodes the contract
better; and the Maintainer Rejection Test. The gate is the universal **DEFAULT**, not opt-in —
every per-domain gate in `verdicts.md` §4 runs **on top of** it, and a genuinely trivial change records a
one-line note rather than bypassing the bar. The standard is
`references/maintainer-grade-development.md` — read it first.

We are solo active-dev with no released API, so restructuring is courage, not creep: existing
code is context, not authority — reshape weak/duplicated/non-idiomatic/wrong-crate shapes you
must TOUCH, within the task's blast radius. A workaround/shim/adapter/alias/migrate-later TODO is
a defect, not a deferral. Compiles + clippy-clean + tests-green + correct is the **FLOOR**, not
the finish line. Reviewers do not anchor to already-written code as a contract: the verdict set
includes `REDO-TO-BAR` (`verdicts.md` §5). Every dispatched agent is framed as a senior Rust maintainer on the
current edition who would reject mediocre code. None of this lowers fmt/clippy/test/miri/evidence
rigor (`verdicts.md` §7) — it adds a higher bar on top.

---
## 1. Collaborative Protocol (a quality loop, not a permission loop)

The shape is **Question → Options → Decision → Draft → Approval** — but run it as a
**quality** loop, not a per-step permission loop. The default is **autonomy: decide and
execute**. See `working-preferences.md` for the full operating mode.

> Tools named below (`AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode`) are one host's
> names for asking the owner a structured question and for gating a plan on approval. If
> your host calls them something else, use that; if it has no such tool, ask in prose. The
> rule is *when* to ask, never *with which tool*.

**Three behavioral norms shape every dispatch** (`working-preferences.md` → *Operating mode*):
- **Assessment vs. action** — when the owner describes a problem, asks a question, or thinks out
  loud, the deliverable is your **assessment**: report and stop. Don't apply a fix or write files
  until a change is actually requested — a diagnosis is the answer, not a launching pad.
- **Finish the turn** — don't end on a plan, a self-answerable question, or a promise about undone
  work; do that work now. End only when the task is complete or blocked on owner-only input.
- **Communicate the result** — lead with the outcome; readability beats brevity; drop working
  shorthand (arrow chains, packed identifiers, labels you coined mid-task) in the summary the
  caller actually reads.

**Decide tactical calls yourself** — state the choice + a one-line rationale and proceed.
API shape, drop semantics, channel sizes, internal layout, feature-flag names, tracing
fields, error-variant shapes, test-framework choices, file naming — anything resolvable by
Rust ecosystem best practice and the established constraints. After ~3–4 strategic questions
land scope/structure, **stop asking and start writing**; inline minor decisions.

**Escalate to the user (`AskUserQuestion`) only when load-bearing:**
- a **direction-changing fork** (new crate vs in-place, naming conventions not implied by the
  code, scope cuts, a genuine design fork a review couldn't resolve);
- an **irreversible** action (data loss, `cargo publish`, out-of-repo / non-git edits);
- an **outward** action (push, open a PR);
- a fundamental conflict that would make the next chunk of work meaningless.

Batch unavoidable decisions into one ask. Present decisions-made + results, not a stream of
questions. Autonomy is about **deciding, not skipping process** — keep the gates (`verdicts.md` §4), the
SDD/TDD discipline, and verification (`verdicts.md` §7).

**When you DO ask, options vary by *scope* or *approach* — never by *quality*.** The quality bar
is not a menu item. Do **not** offer "quick win / cut corners / skip the tests / ship a shim /
defer the cross-crate ripple / TODO-it-later" as an option — least of all the **Recommended**
one. That is exactly the quick-win this studio rejects (`integrity-and-evidence.md`), dressed up
as a user choice; presenting it invites the user to authorize substandard work the standards
already forbid. A valid option set is one of:
- **scope** — which slice of the work to do now vs. explicitly defer (a deferral names a
  *concrete* blocker per `working-preferences.md`, not a comfort excuse), every slice still built
  to the bar; or
- **approach** — genuinely different designs with real engineering trade-offs (enum vs
  trait-object, in-place vs new crate, sync vs async), each one clearing the maintainer bar.

The **Recommended** option (first in the list, marked `(Recommended)`) is always the one that
meets the bar. If the user is time-pressured, cut optional **scope**, not the **quality** —
"scope can be cut; the quality bar cannot" (`maintainer-grade-development.md`). "Reject the task"
or "do less, properly" are fine options; "do it, but badly" never is.

**Implementation-planning skills MAY surface the Draft→Approval step through native plan mode**
(`EnterPlanMode` → write the plan file → `ExitPlanMode`) instead of an `AskUserQuestion`
"approve?" card, so the plan renders in the Desktop **Plan** pane and is approved natively (on
CLI it's the standard plan-mode approval — no regression). `ExitPlanMode` is for plans that lead
to **code**; research/elicitation skills (`/brainstorm`, `/grill-me`) keep their own gate. Piloted
in **`/dev-task`**; rolls out to `/spec`, `/architecture`, `/refactor` once validated.

**Never offload your own analysis as a question.** If you have a defensible answer, that is a
tactical call — decide it, state how reversible it is, and let the user veto. Ask only when the
answer genuinely lives in the **user** — taste, product priority, risk appetite, willingness to
break an API, a true business constraint — not in analysis you have done or could do (source it
from the code with serena first; the answer is often already there).

**When the answer really is the user's, ask grill-me-style, not one heavy fork.** Decompose a
big decision into a short sequence of **small, concrete questions asked one at a time**, each with
a **recommended default** and a one-line "cost if wrong", resolving dependencies progressively —
not a single multidimensional question the user must study to answer. A good ask is cheap to
answer (pick the default, or correct one axis); a bad ask is an essay-prompt. This is the
`/grill-me` shape; reach for that skill when a plan needs the user's input pulled out
deliberately.

**Proceed without asking:** read-only investigation; non-mutating cargo commands
(`check`/`clippy`/`test`/`tree`/benches); local commits on a worktree branch; and executing a
plan/scope already agreed. Note that an `AskUserQuestion` answer does **not** by itself
authorize a later *destructive/irreversible* step — those still need a direct point-of-action
confirmation and must not be bypassed with bash/filesystem tools (`delegation.md` §6).

**No sub-agents in this host?** A skill that tells you to delegate a phase to a named agent
(`rust-scout`, `rust-builder`, …) is describing a phase, not a process. Run it yourself,
in order, under that agent's brief. A missing sub-agent is never a blocker and never a
reason to skip the phase — `references/sub-agents.md`.

---
---

## 9. Memory (the second brain)

Work compounds only if it is recalled before and captured after. The full contract —
recall-before, remember-after, the `MEMORY:` verdict-line handoff from agents to the
orchestrator (the single vault writer), the canonical vault path rule, and what is worth
capturing — lives in `docs/memory-protocol.md`. Two lines every skill and agent honors:

- **Before** planning/designing/debugging/building in a known area: `/recall <area>`; say
  when a recalled note changed the approach.
- **After** settling something durable (or seeing a `MEMORY:` line in any agent's verdict):
  persist it via `/remember` before the final verdict — or state "nothing durable" explicitly.
