# Structural debt and memory review

## Structure

State the path/crate/keyword scope or whole-workspace default. Use
`references/profiles/structure.md` with `references/tooling.md`, `references/core.md` and
`references/llm.md` for the tree audit. A researcher can filter the inventory; a reviewer
judges it. Capture file:line evidence for:

- TODO/FIXME/HACK/XXX/TEMP/WORKAROUND markers and unjustified lint suppression.
- unwrap/expect/panic/unreachable paths reachable from public library entry points, excluding
  tests, binaries, examples and benches as appropriate; confirm reachability through callers.
- Large files/functions (rough leads: 400/60 lines) with actual counts and change risk.
- Public items with missing behavioral tests, using measured coverage where available.
- Near-duplicate functions/types, orphan files, module cycles, dead/accidental pub, unused
  dependencies, design drift, residue and untyped model calls. Use similarity-rs, cargo modules,
  public-api/unreachable_pub and shear where available; scripts/slop-audit.sh is the bundled
  mechanical report, not a substitute for judging behavioral equivalence and ownership.

Run the project's lint gate for supporting evidence. Cross-check test-gap, public API and
unsafe/hot-path findings using `references/profiles/testing.md`, `references/profiles/api.md`
and `references/profiles/systems.md` as relevant. A missing non_exhaustive attribute is not
itself a defect without an evolution requirement.

Return a fingerprinted ledger: location, category (Marker/Allow/Panic-path/Oversized/Test-gap/
Dup/Cycle/Dead/Drift/Residue/Untyped-LLM), severity, effort, evidence and reshape direction.
Prioritize live panic/correctness and untested public behavior, then change-risk and structural
debt; line count alone is not severity. Sort by severity and effort, retaining all findings.
An audit-only request ends with inventory, scope and total/severity counts. Authorized planning
uses `references/templates/tasks.md` and the shared `references/elephant-workflow.md` lifecycle.

## Durable capture

This is the single capture mechanism for a real out-of-scope finding from diff, scope or
structure review. Prepare it even when authorization for recording is absent.

1. Fingerprint location + category + normalized 5–8-word gist. Search .rust-studio/debt-log.md
   and, when available, GitHub issues across all states. A closed recurring issue is a possible
   regression; resolve already-tracked/recurred/distinct before duplicate filing.
2. Draft `references/templates/debt-log-entry.md`: quote the observed shape, source location,
   correct reshape and trigger. A title alone cannot preserve the finding.
3. Choose an authorized target: GitHub only with working gh/auth and a GitHub remote; otherwise
   .rust-studio/debt-log.md. State the fallback reason. Review alone does not authorize filing
   or ledger writes. Existing authorization needs no repeated confirmation.
4. On authorized external filing use an exact body file; on local capture append the dated
   entry. Maintain the fingerprint in the local ledger for either route. Return the issue URL
   or file:line. Without authorization, return the prepared finding and missing decision.

## Memory

`references/memory-protocol.md` owns store resolution, budgets, format and write authorization.
From the skill directory run `bun scripts/memory-doctor.ts audit --cwd <project-root>` (optional
--json). Report resolved store, index budget, dangling/unindexed/duplicate counts and every
missing-path/unverified/resolved/relative-date/secret/untyped/long-hook/promote finding.

Judge each note against current source and git history; an audit starts read-only. Propose:
reindex for missing index entries; restore or remove dangling entries after checking their
subject; correct moved paths; verify still-true notes with an absolute date; archive obsolete
notes; preserve a resolved defect's durable reason as a gotcha; replace relative dates; add
type/kind; shorten index hooks; merge duplicate subjects. Secrets need removal and rotation
notice, without copying the secret into the report.

Above 85% of the canonical index cap, prepare enough archive/merge/hook changes to restore
headroom. For conventions old enough or repeatedly flagged, propose an exact shared rule;
prefer an enforceable lint/deny/CI rule where appropriate. If no project instruction file
exists, prepare `references/templates/project-claude-md.md` as an option. Promotion into rules
requires its own authorization and then promoted status plus archive.

Explicitly requested maintenance is a separate bounded writing action under host memory rules:
the coordinator or implementer applies authorized changes, preserving notes under archive/,
never deleting them as cleanup. Helper mutations are dry-run until --apply; reindex/archive
and legacy-vault import must name the approved store and batch. Import converts frontmatter
and wikilinks without overwriting files; inspect projected budget first, then audit original
dates and unverified notes. An existing legacy vault is grounds to propose import, not consent.
Report before/after budget and verified/archived/promoted/merged/open counts with closing audit
output. If only audit was requested, deliver the proposed maintenance without applying it.
