# Elephant lifecycle and catalog consolidation

This follow-up replaces overlapping orchestration with one substantive development process.
It follows the [design decision](designs/elephant-workflow/spec.md) and
[Elephant workflow](elephant-workflow.md). It supersedes the catalog counts in the earlier
[November audit](agent-skill-audit-2026-11.md); historical verification results remain dated.

## Catalog decisions

| Previous entry | Decision | Preserved responsibility |
|---|---|---|
| `/brainstorm` | Remove | `/spec --explore` compares alternatives and records consequential decisions in the same design |
| `/spec-tasks` | Remove | `/dev-task --plan` owns task planning, reservation, handoff, integration and resume |
| `concept-note.md` template | Remove | Context, intent and spec templates carry evidence and alternatives without another competing artifact |
| `/architecture`, `/design-api`, `/grill-me` | Keep and update | Crate boundaries, public API contracts and unresolved user decisions refine the same spec |
| `/start`, `/adopt` | Keep and update | Orientation and project context are different outcomes from implementing a feature |
| `/doc-review`, `/spec-verify`, `/acceptance`, `/review` | Keep and connect | Design comprehension, delivered spec compliance, executable criteria and code quality have different evidence boundaries |
| 33 agent roles | Keep | Existing architecture, domain, implementation and independent review responsibilities remain distinct |

The resulting catalog has 59 skills and 33 agents. The inventory considered all entry points
and agent descriptions, with deeper review of lifecycle orchestration. This is not an
end-to-end behavioral audit of every specialist. Role count alone does not establish quality.
Further retirement should identify a real duplicate responsibility and migrate its callers.

The product steward now returns proposed artifacts consistently with its read-only tools.
The builder explicitly follows the artifact reconstruction and pre-write freshness boundary.
Routine report writing belongs to the coordinator; an agent dispatch must add expertise or
independence. No Elephant persona, second acceptance system or automatic memory store was added.

## Compatibility and evidence

New designs use `docs/designs/<slug>/`. Legacy `.rust-studio/specs/<slug>/` remains supported
in place. Ambiguous slugs require explicit paths. Guard progress is keyed by full artifact
identity; both default roots use the owning repository for acceptance command cwd. Custom
paths require direct checking with explicit cwd and do not acquire automatic Stop coverage.

The read-only helper prepares reserved tasks from explicit artifacts and checks their bytes.
The coordinator still verifies actual write overlap, destination prerequisites, authorization
and comprehension. Reused history is not fresh context. Missing isolation is reported as a
limitation, never converted into success. Resume retains repairs, findings and partial work.

Regression tests exercise the helpers and hooks. Supplied-record evaluations exercise
instruction distinctions. The live cold-handoff fixture separately tests artifact-only
transfer between conversations and has private library/CLI behavior checks. Its optional
native runner records both sessions and combined budget; a simulated runner test does not
count as a native host run. See the fixture README and release verification report for the
actual execution evidence and remaining platform limitations.
