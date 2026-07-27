---
name: prototype
description: "Use when a Rust design question needs running code to settle — an API shape, a state machine, a lifetime or trait doubt."
---

# /prototype — throwaway code that answers a question

A prototype is **throwaway code that answers one question**. It exists to settle a doubt
that argument cannot, and it dies once the answer is known. The question decides the shape.

## When NOT this skill
- Weighing approaches you can settle by reasoning → `/brainstorm`.
- Committing to a public surface you already believe in → `/design-api`.
- Code meant to survive → `/dev-task`.

Reach for `/prototype` when someone is about to build on an assumption nobody has run.

## The studio bar does not apply here
This is the one place the maintainer bar is suspended, and saying so is the point:
`unwrap()`, `clone()` everywhere, `todo!()`, one giant `main`, zero docs and zero tests are
all correct in a prototype. Polish spends time on code you are about to delete.

Two rules replace the bar, and they are absolute: the prototype is **named as one** so no
reader mistakes it for production, and it **never reaches a release branch**.

## Pick the branch
Name the question first, from the prompt or the surrounding code:

- **"Is this API usable?"** → write the **call site first**, in `examples/<name>.rs`, as a
  caller would write it. Let `cargo check` answer. The compiler is the feedback loop here:
  fighting your own signature at the call site, needing a turbofish everywhere, or hitting a
  lifetime you cannot name is the answer — the shape is wrong.
- **"Does this state machine behave?"** → a tiny binary that drives the transitions through
  the cases that are hard to hold on paper, printing the whole state after each step.
- **"Will the type system carry this?"** → the smallest crate that compiles the trait, GAT,
  or typestate in isolation. A scratch crate under `$TMPDIR` keeps it out of the workspace
  entirely when the doubt is about the type, not the codebase.

If the question is genuinely ambiguous and the user is unreachable, take the branch matching
the surrounding code and state the assumption at the top of the file.

## Rules
1. **One command to run.** `cargo run --example <name>` for a workspace prototype; a single
   `cargo run` for a scratch crate. The user starts it without thinking.
2. **Marked as throwaway.** A `//! PROTOTYPE — answers: <question>. Delete once settled.`
   header on the file, and a name that reads as a prototype.
3. **No persistence.** State lives in memory. If the question genuinely involves a database,
   use a scratch file or an in-memory backend named so nobody mistakes it for a fixture.
4. **Surface the state.** Print or `dbg!` the full relevant state after every step, so the
   user watches the thing they are judging rather than inferring it.
5. **Keep dependencies borrowed, not added.** Prototype against what the workspace already
   pulls in. A prototype is not grounds for a new dependency — if it proves one is needed,
   that goes through `/add-dep` on the real change.

## Capture, then delete
The answer is the deliverable; the code is scaffolding.

1. State the **verdict** — the question, what running it showed, and the decision it settles.
2. Fold the validated decision into the real work (`/design-api`, `/spec`, or `/dev-task`).
3. A verdict that cost real effort is a durable learning: run `/remember`
   (`references/memory-protocol.md`). Record an `/adr` when the decision is hard to reverse.
4. **Delete the prototype**, or move it to a clearly-marked scratch location the release
   never ships. Say which you did.

## Output
```
QUESTION: <the doubt this settled>.
RAN:      <the one command>.
SHOWED:   <what running it demonstrated — the compiler error, the state trace, the verdict>.
DECIDES:  <the design decision, and where it now lives>.
CODE:     <deleted | moved to <path>>.
```
End with **SETTLED** (question answered, code disposed of) or **INCONCLUSIVE** (say what the
prototype could not reach and what would settle it).
