<!-- Rust Code Studio template — one entry appended to .rust-studio/debt-log.md (or filed as
     a GitHub issue body) by /tech-debt's "Durable capture" mechanism. Routed to by /tech-debt
     itself, /review's Accretion check, /model-domain's RE-CUT ESCALATED, and /scope-check's
     "split" disposition. Evidence over assertion: quote the shape observed, don't paraphrase it. -->

## <YYYY-MM-DD> — <imperative, specific title>

- **Status:** open · **Fingerprint:** `<file>:<line> | <category> | <5-8 word gist>`
- **Filed:** `gh issue #<n>` <url> — or `local` (no GitHub rung reached)
- **Category:** Marker / Allow / Panic-path / Oversized / Test-gap / Accretion / Re-cut / Scope-split
- **Trigger:** <the check/skill/PR that surfaced it — e.g. "/review Accretion check on PR #142",
  "/model-domain RE-CUT ESCALATED", "/scope-check split", "/tech-debt scan">

**Location:** `<file:line or file:line-range>`

**Shape now** (quoted, not paraphrased):
> <the file:line excerpt or the exact behavior observed>

**Correct re-cut:** <what a maintainer would do instead, concretely enough to start from>

**Why deferred:** <the blast-radius / scope reason it doesn't belong in the diff that found it>
