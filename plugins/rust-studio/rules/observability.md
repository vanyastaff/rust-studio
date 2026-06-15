---
name: observability
paths: "**/src/service/**/*.rs,**/src/services/**/*.rs,**/src/server/**/*.rs,**/src/worker*.rs,**/src/workers/**/*.rs,**/src/jobs/**/*.rs,**/src/bin/**/*.rs"
description: Tracing, diagnostics, and invariant visibility standards
---

# Observability Standards

Applies to service, worker, job, server, and binary boundary code.

## Instrument the state change
- New or changed state transitions, error variants, hot paths, background jobs, and
  cross-crate calls ship with observability in the same change.
- Use `tracing` spans/events with fields that explain who/what/where: IDs, operation names,
  bounded counts, durations, retry attempts, and decision outcomes.
- Do not log secrets or attacker-controlled payloads without redaction and size bounds.

## Make invariants visible
- Convert prose-only invariants into types, `debug_assert!`, metrics, or structured errors
  near the code that relies on them.
- A failure path should leave enough diagnostic signal to reproduce the issue without reading
  the whole call graph.
- Avoid println-style diagnostics in library/service code; use structured tracing.
