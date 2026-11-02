# Design architecture

Apply the architecture profile (`references/profiles/architecture.md`) to the shared spec
and lifecycle in `references/elephant-workflow.md`.

1. Map Cargo manifests, entry points, re-exports, modules, callers, tests and configuration.
   Record path:line evidence for ownership, layering, missing boundaries and cycles. Survey
   sibling primitives, traits, errors, builders and helpers before proposing new items.
   Every new item needs a reuse-versus-new rationale.
2. Compare meaningful boundary choices on coupling, compile time, reuse, public surface and
   maintenance. For split-versus-keep decisions apply the extraction tells and counter-cases
   in `references/architecture.md`, including those that do not fire. Retaining a module is
   valid when extraction has no evidence-backed benefit.
3. For each option specify structural invariants, caller obligations, visibility, async
   placement, lifecycle, failure/recovery, misuse and abuse at trust boundaries. Test the
   responsibility against three likely extensions or a two-year horizon. Verify ecosystem
   claims against primary sources and versions, or label the last verification and uncertainty.
4. Record an acyclic dependency diagram, module/crate responsibilities, key types/traits,
   migration/removal and acceptance in the same spec. Use
   `references/templates/architecture.md` for requested architecture documentation and
   `references/templates/adr.md` for project-required decisions. Link authoritative documents
   instead of keeping competing descriptions.

Apply the shared maintainer assessment and Goldfish review. New-crate, cross-crate and
boundary-moving designs need a fresh reviewer with adversarial and architecture profiles,
plus relevant domain lenses (`references/sub-agents.md`). ARCH-GATE requires sound,
non-overlapping boundaries, acyclic documented dependencies, required ADRs, and resolved or
explicitly tracked layering violations with consequences. Deferral cannot waive correctness
or safety. Report gate evidence and unresolved decisions; an architecture-only request ends
at the reviewed design.
