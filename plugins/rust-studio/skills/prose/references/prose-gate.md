# Prose Gate

The accent a language model leaves in technical prose, checked deterministically by
`hooks/scripts/prose-gate.ts` behind `/prose` and `validate-distribution.sh`.

## Why

On 2026-09-14 the plugin's 157k words of prose carried one em-dash every 57 words (all
separators, one per 34), the plugin README 3.65 per 100 prose words. A reader who has
seen a thousand Claude paragraphs this month recognises the accent before the content, and the
model that wrote it cannot hear it, so a linter runs first and the author rewrites.

## The rules

Only an `error` moves the exit code, and every hit prints its fix. Specimens are in backticks,
which the gate skips. The vocabulary lists are complete only in the script.

| Rule | Severity | Fires on | Fix |
|---|---|---|---|
| `dash-pair` | error | two em-dashes in one sentence or 220-character window | make the aside its own sentence or put it in parentheses; not a semicolon |
| `not-just` | error | `not just X, but Y` and its `only`, `merely`, `simply` forms. A final `X, not just Y.` passes | cut the first clause, keep the claim |
| `throat-clearing` | error | `it's worth noting`, `it's important to note`, `that being said`, `at the end of the day`, `in conclusion`, `to sum up`, `here's the thing`, `let's dive` | start at the claim |
| `hedge-stack` | error | `may potentially`, `could potentially`, `might possibly` | one hedge or none |
| `process-bleed` | error | `I've analysed`, `I have reviewed the`, `I hope this helps`, `as an AI` | delete; the reader was not in the session |
| `density` | error, `--full` only | separators above 1 per N prose words (`--density N`) | rewrite asides as sentences; semicolons and en-dashes count, so swapping the glyph does not pass |
| `vocab-root` | warn | by root, any case: `delve`, `seamless`, `cutting-edge`, `game-changing`, `synergy`, `paradigm`, `deep dive` and twelve more | a plainer word, not a synonym |
| `vocab-word` | warn | whole lowercase words (a proper noun passes): `journey`, `robust`, `leverage`, `streamline`, `empower`, `unlock the power` and nine more | say what it does |
| `proof` | warn | `10,000+ users`, or `3x faster` / `40% fewer` with no measurement nearby | cite the measurement or write [needs number] |

Vocabulary is advisory. A root-matched list measured zero true positives and at least six
false ones on this corpus (`leverage` as a noun, `Robustness`, `unlocks`), and in Rust prose
`unlock` is a mutex, `elevated` a privilege level, `realm` Basic auth, `robust` a crate name.
The shipped whole-word list fired twice on the corpus on 2026-09-14, both honest (`highest leverage` in
`skills/adopt/SKILL.md`, `Understand the landscape` in `agents/api-designer.md`).

## The register

The register is `rules/prose.md`, injected as a pointer on README, CHANGELOG, `docs/` and
`.rust-studio/` edits. It names no tell: a ban list in context makes the words more available
(`writing-skills.md` §6).

## Shown, not fixed

The rewrite belongs to whoever wrote the text and happens only when the user asks, one
sentence at a time as the fix text says, then a re-run. The metric line prints every time: a
dash pair rewritten as a semicolon keeps its density, and the density must go down, not move
between glyphs.

## The ceiling

A landing file holds at most 1 separator per 100 prose words: a house number with no external
source, chosen as 1 per 150 `wc -w` and re-expressed for the gate's denominator (prose words
are 63 to 76 per cent of `wc -w` here).

## Where it runs

This repository's validator runs `--full --density 100` on the landing files and
`--since <base>` on every other prose file: a touched sentence is always judged, an untouched
one never, and a run that reads nothing fails. In a user's project it is advisory:
`/pr`, `/changelog`, `/adr` and `docs-engineer` print the hits under the draft.

## Source

The linter-first loop, the 220-character window, the two vocabulary lists and "empty input
fails" come from [SlopMonster](https://github.com/ItsssssJack/SlopMonster) (MIT).
