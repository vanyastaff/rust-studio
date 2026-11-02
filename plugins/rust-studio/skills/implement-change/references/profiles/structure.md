# Structural audit

Use for tree-wide duplication, dead code, cycles, accidental public surface and design drift.
Read `references/core.md`, `references/types.md`,
`references/architecture.md` and `references/llm.md`.

Fix the scope, date and accepted baseline before comparing results. Tool counts and file
length are leads; a finding identifies the concrete responsibility, boundary or name that
is wrong. Read both bodies before calling a pair duplicate. Record unread leads explicitly.

- `scripts/slop-audit.sh -p <package>` supplies the mechanical report.
  similarity-rs can locate duplicate functions/types; separate test fixtures and cfg(test)
  ranges even when --skip-test is used. Same type/two names differs from trait-method impls.
- cargo modules orphans needs --cfg-test to account for linked test modules. For dependency
  cycles distinguish parent re-exports from sibling cycles; a clique caused by use super::*
  is one glob-import finding before deciding which real cycles remain.
- Probe unreachable_pub/public-api, cargo shear and optional pedantic/nursery lints without
  changing the project gate. Confirm unused dependencies through actual imports/qualified paths.
- Read naming, plan-ID residue, commented-out code, duplicate production facts, oversized
  responsibilities, wrong-crate concepts and sibling reuse. Name the reshape, not a line limit.
- Trace every model call: typed output contracts and Rust control flow must replace text
  parsing, prompt-owned branches or swallowed default decisions where a typed contract is needed.

Fingerprint findings at the definition site using path/range, tag and a short shape gist;
enumerate other affected sites and rank blast radius. Return counts, commands, date and
unread leads. Mechanical defects (real cycles, dead production paths/dependencies, shipped
todo or untyped decision contracts) yield NEEDS WORK; reading-layer shape failures yield
REDO-TO-BAR; COMPLETE means no unresolved findings beyond the accepted baseline. A required
missing tool with no adequate fallback leaves the audit BLOCKED.
