---
name: audit-unsafe
description: "audit unsafe blocks, review invariants, run miri — safety audit of all unsafe code in the project"
argument-hint: "[optional path]"
user-invocable: true
---

# /audit-unsafe — safety audit of all unsafe code

Enumerate every `unsafe` site across the crate(s), have **`unsafe-auditor`** judge each
one, run `cargo +nightly miri test` as evidence, and produce a safety review against the
SAFETY-GATE. You are the orchestrator: **you do not write code or fixes yourself — you
delegate all writes to `rust-builder`.** Follow the collaboration protocol
(`${CLAUDE_PLUGIN_ROOT}/docs/coordination-protocol.md`).

## Input

`$ARGUMENTS` may be a crate path or workspace root. Default to the workspace root. If the
path does not exist, ask the user to clarify before proceeding.

## Phase 1 — Enumerate

1. Restate the audit scope (path, crate name(s)); if genuinely ambiguous, ask once before
   proceeding.
2. Use `rg 'unsafe'` (via the Grep tool) to locate every `unsafe` token across the target
   tree; confirm non-obvious hits with `serena search_for_pattern`. Collect results as a
   `file:line` map grouped by crate.
3. Report the count: N sites across M files. If count is 0, state that and stop — verdict
   **COMPLETE (nothing to audit)**.

## Phase 2 — Review each site

4. For each `unsafe` site, spawn **`unsafe-auditor`** with the file and line context.
   `unsafe-auditor` judges three things for every site:

   - **Necessity** — could this be made safe without meaningful cost? If yes, flag it.
   - **Minimality** — is the `unsafe` block as narrow as possible? Flag any over-wide
     blocks.
   - **Soundness** — are the invariants that justify safety correct and complete?
     Does the existing `// SAFETY:` comment capture them accurately?

   Sites may be batched if they are in the same module and share a context, but never
   merge findings from different invariant boundaries.

5. Run evidence commands and cite their output:
   - `cargo clippy --all-targets --all-features -- -D warnings` (must be clean).
   - `cargo +nightly miri test` for each crate that contains `unsafe` (if the nightly
     toolchain is available; note if skipped and why).

## Phase 3 — Findings

6. Merge `unsafe-auditor`'s results into a prioritized, severity-tagged list. One
   finding per line:

   ```
   path:line  🔴 UNSOUND: <invariant violated or missing>. <required fix>.
   path:line  🟠 MISSING SAFETY COMMENT: no // SAFETY: present. <what it must say>.
   path:line  🟡 UNNECESSARY: safe alternative available. <suggestion>.
   path:line  🟡 OVER-WIDE BLOCK: unsafe block wider than needed. <narrow to: ...>.
   path:line  🔵 MIRI-SKIP: could not run miri here. <reason>.
   ```

   Skip empty categories. Do not pad with praise.

7. For UNSOUND or structurally significant findings, present 2–4 remediation options with
   trade-offs and state a default recommendation. This is a tactical decision — state the
   recommended path and proceed to Phase 4 unless the user explicitly wants to choose
   differently. Use `AskUserQuestion` only if the remediation involves a real design fork
   (e.g. removing `unsafe` entirely vs. introducing a new abstraction with API implications).

## Phase 4 — Record

8. Delegate to **`rust-builder`** to write the safety review document to
   `docs/safety-review.md` in the project, using
   `${CLAUDE_PLUGIN_ROOT}/docs/templates/safety-review.md` as the template. The document must include:
   - Audit date and scope (crate(s), commit/ref if available).
   - Complete findings table (all sites, status, severity, miri result).
   - Summary of SAFETY-GATE status: PASS / FAIL / PARTIAL.

## Phase 5 — Fix (optional)

9. If the user wants fixes applied, hand each finding to **`rust-builder`** with the
   approved remediation option. Instruct `rust-builder` to:
   - Add or correct `// SAFETY:` comments where missing or inaccurate.
   - Narrow `unsafe` block boundaries where flagged.
   - Remove or replace `unsafe` where a safe alternative was chosen.
   - Re-run `cargo +nightly miri test` and `cargo clippy` after changes; report output.
10. After fixes, re-spawn **`unsafe-auditor`** on the changed sites to confirm they are
    now clean. If any site is still flagged, loop back to step 9.

## Phase 6 — Verdict

11. Report:
    - Total sites found vs. sites resolved vs. sites deferred.
    - Miri status (clean / skipped / failing).
    - SAFETY-GATE: **PASS** (all sites sound + documented) / **FAIL** (unsound sites
      remain) / **PARTIAL** (all documented but miri skipped or some deferred by choice).
12. End with **COMPLETE / NEEDS WORK (numbered blockers) / BLOCKED**.
    - Suggest `/review` if the diff is ready for a broader audit.
    - Suggest `/dev-task` to track any deferred findings as stories.

## Error recovery

If `unsafe-auditor` returns **BLOCKED** (e.g. missing context, cannot determine
invariants without a design decision): surface it immediately with a clear description,
do not silently skip the site, and `AskUserQuestion` with options — (a) skip and record
as DEFERRED, (b) provide the missing context and retry, (c) escalate to
`systems-perf-lead`. Never discard completed findings.
