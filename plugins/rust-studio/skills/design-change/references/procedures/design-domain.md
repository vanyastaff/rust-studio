# Model a domain

Load `references/profiles/api.md`, `references/types.md` and `references/core.md`.
Locate existing related types and actual callers before naming new ones. Establish distinct
states, invariants, legal transitions and invalid combinations from evidence; elicit only
domain decisions the evidence cannot resolve through the clarify procedure.

For an existing model, inventory every field/variant, impl and call site, and compare the
original requirements in tests/docs with current requirements. Apply the Design-drift tells
in `references/types.md` and record both firing and non-firing tells at path:line. Decide:

- EXTEND when the requirement fits an existing dimension without additional special-case
  booleans, meaningless optional fields or catch-all branches.
- RE-CUT when drift or a distinct concept needs a new shape within the authorized scope.
- RE-CUT, ESCALATED when the necessary reshape crosses that scope. Record its consequence
  durably in the authorized design/debt artifact. An authorized immediate extension is valid
  only if it is safe and does not deepen the drift; otherwise report the blocker. A wide
  migration alone does not justify carrying a shape that no longer models the concept.

Compare applicable newtypes, enums, typestate/phantom types, sealed traits and builders.
Each option states compile-time guarantees, remaining runtime checks, ordinary caller
ergonomics and SemVer impact. Typestate must explain variance, drop-check ownership and
Send/Sync effects of its PhantomData choice, plus monomorphization cost and shared logic.
Sealing must document downstream extension restrictions. Assess `#[non_exhaustive]`, private
markers and builders against actual downstream use rather than adding restrictions blindly.

Sketch types, constructors, conversions and transitions with doc-comment stubs and module
placement in the shared spec. Parse/validate at boundaries so internal code uses valid
types. Flag required unsafe operations and safety obligations. Resolve collisions with
existing types explicitly: refine, replace, wrap or escalate; do not shadow their ownership.

The designer stays read-only. The coordinator records the selected shape and rationale,
applies the shared maintainer assessment and fresh review, and stops for domain-design-only
requests. Authorized production work proceeds via `references/elephant-workflow.md` with
compile-fail doctests or trybuild for rejected transitions, runtime behavior tests, actual
consumer migration and the project gate. Independent API-GATE review and SAFETY-GATE when
unsafe is involved judge the delivered model. Report which illegal states became compile
errors and which remain runtime checks, with their evidence.
