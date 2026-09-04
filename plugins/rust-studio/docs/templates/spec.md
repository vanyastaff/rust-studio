<!-- Rust Code Studio template — a feature spec. Written by /spec into .rust-studio/specs/<slug>/spec.md. The Acceptance criteria are what /spec-verify checks. -->

# Spec: <feature name>

- **Status:** Draft | Approved | In progress | Done
- **Slug:** `<kebab-slug>`   ·   **Date:** `YYYY-MM-DD`   ·   **Owner:** `<lead>`
- **Governing ADR:** `<docs/adr/NNNN-….md or none>`

## Problem
*Carried over from `intent.md`, not re-authored here — the point of the intent is that this
sentence was written before an approach existed to bend it. If you find yourself rewording it
to fit the design, that is a correction to log in the intent, not a phrasing choice.*

## Goals / Non-goals
**Goals**
- *…*

**Non-goals (explicitly out of scope)**
- *…*

## Approach
*The chosen design in prose: key types/traits, module/crate placement, data flow, error
strategy, concurrency/async model. Reference recalled learnings (`/recall`).*

### Alternatives considered
| Option | Trade-off | Why not chosen |
|--------|-----------|----------------|
| *…* | *…* | *…* |

## Public surface & semver impact
*New/changed `pub` items. Breaking / minor / patch, and why. `#[non_exhaustive]` / sealing /
deprecation decisions. (See `/api-review`.)*

## Acceptance criteria
*The checklist `/spec-verify` will prove. Each must be observable/testable.*
- [ ] *…behavior… (verified by: test/perf/manual)*
- [ ] *…edge case…*
- [ ] *…error path…*

## Risks & open questions
- *…*

## Links
*`intent.md` (same slug) first, then ADR, related specs, memory notes (project memory store —
`/recall`), issues.*
