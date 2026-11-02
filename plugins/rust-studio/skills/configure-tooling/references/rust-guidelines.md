# Rust guideline sources and adoption

Read this when adopting a codebase, selecting an engineering standard, or resolving a review
disagreement about idiomatic Rust. Sources were searched through Firecrawl and Keenable and
read on **2026-11-01**. These are upstream recommendations; the decisions below are Studio policy.

## Select the relevant source

| Source | Use it for | Scope and limits |
|---|---|---|
| [Rust Style Guide](https://doc.rust-lang.org/style-guide/) | Formatting and consistency | Use the repository's rustfmt configuration and supported toolchain. |
| [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/checklist.html) | Naming, conversions, traits, documentation, interoperability | A library checklist; select relevant items rather than requiring every trait on every type. |
| [Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html) | Ownership, call-site clarity, collection APIs, application versus library tradeoffs | Google policy includes explicitly labeled Chrome and Fuchsia rules. Their runtime and build restrictions are local. |
| [Microsoft Pragmatic Rust Guidelines](https://microsoft.github.io/rust-guidelines/) | Maintainable APIs and application design | Complements the API Guidelines; recommendations have maturity/version information and allow justified exceptions. |
| [ANSSI Secure Rust Guidelines](https://anssi-fr.github.io/rust-guide/print.html) | Security-sensitive development, unsafe boundaries, FFI and resource management | The online guide labels itself unstable. Its stricter secure-development profile is not a language soundness definition. |
| [Rust Design Patterns](https://rust-unofficial.github.io/patterns/intro.html) | Idioms, patterns and anti-patterns | Community-maintained design examples, not an official Rust language specification. |
| [Rustonomicon](https://doc.rust-lang.org/nomicon/) | Unsafe invariants and ownership | The book warns that it is incomplete; use the Reference for conflicting language claims. |
| [Cargo SemVer Compatibility](https://doc.rust-lang.org/cargo/reference/semver.html) | Public API compatibility and release planning | Check both signature changes and downstream construction, matching and trait implementations. |

For async lock policy, [Tokio's Mutex documentation](https://docs.rs/tokio/1.54.1/tokio/sync/struct.Mutex.html)
distinguishes blocking guards from async guards designed to span `.await`. Studio's async
agents follow that distinction and review scope, cancellation and lock order instead of
reporting every await-held async mutex as a defect.

## Resolve conflicts before applying a rule

Honor the task and repository's explicit contracts, supported MSRV, formatter and merge gate.
For language safety, use the language contract; for a team's style choice, record the chosen
profile and its scope. External recommendations fill gaps rather than silently replacing local
policy. A style preference becomes a blocking finding only when a binding project rule or a
concrete maintenance/correctness consequence supports it.

Distinguish an externally consumed library from application code with known callers. Record
the applicable source, affected crates, accepted exceptions and the reason in the adoption
profile or API design. Read the relevant section when a decision depends on it; importing a
whole guide into every prompt adds conflicting rules and obscures the actual contract.

## Decisions carried into Studio rules

- **Borrow and return according to use.** Borrow the underlying data when sufficient. Returning
  a borrow or iterator can avoid allocation; return an owned collection when ownership or random
  access is required. `core.md` and `api.md` replace the blanket owned-return preference.
- **Generics need callers.** `Into`, `AsRef` and `IntoIterator` help reusable boundaries when
  actual callers benefit. Prefer a concrete parameter for application code when it is sufficient.
  Weigh inference, monomorphization and the public contract. This follows Google's distinction
  between library and application APIs without imposing its application-wide `Into` restriction.
- **Choose readable control flow.** Short iterator chains and direct loops both have a place;
  use a loop when mutation, branching or error handling is clearer. `core.md` no longer demands
  combinators regardless of readability.
- **Shared ownership is a design choice.** Start with unique ownership and borrowing; `Rc`/`Arc`
  are appropriate when ownership is shared. A reference-count increment is not a deep copy.
  Review lifetime, cycles and synchronization rather than treating every clone as a defect.
- **Evolvability costs compatibility.** `#[non_exhaustive]` helps an API intended to grow, but
  applying it to an existing constructible public struct breaks downstream construction. Exhaustive
  workspace state machines can benefit from compiler-enforced matching. `api.md` keeps that choice
  explicit, with consumer tests and SemVer checks before changing an existing surface.
- **Run the project's gate.** Formatting comes from rustfmt; lint/test flags come from the real
  project gate. An arbitrary `--all-features` run cannot substitute for default-feature checks.

## Recommendations kept contextual

- Google's Chrome restrictions on async and standard-library thread creation, and Fuchsia's
  mutex choice, apply to those environments. Studio supports other runtimes.
- Google's import/module layout and Microsoft's abbreviation preferences can disagree with
  local conventions. Preserve a consistent repository vocabulary; avoid cosmetic migrations.
- ANSSI's resource-leak restrictions can be a security requirement, but safe Rust permits leaked
  values. Unsafe code must remain sound even when destructors do not run.
- Adding traits, builders, logging dependencies or generic interfaces solely to satisfy a
  checklist can enlarge the contract. Add them for a real semantic or consumer need.

## Review evidence

For a disputed finding, identify the local contract, cite the relevant upstream section, show
the affected caller or invariant, and state the smallest justified change. For an intentional
exception, record why the guideline's underlying goal is still met. Keep language correctness,
project requirements and advisory style findings distinguishable.
