---
name: prose
description: "Use when checking prose for AI tells: README, changelog, PR body, ADR, or rustdoc."
---

# /prose — the accent, measured before a reader hears it

A language model leaves an accent in technical prose, and the model that wrote the text
cannot hear it. This skill runs a deterministic linter over the text and prints every hit
with its fix. The rule catalogue and the reasoning: `references/prose-gate.md`. The register
it serves: `references/prose.md`.

The linter ships in this skill: `scripts/prose-gate.ts` (bun, zero dependencies), run from
the skill directory.

## When NOT this skill
- You want a model to rewrite the text → the studio has no such skill on purpose: a
  same-model rewrite is what this gate measures.
- You want a diff or a path reviewed for correctness, soundness, or scope → `/review`. This
  skill reads prose only: markdown and the `///` / `//!` bodies of a `.rs` file, never code.
- You want a spec, plan, or ADR judged for coherence and feasibility → `/doc-review`. This
  skill judges sentences, not arguments.

## Steps
1. **Choose the scope.** `--full` (the default) judges every sentence of a file, with
   `--density 100` when a visitor lands on it. `--since <rev>` judges only the sentences
   touched since a revision. `--stdin` judges a draft that is not on disk. Done when one
   command line names the input and one scope.
2. **Run it** from the skill directory. `$PWD` in the examples is the project directory, not
   the skill directory, so the file paths stay absolute:
   ```bash
   bun "scripts/prose-gate.ts" --full "$PWD/README.md"
   bun "scripts/prose-gate.ts" --since main "$PWD/CHANGELOG.md" "$PWD/docs/guide.md"
   bun "scripts/prose-gate.ts" --stdin <<'DRAFT'
   <the draft>
   DRAFT
   ```
   Done when the tool has exited: a summary line, or an exit-2 message naming why.
3. **Relay the report verbatim**: the metric line per file, every hit as
   `file:line rule [severity]: excerpt` with its `fix:` line, and the summary. Done when the
   reader can act on each hit without opening the file.
4. **Verdict.** **COMPLETE** = zero `error` hits (warnings listed). **NEEDS WORK** = the
   `error` hits, listed. **BLOCKED** = exit `2`, with the reason the tool printed. End with
   **COMPLETE / NEEDS WORK / BLOCKED**.

## Rules
- Hits are shown and the text stays as its author left it: a rewrite happens only when the
  user asks, one sentence at a time, then a re-run (`references/prose-gate.md` §"Shown, not
  fixed").
