---
name: research
description: "Use when a Rust question needs primary sources — crate source, docs.rs, the Reference, an RFC — investigated and cited."
---

# /research — settle a question against primary sources

Answer a question by reading what **owns** the behavior, then leave a cited note behind.
Recall from training is a hypothesis, not a source: crates move fast, and the answer that was
true two versions ago is the expensive kind of wrong.

## When NOT this skill
- The studio already learned this → `/recall` first; research only what recall misses.
- The doubt is about *your* code, not the ecosystem → `/debug` or `/prototype`.
- You need a decision made, not a fact found → `/brainstorm` or `/grill-me`.

## Primary sources, in order of authority
Follow every claim back to the thing that owns it:

1. **The crate's own source** — the definitive answer for any dependency's behavior.
   `cargo add <crate>` then read it under `~/.cargo/registry/src/`, or clone the repo.
   Read the impl, not just the signature.
2. **docs.rs for the exact version in `Cargo.lock`.** Version-pin the URL
   (`docs.rs/<crate>/<version>/…`); "latest" answers a question you did not ask.
3. **The Rust Reference, std source, and the Nomicon** for language and `unsafe` semantics.
4. **RFCs, tracking issues, and release notes** for why something is the way it is, and for
   what is stabilizing.
5. **The crate's own issue tracker and CHANGELOG** for known bugs and behavior changes.

A blog post, forum answer, or model recollection is a **lead**, never a citation. Chase it to
the source that owns it, then cite that.

## How to run
1. State the question in one line. If it is really several, split them — each gets its own
   answer and its own citation.
2. Where the host provides background workers, dispatch the reading so the session keeps
   moving; otherwise read inline (`references/sub-agents.md`).
3. Pin the versions you are answering for — read them from `Cargo.lock`, and say so. An
   answer without a version is not an answer.
4. Read the source. Where behavior is subtle, confirm it by running it: a scratch
   `/prototype` that demonstrates the behavior beats a paragraph asserting it.
5. Write `.rust-studio/research/<slug>.md`: the question, the answer, and **one citation per
   claim** with a version-pinned link or a `file:line` into the crate source. Mark anything
   you could not confirm as open rather than smoothing it over.

## Output
```
QUESTION:  <what was asked>.
ANSWER:    <the finding, in one or two lines>.
VERSIONS:  <crate@version the answer holds for>.
SOURCES:   <what was actually read>.
OPEN:      <anything unconfirmed — or "none">.
NOTE:      .rust-studio/research/<slug>.md
```
End with **ANSWERED** or **UNRESOLVED** (say which source would settle it).

A finding that changes how the project works is a durable learning: run `/remember` to keep it
(`references/memory-protocol.md`), and `/adr` when it decides something hard to reverse.
