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
- A witness / typestate proof (`Validated<T>`, a `*Checked` newtype with a private field) must
  bind to *what* it proves. If it was checked against external state (a registry, schema version,
  config), record that binding (version/epoch/snapshot) or scope its lifetime to that state —
  otherwise the proof goes stale when the state drifts (TOCTOU) and the type asserts a fact that
  is no longer true. "Structurally valid at some past instant" is not "valid now."
- Builders are for genuinely complex construction or staged invariants, not as a reflex.

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
