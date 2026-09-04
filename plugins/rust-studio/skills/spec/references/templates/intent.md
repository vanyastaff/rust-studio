<!-- Rust Code Studio template — the problem in the originator's own words, written by /spec Phase 0 into .rust-studio/specs/<slug>/intent.md BEFORE any technical framing. Claude drafts every field from what the user said; the user only corrects. If this costs the user more than a minute to fix, the draft was too thin — that is a defect in the draft, not a reason to skip the artifact. -->

# Intent: <feature name>

- **Status:** Draft | Confirmed | Superseded
- **Slug:** `<kebab-slug>`   ·   **Date:** `YYYY-MM-DD`   ·   **Stated by:** `<originator>`

## Asked for

> *The user's own words, quoted verbatim — not paraphrased into project vocabulary, not
> tidied up, not translated into type names. This block is the anchor: it is the one part of
> the record no later pass may rewrite. When the spec drifts, this is what it drifted from.*

## What's wrong today

*The concrete situation that hurts, told as something that happens — "adding one env var means
editing three files, and forgetting the third fails silently at runtime". Not "config handling
is unprincipled". If it cannot be told as a scenario, it is not the problem yet.*

## What "fixed" looks like

*The outcome in the user's own observable terms, 1–2 lines. Not acceptance criteria and not a
design — the thing the user would go look at to believe it worked. The spec's acceptance
criteria are derived from this and must trace back to it; criteria that trace only to the
chosen approach are how a spec proves itself right about the wrong problem.*

## Who feels it

*Whose problem this is: a downstream crate, a CLI user, an operator reading a log at 3 a.m.,
the next maintainer. Name them. A problem with nobody behind it is usually a preference, and
preferences are cheaper to settle here than after a spec is built on one.*

## Constraints the user owns

*Only the ones that live in the user and that the code cannot answer: a released version that
must keep working, an API they promised not to break, a date, a dependency they will not take,
a platform they must still ship for. MSRV floor, async runtime, lint policy and feature flags
are already stated in the repo — those are the agent's to read, never the user's to recite.*

## Not this

*The non-goals in the user's terms — the adjacent thing they are explicitly not asking for.
Scope arguments are cheapest here, before an approach exists to defend.*

---

## Corrections

*Changes to any field above made after `spec.md` was first written — one line each, dated.
This log is a tripwire, not bookkeeping. One correction is ordinary. A second or third means
the problem was never understood, and the honest response is to reopen the spec rather than
patch it.*

| Date | What changed | Why it surfaced only now |
|------|--------------|--------------------------|
| *…* | *…* | *…* |
