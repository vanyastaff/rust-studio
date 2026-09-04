# Template — the project's own `CLAUDE.md`

Copy into the **repo root** as `AGENTS.md`, and put a two-line `CLAUDE.md` beside it holding
only `@AGENTS.md` and nothing else — the same split `/adopt` uses per crate, for the same
reason: Claude Code reads `CLAUDE.md` and not `AGENTS.md`, while Codex, Cursor and Copilot read
`AGENTS.md`. The pointer holds no facts, so the two cannot drift. (Anthropic documents this
import as the remedy, and steers away from a symlink because a Windows checkout cannot make
one.) A root file in only one of the two names leaves every other host with no context at all. This is the user's file, not the studio's: it is
versioned, shared with the team, and read by every agent that opens the repo — including agents
that have never heard of this plugin. It is where the studio's understanding of a project
becomes durable.

**One page, hard limit.** Everything here is loaded on every turn, so a line earns its place by
changing what an agent does. Anything longer belongs in `.claude/rules/<topic>.md` (path-scoped,
loaded on demand) or in the repo's real docs. Delete every heading you have nothing true to put
under — an empty section is worse than a missing one, because it reads as "nothing to know here".

Replace every `<…>`. Delete this header block.

---

```markdown
# <crate or workspace name>

<One sentence: what this is and who consumes it.>

## Commands

- Build: `<cargo build --workspace --all-features>`
- Test: `<cargo nextest run --workspace>`  ← the one command that must be green
- Lint: `<cargo clippy --all-targets --all-features -- -D warnings>`
- Format: `<cargo fmt --all>`
- <Anything non-obvious: a required env var, a service the tests need, a feature that
  must be enabled, a codegen step that runs before the build.>

## Layout

<Only the dependency direction and who owns what — not a file listing the agent can read.>

- `crates/<a>` — <what it owns>. Depends on `<b>`; must not depend on `<c>`.
- `crates/<b>` — <what it owns>. No dependencies on the rest of the workspace.

## Conventions the code does not self-document

<The decisions someone would otherwise re-litigate or violate. Each line says the rule AND why,
so an agent can reason past it instead of pattern-matching it.>

- Errors: <typed `thiserror` enums in libraries; `anyhow` only at the binary edge — a caller
  cannot match on a `Box<dyn Error>`.>
- <Domain invariant: e.g. "amounts are `Money` (i64 minor units), never `f64` — rounding drift
  showed up in reconciliation.">
- <Async: which runtime, and what may never block it.>
- MSRV: `<1.xx>` — <why it is pinned there: a dependency, a customer, a distro.>

## Things that get got wrong here

<The correction ladder's landing site. A mistake caught twice goes here — with the reason, so
it holds. Prefer a lint or a CI check where one can express the rule; this section is for what
no lint can say.>

- <"`Config::load()` reads the env at call time, not at startup — do not cache it in a lazy
  static; tests set the env per case.">
- <"The `legacy_` modules are frozen: fixes go in `v2/`, and the shim is deleted in <release>.">
```

---

## Keeping it true

A stale `CLAUDE.md` is worse than none — it is confidently wrong, and it is loaded every turn.
Two rules keep it honest:

- **Second occurrence promotes.** When a review, a gate, or a PR thread flags the same thing
  twice, it stops being a per-change correction and lands here — or better, in a lint or CI
  check if one can hold it (`memory-protocol.md` §"Flagged twice is a rule, not a note").
- **Review it like code.** It changes behavior for everyone on the repo, so it moves through
  the same PR review as the code does. `/memory-doctor` proposes promotions; a human approves
  them.

Per-crate context files in a large workspace scope context to the crate being edited — see
`large-workspace.md` before adding them, because each one is loaded whenever that crate is open.
