# Macros and generated Rust

Use for declarative/procedural macros, derives, expansions and diagnostic contracts. Read
`references/macros.md`; load `api.md` when exports affect API-GATE.

- First compare a function, generic, trait, const or existing derive. Macros earn their cost
  for syntax capture, variadic structure or item generation. Prefer macro_rules for local
  pattern rewriting; use proc macros for syntax inspection beyond that facility. A proc macro
  sees tokens/syntax, not the compiler's resolved type information. Real recursive/precedence
  grammars need a parser rather than a growing macro interpreter.
- Preserve user spans with syn parsing and quote generation. Return syn::Error/compile_error
  diagnostics rather than panic; forward generics, where clauses and helper attributes,
  respecting non-exhaustive types and required trait coverage.
- Hygiene differs by identifier kind: local bindings are protected, named items are not.
  Use unlikely/documented generated names for readable expansions; treat plain local names
  as a convention finding, not a fictitious capture bug. Evaluate side-effecting expressions
  once, preserve precedence, and exercise repetition/token edge cases.
- `$crate::` locates defining-crate items across renaming; fully qualify external references
  so caller imports are irrelevant. Inspect cargo expand output and run the project lint gate
  on generated code.
- Pin intended errors and spans with trybuild. Cover shadowing, renamed dependencies,
  repeated evaluation, success expansions and every intentional diagnostic branch.

Report expansion excerpts, trybuild results and lint/test output as API-GATE evidence.
