---
name: types
paths: "**/src/domain/**/*.rs,**/src/model*.rs,**/src/protocol*.rs,**/src/types.rs,**/src/parser*.rs,**/src/parser/**/*.rs,**/src/parsers/**/*.rs,**/src/config*.rs,**/src/error*.rs"
description: Type-system, lifetime, and structural invariant standards
---

# Type-System Standards

Applies to domain models, protocols, parsers, config, and error types.

## Encode intent in types
- Prefer newtypes, enums, typestate, sealed traits, smart constructors, and private fields
  over bool flags, stringly protocols, unstructured `Option`, or caller discipline.
- Parse once into a stronger type; downstream code should receive valid data, not repeat
  validation checks.
- **A validator that returns `Result<(), E>` is a remember-to-call-me contract.** Nothing links
  the check to the value it guards, so the guarded path stays reachable when a caller writes
  `let _ = validate(x);`, forgets the `?`, or reaches a `pub` unchecked helper — and the default
  clippy gate does not see any of it (`let_underscore_must_use` is restriction-tier;
  see cargo-manifest.md). Return the proof instead: `fn checked(raw: &[u8]) -> Result<Checked<'_>, E>`,
  and have the consumer take `Checked`. The unchecked path then does not typecheck rather than
  relying on discipline. An eval on a 14-file crate produced exactly this: three independent
  entry points each lost the check a different way, all downstream of one bare-`Result` validator.
- A witness / typestate proof (`Validated<T>`, a `*Checked` newtype with a private field) must
  bind to *what* it proves. If it was checked against external state (a registry, schema version,
  config), record that binding (version/epoch/snapshot) or scope its lifetime to that state —
  otherwise the proof goes stale when the state drifts (TOCTOU) and the type asserts a fact that
  is no longer true. "Structurally valid at some past instant" is not "valid now."
- Builders are for genuinely complex construction or staged invariants, not as a reflex.

## Design-drift tells
Greenfield modelling (above) asks what the domain needs. These tells ask whether a model that
already shipped still fits — the code compiles, clippy is clean, tests pass, and the model is
still wrong. They are the concrete shapes behind the Cheat Catalog's "Extend over reshape"
(`${CLAUDE_PLUGIN_ROOT}/docs/integrity-and-evidence.md`) and the question the Accretion check
asks: has this become all exceptions and no rule? **These are reading tells, not lints** — no
clippy rule fires on any of them, which is exactly why they need naming instead of waiting for a
linter that will never catch them. Finding one on a touched model is the trigger to open
`/model-domain`'s re-modelling mode rather than bolt on one more case.

- **A `String`/`u8`/`i32`/`&str` field whose observed value set has closed.** It started open (a
  label, a code from outside the crate) and every call site now constructs it from a fixed, known
  list. The model still says "any string"; the domain says "one of these six." Cut an enum.
- **Two or more `bool` parameters, or one `bool` that selects behaviour rather than states a fact
  about the input.** `fn render(&self, bool, bool)` is two unreadable `true`s at the call site; a
  `bool` that branches into two different code paths inside the function is two functions wearing
  one name. Split into a typed state the caller must name, or two functions.
- **An enum variant carrying `Option<T>` fields that are only ever `Some` for some variants.** The
  variant tag already says which fields make sense; the `Option` re-does that tagging by
  convention instead of by type, and every match arm has to know which combinations are real.
  Split the variants that need the extra fields into their own type.
- **`Option<Option<T>>` anywhere.** Sometimes deliberate — a PATCH-style "absent /
  present-as-null / present-with-value" protocol — but left as raw nested `Option` it reads
  identically to an accident, because both start the same way: an already-`Option` field gets
  wrapped in another `Option` to add a third state. Name it either way: collapse it back to one
  layer if the outer wrap was drift, or give the three states their own enum
  (`Missing`/`Null`/`Value(T)`) if it's intentional, so a reader isn't left guessing which layer
  is the bug.
- **A `match` that grew a `_ => unreachable!()` / `_ => panic!()` arm covering cases that are now
  real.** The wildcard was true when it was written; a variant landed since, and the match still
  compiles because the wildcard silently absorbed it. Drop the wildcard so the compiler forces
  every call site to handle the new case explicitly.
- **A struct whose fields are only valid in certain combinations** (a `connected: bool` next to
  fields that only mean something once connected, a `retry_count` that only means something after
  a first failure). The struct can be constructed in states the domain doesn't allow. Move the
  state-dependent fields behind typestate, or split into the types the combinations actually are.
- **Parameters that always travel together at every call site.** If two or three parameters never
  vary independently across the callers you can see, they are one struct wearing separate names —
  bundle them so the type system, not caller discipline, keeps them together.
- **Two or more `Vec`/slice/map fields kept in lockstep by index or key** (`names[i]` always
  paired with `scores[i]`), updated and checked together at every call site. The correlation is a
  domain fact the compiler isn't holding; collapse to one collection of a struct
  (`Vec<Entry { name, score }>`) so the pairing can't drift apart at a partial update.
- **The third `impl` of the same method shape across different types.** Two independent
  same-shaped impls can be coincidence; the third is a pattern the type system isn't tracking yet.
  Extract a trait so the shared contract is named once and callers can be generic (or `dyn`) over
  it instead of matching on which concrete type they were handed.
- **A `Box<dyn Trait>` (or a generic `T: Trait`) whose implementors are all local and fully
  enumerable**, chosen back when the set was expected to stay open. If nothing outside the crate
  has implemented it and nothing plausibly will, the open-set cost — vtable indirection, no
  exhaustiveness checking, auto traits to spell out by hand (dyn-compatibility, above) — is being
  paid for a set that closed. Collapse to an enum with `match` dispatch; reopen with a trait only
  when a real external implementor shows up.
- **`#[allow(clippy::too_many_arguments)]`.** The lint fired on the parameter *count*; the defect
  is the shape underneath it. Silencing the lint without asking why the function grew that many
  parameters is "Extend over reshape" in miniature — it passes the check and leaves the model
  worse than it found it.

## Borrowing before allocation
- Do not hide lifetime or ownership problems with needless `clone`, `to_owned`, `collect`,
  boxing, or `String` conversion.
- First consider borrowing, iterator shape, `Cow`, slices, ownership transfer, or changing
  the API boundary.
- Put generic bounds on functions/impls unless the struct layout truly needs the bound.

## Dispatch shape
- Prefer concrete generics, associated types, GATs, `impl Trait`, and AFIT/RPITIT when they
  express the contract without runtime cost.
- Use trait objects, `async-trait`, boxing, or type erasure only when object safety,
  heterogeneity, or dynamic loading is a real requirement.

## Variance
- Subtyping in Rust is only about lifetimes (`'long` outlives `'short`). Know the variance of a
  type parameter before you build an abstraction over it; getting it wrong is a soundness bug.
- Invariant in `T`: `&mut T`, `*mut T`, `Cell<T>`, `RefCell<T>`, `UnsafeCell<T>`, `Mutex<T>`.
- Covariant in `T`: `&T`, `Box<T>`, `Vec<T>`, `Rc<T>`, `Arc<T>`, `NonNull<T>`, `PhantomData<T>`.
- `fn(T) -> U` is contravariant in `T`, covariant in `U`.
- A struct inherits variance from its fields. A parameter that appears in positions of differing
  variance becomes invariant overall.

## Phantom parameters
- A generic parameter that appears in no field is rejected. Record the intended variance and
  drop-check semantics with `PhantomData`, choosing the marker deliberately:
  - `PhantomData<T>` — "owns a `T`", covariant, participates in drop-check.
  - `PhantomData<&'a T>` — phantom lifetime, covariant in `'a` and `T`.
  - `PhantomData<fn(T) -> T>` — forces invariance.
  - `PhantomData<*const T>` — opts out of `Send` and `Sync`.
- A custom owning collection or smart pointer over `NonNull<T>` still needs `PhantomData<T>`:
  `NonNull` is covariant but carries no drop-check knowledge, so without it the drop checker may
  let dangling references survive into your `Drop`.

## dyn-compatibility
- A generic method makes a trait non-`dyn`-usable unless it carries `where Self: Sized`; tag the
  few generic methods that way to keep the rest of the trait object-usable.
- `async fn` in traits is not `dyn`-compatible by default. Prefer static dispatch (`impl Trait`);
  when a trait object is genuinely required, use a `trait-variant`/`dynosaur` shim or a manual
  parallel method returning `Pin<Box<dyn Future<Output = _> + Send + 'a>>`.
- Auto traits do not inherit onto `dyn`: spell out `dyn Trait + Send + Sync` (and `Unpin`,
  `UnwindSafe`, etc.) explicitly when you need them.
- Mind `dyn` lifetime defaults: `&'a dyn Trait` defaults to `+ 'a`, but `Box<dyn Trait>` and
  `Arc<dyn Trait>` default to `+ 'static`. Write `Box<dyn Trait + 'a>` when the default is wrong.

## Coherence
- Respect the orphan rule: either the trait or the type must be local. To `impl` a foreign trait
  on a foreign type, newtype-wrap it and implement on the wrapper.
- Every generic parameter in an `impl` must be constrained — by appearing in the `Self` type or
  through an associated type of a bound on another parameter. Unconstrained parameters are
  rejected.

## Sized, ?Sized, and DSTs
- `Sized` is an implicit bound on every generic parameter. DSTs (`str`, `[T]`, `dyn Trait`) exist
  only behind a pointer (`&`, `&mut`, `Box`, `Rc`, `Arc`, `Pin<P>`); you cannot place one in a
  local or pass it by value.
- Take `T: ?Sized` in traits and functions that should accept DSTs, rather than forcing `Sized`.
- `T: 'static` means "holds no non-`'static` references", not "lives forever" — do not confuse it
  with `&'static T`.

## Controlled growth
- Use `#[non_exhaustive]` on public enums/structs that may grow, so cross-crate code must use a
  wildcard arm or `..` and cannot exhaustively destructure. Conversely, do **not** put it on an
  internal enum the workspace must match exhaustively (a state machine a sibling crate
  transitions): the forced `_` arm hides new variants the consumer should be made to handle.
- For within-crate discipline only, a private marker field (`_priv: ()`) blocks outside literal
  construction without the cross-crate semantics of `#[non_exhaustive]`.

## Structural decomposition
- Split a struct when methods contend on disjoint fields: the borrow checker tracks fields
  independently within a method but not across methods, so unrelated fields sharing one `&mut self`
  serialize needlessly. If the split does not map to a domain concept, the design is the real
  problem — fix the architecture.
- When bounds grow into a long chain (`F: FnMut() -> Result<T, E>, T: Display, …`), introduce a
  custom trait with a blanket impl to collapse the chain behind one named bound.
