---
name: macros
paths: "**/*-macros/src/**,**/*_macros/src/**,**/macros/**,**/src/macros*.rs,**/proc-macro*/src/**"
description: macro_rules! and proc-macro hygiene, choice, and testing standards
---

# Macro Standards

Applies to declarative macros, proc-macro crates, and any module that defines macros.
Owned by `macro-specialist`. (General `lib.rs` public surface is owned by `api.md`; this
file is about macros only.)

## Reach for a macro last
- Most "I need a macro" moments are solved by a function, a generic, a trait, or a `const`.
  A macro is justified only when the code is variadic, needs to capture syntax (not values),
  or must generate items the type system can't abstract over. "Saves a few keystrokes" is
  not a reason.
- Prefer making the wrong call *unwriteable* (types, visibility) over a macro that hides it.

## Choose the right kind
- `macro_rules!` for pattern-directed rewriting — small DSLs, variadic helpers, and
  `matches!`-style shorthands. It is hygienic, fast, local, and needs no extra crate.
- Proc-macros (derive / attribute / function-like) for type-directed code generation —
  serde-style derives, schema or builder generation — where the macro must inspect a type
  and emit code from it. They are heavier, live in a separate `proc-macro` crate, and are
  warranted only when `macro_rules!` genuinely can't express the transform.
- Don't pull in a proc-macro crate (and its `syn`/`quote` build cost) for something a
  declarative macro or a `derive` from the standard library / an existing crate already does.

## Hygiene
- `macro_rules!` hygiene is per-identifier-kind: it stops a macro from capturing the caller's
  *local bindings*, but it does **not** protect *items* (types, functions, consts) the macro
  names. A macro that introduces a local should use an unlikely name (or document the one it
  reserves) so it can't shadow or be shadowed at the call site.
- Always verify what a macro actually expands to with `cargo expand` before trusting it —
  hygiene bugs, double-evaluation of arguments, and missing parentheses around `$e:expr` are
  invisible in the source and obvious in the expansion.
- Wrap each macro argument that is used more than once (`$e:expr`) so a caller's side-effecting
  expression isn't evaluated twice; parenthesize expansions to keep operator precedence intact.

## Cross-crate macros
- Inside a `macro_rules!` that is `#[macro_export]`ed, refer to the defining crate's own items
  through `$crate::path::item` — never hardcode the crate name. `$crate` resolves correctly
  no matter what the downstream crate renamed the dependency to or how it's imported.
- Reference external paths by their full path too, so the macro doesn't depend on what the
  call site happens to have in scope.

## Parsing and interpreters
- A tiny DSL embedded in Rust is fine as a `macro_rules!` interpreter — zero runtime cost.
- For a real grammar (config formats, query languages, anything with recursion or precedence),
  use a parser crate — `nom`, `winnow`, `chumsky`, `pest`, or `logos` for lexing — instead of
  growing an unmaintainable macro or a hand-rolled parser. Hand-roll a recursive-descent parser
  only for teaching or a hard zero-dependency constraint.

## Testing
- Test a macro's *expansion behavior* with ordinary unit tests, and its *error messages* and
  compile-fail cases with `trybuild` — a macro's diagnostics are part of its contract, so pin
  them. Cover hygiene (callers with shadowing locals), double-evaluation, and the failure
  paths that should produce a clear compile error.
- A non-trivial macro change gets `macro-specialist` sign-off before it ships.
