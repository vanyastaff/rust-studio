---
name: spec
description: "Use when a Rust change needs a durable design decision across sessions or tasks."
---

# /spec — record a durable design

Use this for a change whose approach, scope, or public impact should survive the current
conversation. A small, clear change goes straight to `/dev-task`; an unshaped idea goes to
`/brainstorm`.

## Input and outcome

`input` is the feature or a path. When a future worker could otherwise guess the product goal,
write the version-controlled `intent/<slug>.md` from `references/templates/intent.md` first. Reuse
it until the product direction changes. It captures the problem, outcome, affected users and
systems, constraints, and open questions in the originator's terms. Keep technologies, components,
acceptance criteria, and implementation order out of it; those belong to the spec or plan. Let the
originator correct the draft before treating it as design input.

Write `.rust-studio/specs/<slug>/spec.md` from `references/templates/spec.md`. A spec is not a
permission gate or ticket. Keep it short enough to guide the next worker:

- problem, intended outcome, and non-goals;
- chosen approach, affected crates or public surface, and alternatives only where there was a
  real decision;
- observable acceptance criteria, risks, and open questions.

Read the affected code and project conventions before choosing an approach. Consult a specialist
or use a separate worker only when its independent judgment or file-map would change the result;
otherwise decide inline. For public API, `unsafe`, security, or cross-crate design, apply the
matching specialist review before recording the decision. See `references/delegation.md` for the
cost rule and `references/maintainer-grade-development.md` when the change moves a boundary.

Name the owning lead and review roles in the spec. The lead resolves design forks; specialists
supply evidence and proposals. Existing authorization covers a plan that stays within the request.
A later `/spec-tasks <slug>` turns the record into an executable agent plan; `/spec-verify <slug>`
checks the finished result against its criteria and the intent when one exists.

## Output

Report the spec path, the chosen approach, the acceptance criteria, and unresolved decisions.
End with **COMPLETE**, **NEEDS WORK**, or **BLOCKED**.
