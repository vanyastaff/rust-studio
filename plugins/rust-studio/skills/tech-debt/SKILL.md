---
name: tech-debt
description: "Use when auditing Rust technical debt: TODOs, lint suppressions, unwraps, oversized units, and missing tests."
---

# /tech-debt — audit and log technical debt

> Hosts without the studio's sub-agents run each named phase inline, under that agent's
> brief — see `references/sub-agents.md`.

Scan the codebase (or a scoped area) for technical debt, produce a prioritized
debt list, and offer to file stories. Evidence over opinion
(`references/verdicts.md`). You do not fix anything
here unless the user explicitly asks — that goes through `/dev-task`.

## Input

`input` is an optional path, crate name, or keyword (e.g. `src/api`,
`my-crate`, `async`). If empty, scan the whole workspace. State what you're
scanning.

## Phase 1 — Locate (read-only; no approval needed)

Spawn **`rust-scout`** to map the workspace layout. Then run the following passes
and collect every hit with `file:line`:

1. **Debt markers** — `rg` for `TODO`, `FIXME`, `HACK`, `XXX`, `TEMP`,
   `WORKAROUND` in any comment or string literal.
2. **Suppressed lints** — `rg` for `#[allow(...)]` attributes that have no
   inline comment explaining the justification (`// allow: <reason>`). Flag each
   one.
3. **Panic paths in library code** — `rg` for `unwrap()`, `expect(`, `panic!(` and
   `unreachable!()` on `src/lib.rs` or any path that is not a test module, binary, example
   or benchmark (calls inside `#[cfg(test)]` are exempt). Use serena
   `find_referencing_symbols` to confirm a panicking call reaches a public entry point.
4. **Oversized units** — `tokei` for file-level LOC, flagging files over ~400 lines; serena
   `get_symbols_overview` on those for functions longer than ~60 lines. Note actual counts.
5. **Missing tests** — with **`qa-lead`**: `get_symbols_overview` to enumerate `pub` items,
   then cross-check `cargo llvm-cov` output for untested public surface and modules with no
   `#[cfg(test)]` block.
6. **Slop and drift** — spawn **`slop-auditor`** on the same scope for the tree-level
   signals the passes above cannot see: near-duplicate functions and types (`similarity-rs`),
   orphan files and module cycles (`cargo modules`), dead or accidental `pub`
   (`unreachable_pub`, `cargo public-api`), unused dependencies (`cargo shear`), untyped
   model calls (`references/llm.md`), and the reading tells in `references/core.md`
   §"Clarity is design, not size". It returns a fingerprinted ledger, one line per finding
   with the reshape direction; merge it into the inventory as-is. The spawn buys filtering: the
   tools print pages, the ledger is what you triage. Inline, `scripts/slop-audit.sh -p <crate>`
   is the same mechanical layer as one Markdown report (commands: `references/tooling.md`
   §"Slop and drift").

Run the project's own lint gate for supporting evidence — `justfile`, `Makefile`, `xtask`,
cargo-make, lefthook, or the CI lint job, with its exact features and env
(`references/project-gate.md`); only a project with none falls back to:

```
cargo clippy --all-targets --all-features -- -D warnings
```

Cite the command, its exit code, and any relevant warning lines.

## Phase 2 — Triage

Present findings grouped by category. For each item record:

| Field      | Value |
|------------|-------|
| Location   | `file:line` |
| Category   | Marker / Allow / Panic-path / Oversized / Test-gap / Dup / Cycle / Dead / Drift / Residue / Untyped-LLM |
| Severity   | High / Medium / Low |
| Est. effort| Small (< 1 hr) / Medium (half-day) / Large (multi-day) |
| Notes      | Brief context |

**Severity heuristic:**
- High — `unwrap`/`panic` on a live code path that can crash a library
  caller; `FIXME` that documents a known correctness bug; completely untested
  public surface.
- Medium — unjustified `#[allow(...)]`; `TODO` that blocks a planned feature;
  oversized module making future change risky; a primitive duplicated across crates; a
  module cycle; a model answer parsed as text or branched on inside the prompt.
- Low — stylistic `HACK` notes; mildly oversized functions; coverage gaps in
  non-critical paths; orphan files, dead `pub`, restating comments and other residue.

Size is a lead, not a severity: an oversized unit is Medium for the change risk it carries,
never for its line count. The reshape a Dup / Drift / Residue line names is what gets filed,
not "shorten this".

Sort the final list by severity × effort (high-severity, low-effort items
first). Skip categories with zero findings.

## Phase 3 — Gate check (consult leads)

After triaging, consult the relevant leads for their domain:

- **`qa-lead`** — confirm test-gap findings and suggest coverage targets.
- **`systems-perf-lead`** — weigh in on `#[allow(clippy::...)]` suppressions
  and panic paths in hot or `unsafe` code.
- **`api-design-lead`** — flag any debt on the public API surface
  (missing `#[non_exhaustive]`, undocumented `pub` items, etc.).

Only spawn leads whose domain overlaps with the findings.

## Phase 4 — Approval gate

Prompt the user: show the prioritized debt table. Ask the user:

> "Here is the debt inventory. Would you like to (a) accept it as-is, (b) add or
> remove items, or (c) adjust priorities before we decide next steps?"

## Phase 5 — Story filing (optional)

Once the list is approved, offer to file stories:

> "I can ask **`product-steward`** to break the high- and medium-severity items
> into actionable stories. Shall I proceed, and should I group them by area or by
> priority?"

If the user agrees, spawn **`product-steward`** with the approved debt list and the user's
grouping preference; it turns the items into stories/tasks and writes the files (see
`/spec-tasks` and `references/templates/tasks.md`), which this skill never does itself.

For a single item rather than the whole approved list, or a lightweight issue instead of a full
spec-tasks breakdown, use **Durable capture** below instead of spawning `product-steward`.

## Durable capture — file a single finding

A finding that is real, out of scope for the diff in front of you, and worth doing later must
land somewhere that outlives the session, not in a chat message that dies with it. `/review`'s
Accretion check, `/model-domain`'s RE-CUT ESCALATED and `/scope-check`'s "split" disposition each
route a lone finding here; those pointers mean "come here", not a second definition of this
mechanism. Unlike Phase 5, which turns an *approved list* into stories, this section files *one*
finding on its own.

### 1. Dedup gate (always first)

Compute a fingerprint: `<file>:<line-or-range>` + category + a normalized 5–8 word gist of the
shape observed. Check it against:
- **`.rust-studio/debt-log.md`** in this repo (grep the fingerprint fields) — the ledger every
  filed-or-logged finding writes to, whichever rung below it actually lands on.
- **`gh issue list --search "<gist>" --state all`** when GitHub is in play — catches an issue
  filed by a session that never wrote, or never pulled, the ledger file.

A match is not an automatic skip: a *closed* issue whose finding has recurred is a regression,
not a duplicate. Present the match and ask the user: (a) already tracked, link it and stop;
(b) closed but recurred, reopen it (rung 1) or append a "recurred" line (rung 2); (c) related
but distinct, file fresh. Only file without asking when nothing matches.

### 2. Draft the finding

A one-line title is useless six weeks out: fill `references/templates/debt-log-entry.md` with the
`file:line`, the shape observed (quoted, not paraphrased), the correct re-cut, and what triggered
it.

### 3. Pick the rung (fallback ladder)

1. **GitHub issue** — only when all three hold: `gh` is installed, `gh auth status` is clean,
   and `gh repo view --json url` resolves (the remote is actually GitHub). Fall through on the
   first that doesn't.
2. **`.rust-studio/debt-log.md`** — the floor, always available: a file write cannot fail the way
   an API call can, it is git-tracked so it reviews and merges like code, and it is the only rung
   that works for a GitLab/Jira/Linear/no-tracker repo alike. Append the drafted entry under its
   own `## <date> — <title>` heading, and on a non-GitHub tracker still print it afterwards —
   this plugin holds no credentials for arbitrary trackers, so the user pastes it in themselves.

State which rung applies and why (no `gh`, no GitHub remote, or the user's own preference) —
never downgrade silently.

### 4. Gate — propose, never file

Filing is outward: a GitHub issue is public and notifies watchers; even the local ledger commits
a claim into repo history. Never file on the way past a review — prompt the user:

> "This finding is out of scope here. File it now — as a GitHub issue / a
> `.rust-studio/debt-log.md` entry — or hold it in this conversation only?"

Proceed only on the user's explicit go-ahead, the same outward-action gate `/pr` uses
(`references/collaboration.md`). On rung 1, run the drafted `gh issue create --title "<title>"
--body-file <tmp-file>` after approval and report the issue URL. On rung 2, append to the
ledger and report the `file:line` of the new entry. Either way, write (or update) the
`.rust-studio/debt-log.md` line for this fingerprint — so step 1 catches it next time even when
rung 1 is the one actually used.

## Output

End with a brief summary:

```
Debt scan complete.
  Scanned: <area>
  Total items: N  (High / Medium / Low)
  Stories filed: yes / no
  Next step: /dev-task <item> to fix the top item, or /review for a diff audit.
```

Verdict: **COMPLETE** (list delivered) / **NEEDS WORK** (blockers listed) /
**BLOCKED** (name the missing dependency and suggest a next step, e.g.
`/architecture` if the debt is entangled with an unresolved design question).
