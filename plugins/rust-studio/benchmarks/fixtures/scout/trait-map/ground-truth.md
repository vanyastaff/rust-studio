# Ground truth — scout/trait-map (agent: `rust-scout`, mode: map-recall, verdict: COMPLETE)

> Audit prompt the fixture is calibrated for: *"Map the `Codec` trait in this crate: its definition, every implementor (including cfg-gated, macro-generated and test-only ones), every call site of `encode`/`decode` through the trait, and the tests that exercise it. Return the file:line table and note gaps."*

A locator task, not a review. The crate is small on purpose; the traps are the three
places a grep for `impl Codec for` does not find — a macro-stamped impl, a
feature-gated module, and a `#[cfg(test)]` impl — plus one decoy: `wire::Header` has
inherent `encode`/`decode` methods that are **not** the trait.

| id    | file:line | kind | row |
|-------|-----------|------|-----|
| GT-1  | `src/codec.rs:6` | DEFINITION | `pub trait Codec` with `name` (8), `encode` (11), `decode` (14). |
| GT-2  | `src/codec.rs:32` | IMPL (blanket) | `impl<T: Codec + ?Sized> Codec for Box<T>` — forwards all three methods. |
| GT-3  | `src/json.rs:9` | IMPL | `impl Codec for Json`. |
| GT-4  | `src/compact.rs:10` (via `:32`, `:33`) | IMPL (macro-generated) | `fixed_width_codec!` stamps `impl $crate::codec::Codec for $name`; the invocations at 32–33 produce **`Compact8`** and **`Compact16`**. Both type names must appear; citing only the macro body or only one invocation is a miss. |
| GT-5  | `src/cbor.rs:9` | IMPL (cfg-gated) | `impl Codec for Cbor`, compiled only under `#[cfg(feature = "cbor")]` (module gate at `src/lib.rs:13`). The gate must be named. |
| GT-6  | `src/codec.rs:49` | IMPL (test-only) | `impl Codec for Identity` inside `#[cfg(test)] mod tests`. |
| GT-7  | `src/registry.rs:25`, `:30` | CALLERS (dyn) | `Registry::encode_with` / `decode_with` dispatch through `&dyn Codec`; registrations at `:42`–`:44` (`Json`, `Compact8`, cfg-gated `Cbor`). |
| GT-8  | `src/pipeline.rs:9`, `:22`, `:27` | CALLERS (generic + dyn) | `frame` / `unframe` (static dispatch via `C: Codec`) and `survives` (`&dyn Codec`). |
| GT-9  | `tests/roundtrip.rs:10`, `:16`, `:22`, `:27`, `:35`, `:44`; `src/codec.rs:62` | TESTS | Integration tests per codec and for the registry; `cbor_roundtrips` (44) is feature-gated; the one unit test covers the `Box<T>` forwarding impl. |
| GT-10 | `src/wire.rs:13`, `:19` | NOT-AN-IMPL | `Header::encode` / `Header::decode` are inherent methods on an unrelated type. They must **not** be listed as implementors or trait call sites; mentioning them as an excluded decoy is fine. **Negative row: count it as caught when the response does not list `Header` as a `Codec` implementor or caller — silence is the correct answer.** |

Expected gap notes (any one suffices): `Compact16` is never registered in `default_registry`;
`Cbor` has no test unless the feature is on; `Registry::decode_with` has no test.

Pass = every row GT-1..GT-9 present with the right file and a line within two, GT-10 not
listed as an impl or caller, and a **COMPLETE** verdict (a map with a named gap is still
COMPLETE; **NEEDS WORK** only if the agent could not resolve a symbol). Automatic fail:
the agent proposes or applies a fix, edits a file, or reports `Header` as a `Codec`
implementor.
