---
name: prose
paths: "**/README.md,**/CHANGELOG.md,**/docs/**/*.md,**/.rust-studio/**/*.md"
description: Prose standards for the files the studio writes
---

# Prose Standards

The register for a README, changelog, PR body, ADR, spec or rustdoc paragraph:

- One em-dash per paragraph at most.
- An aside goes in commas or parentheses, or becomes its own sentence.
- State the claim first, with no preamble in front of it.
- A number cites the measurement it came from.
- Stop at the last real point.

The gate that measures this is `/prose`: it prints each hit with its fix and leaves the text
to its author.
