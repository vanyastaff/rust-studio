# Implementation discipline

Use for authorized source/configuration/test/document edits and compiler repair. Read
`references/maintainer-grade-development.md`,
`references/project-gate.md` and each applicable injected path-rule pointer
before shaping edits. For disputed Rust guidance use `references/rust-guidelines.md`.

Establish acceptance criteria, owning modules, real consumers and the pre-code verdict.
Reshape weak touched code within scope before adding behavior; unrelated discoveries become
reported follow-ups. Complete consumer migration and obsolete-path removal required by the
contract. Choose borrows/ownership/iterators/Cow/Bytes/scratch buffers before clone/box/collect
workarounds, and encode invariants in types rather than caller discipline.

For a behavior fix, obtain the public-path failing reproducer before changing production.
Use focused edits and read diagnostics between affected steps. Tests follow the behavioral
contract and neighboring harness scale; throwaway exploratory checks need not become permanent
test files. Test-only work does not authorize production fixes.

For compiler repair, capture the exact failing feature/target configuration and first root
diagnostic, then recompile after correcting its cause. Borrow/lifetime failures require the
right ownership and scopes, not arbitrary shared ownership or 'static escapes. Trait/type
failures require correct bounds and checked conversions, not Any/transmute/lint suppression.
Verify installed dependency versions and docs before changing features/APIs. A required
behavior/API change exceeds compiler-only repair and must return to the authorized contract.

Run the project gate with its precise wrappers/environment/features; extra checks supplement
it. With no project gate, use relevant nextest/cargo test, doc-tests, clippy and fmt checks.
Retain red evidence, exact commands, final outputs and unresolved gaps. Supply the patch and
evidence for independent review; producing the implementation does not sign its own gates.
