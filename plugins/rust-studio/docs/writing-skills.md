# Writing Studio Skills

How to add or edit a `SKILL.md` so the studio stays predictable. **Predictability** means
the agent takes the same *process* every run — not that it emits the same text. A review
skill that finds different bugs each run is working; one that sometimes skips the clippy
evidence is not.

`CONTRIBUTING.md` holds the mechanics (frontmatter keys, the reference-bundling invariant,
what CI enforces). This is the editorial standard behind them. The vocabulary is adapted
from [mattpocock/skills](https://github.com/mattpocock/skills).

---
## 1. Invocation — who can start this skill

Two states, and every skill sits in exactly one.

- **Model-invoked** (the default) — the agent can fire it on its own, and another skill can
  reach it. The price is permanent: the description sits in the context window every turn,
  competing for attention with the other 50-odd descriptions.
- **User-invoked** — only a human typing `/name` starts it. Claude drops the description
  from context entirely, so it costs nothing per turn. Nothing else can reach it.

A skill is user-invoked in **both** harnesses or neither: `disable-model-invocation: true`
in the frontmatter *and* `policy.allow_implicit_invocation: false` in
`skills/<name>/agents/openai.yaml`. `validate-distribution.sh` fails the build when the two
disagree, or when the roster below and the files disagree.

The roster is **side-effecting work**: a skill that publishes, commits, opens a PR,
scaffolds a crate, or rewrites machine config waits for a human. Currently `add-dep`,
`commit`, `eval-agents`, `new-crate`, `pr`, `progress-bar`, `publish`.

The rest stay model-invoked, because the studio's routing depends on the agent reaching
them. Before moving a skill onto the roster, check nothing invokes it: naming it as a
*next step* ("Next: `/commit`") is a suggestion to the human and stays fine, but a skill
that another skill actually runs must remain model-invoked or the chain breaks silently.

---
## 2. The description

The description does two jobs — say what the skill is, and carry the triggers that fire it.
All descriptions share a 6,500-character budget, so every word is spent against the others.

- **Front-load the leading word.** The description is where it does its invocation work.
- **One trigger per branch.** Synonyms renaming a single branch are duplication; collapse
  them and keep only genuinely distinct cases.
- **Cut identity the body already states.** Triggers earn their place; a restated summary
  does not.

The house form is one sentence: `"Use when <trigger>: <the distinct cases>."`

---
## 3. Information hierarchy

Rank content by how immediately the agent needs it, and push everything you can downward.

1. **Steps** — the ordered actions in `SKILL.md`. The primary tier.
2. **In-skill reference** — a rule, table, or definition consulted on demand. Often a
   legitimately flat set (every check of an audit on one rung); that is a fine shape.
3. **Disclosed reference** — a `references/<name>.md` citation, loaded only when the agent
   follows it. Its source of truth is `docs/` or `rules/`; `sync-references.sh` bundles it.

**Branching decides what gets disclosed**: inline what every run needs, disclose what only
some runs reach. A pointer's *wording*, not its target, decides how reliably the agent
follows it — sharpen weak wording before pulling material back inline.

Once a piece has its rung, **co-locate** it: keep a concept's rule, caveats, and example
under one heading instead of scattered, so reading one part brings its neighbours along.

**An example teaches a pattern and forecloses the rest.** Worked examples were how you got a
weaker model to use a tool correctly; on a current model they narrow the exploration space to
what you demonstrated. Spend the tokens on an expressive *interface* instead — a well-named
parameter, an enumerated state (`pending / in_progress / completed`), a verdict vocabulary —
which implies correct use without bounding it. Keep an example only where the shape is
genuinely unguessable from the interface, and prefer one that disambiguates over one that
demonstrates.

---
## 4. Completion criteria

Every step ends on a condition that tells the agent the work is done, and each one is
either **checkable** (can it tell done from not-done?) or fuzzy. Fuzzy criteria invite the
agent to declare victory and slide to the next step.

Where it matters, make the criterion **exhaustive** — "every `unsafe` block has a `SAFETY:`
invariant" drives real legwork where "review the unsafe code" does not.

The studio already ships the strongest form of this: **gates** and **verdicts**
(`verdicts.md`). A skill that ends in `COMPLETE / NEEDS WORK / BLOCKED` against a named
gate has a checkable bound; prefer that over inventing a new one.

---
## 5. Leading words

A **leading word** is a compact concept the model already holds from pretraining, which the
agent thinks with while running the skill. Repeated as a token — never re-explained as a
sentence — it anchors a whole region of behaviour in a few characters.

The studio's live set: *gate*, *verdict*, *evidence*, *maintainer bar*, *blast radius*,
*shape*. Reach for an existing word before coining one: a made-up term recruits no priors,
so you pay in definition tokens what a pretrained word gives free.

They pay off twice — anchoring execution inside the body, and anchoring invocation when the
same word appears in the description and in how you actually talk about the work.

---
## 6. Steer toward the target, not away from the trap

A prohibition names the thing it bans and makes it *more* available. "Never write verbose
comments" puts verbose comments in context; the negation is a weak modifier over a strongly
activated concept.

State the target instead. `publish` says *prepare a dry-run and stop* rather than a bare
"never publish". Keep a prohibition only as a hard guardrail you cannot phrase positively —
and even then pair it with what to do instead.

---
## 7. Pruning

Each meaning gets one **single source of truth**, so changing behaviour is a one-place edit.
Then hunt the four ways a skill rots:

| Failure | What it looks like | Cure |
|---|---|---|
| **Duplication** | The same meaning in two places — a checklist written out in two steps. | Name it once, reference it by name. |
| **Restatement across layers** | The same instruction in the skill body *and* the tool description *and* an injected reminder. Repetition was how you made a weaker model attend; now it reads as conflicting emphasis and dilutes both copies. | Pick the layer closest to the decision — usually the tool/interface — and delete the others. |
| **Re-announcement** | The same pointer injected turn after turn. The studio shipped this: rule injection keyed its dedupe by file, so `core.md` was announced once per file touched — 70% of all rule-pointer tokens in a 12-file session (`bun tools/context-cost.ts`). | Say it once per context, and re-arm only when the context that held it is actually gone (PreCompact), not on a fixed schedule. |
| **Sediment** | Stale layers nobody removed, because adding feels safe. | Check each line still bears on what the skill does. |
| **No-op** | A line the model already obeys by default. Test: does it change behaviour versus no instruction? | Delete it, or replace a weak word with one strong enough to beat the default. |
| **Sprawl** | Simply too long, even when every line is live and unique. | Disclose reference to `references/`, split by branch. |

Run the no-op test sentence by sentence, and delete whole sentences rather than trimming
words out of them.

---
## 8. Before you push

- Invocation set in both harnesses, and consistent with the side-effecting roster.
- Description is one sentence, leading word first, one trigger per branch.
- Every step ends on a criterion the agent can check.
- Anything cited as `references/<name>.md` exists in `docs/` or `rules/`; you edited the
  source there, never the bundled copy.
- No meaning stated twice; no line that changes nothing.
- `./scripts/validate-distribution.sh` and `bun test` pass.
