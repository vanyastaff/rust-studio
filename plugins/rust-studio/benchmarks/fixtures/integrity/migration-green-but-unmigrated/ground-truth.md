# Ground truth — integrity/migration-green-but-unmigrated (agent: `rust-reviewer`)

An edition migration whose evidence is entirely green: the workspace builds, clippy is clean,
and the test count is identical before and after (41 → 41). The migration nonetheless did not
happen. This is the **gamed green** applied to a mechanical tool: `cargo fix` is asked to keep
today's behaviour, so a clean run is consistent with nothing having migrated at all
(`docs/integrity-and-evidence.md`, `/migrate` §Phase C).

Reproduced on rustc 1.98.0 before this fixture was written; each row is observed, not predicted.

| id   | line  | type | severity | defect |
|------|-------|------|----------|--------|
| GT-1 | 36–42 | UNMIGRATED SEMANTICS | 🔴 | The `match … { Some(v) => {…} _ => {…} }` with a braced arm block is not hand-written code — it is what `cargo fix` emits when it neutralizes `if-let-rescope`. The `Span` temporary keeps its **2021** scope (dropped after the arm, so the audit log reads `["fallback", "span"]`), while a hand-migrated `if let … else` on 2024 drops it first (`["span", "fallback"]`). The crate declares edition 2024 and behaves as 2021. Keeping the old order is a legitimate decision — but it must be a recorded one, and here nothing records it. |
| GT-2 | 44–48 | UNMIGRATED CODE | 🟠 | `gen` is a reserved keyword in 2024, so `pub fn gen()` cannot compile on this edition — it is invisible only because the module is `#[cfg(feature = "extra")]` and the migration ran without `--all-features`. The green build proves nothing about it; the failure lands on whoever first enables the feature. `#[cfg(feature = "extra")] pub mod extra;` is a second unchecked surface for the same reason. |
| GT-3 | 5–6   | MSRV NOT RAISED | 🟠 | `edition = "2024"` requires Rust ≥ 1.85, but `rust-version = "1.78"` is still declared. The manifest now promises an MSRV the crate cannot honour — for a published crate that is a semver-relevant breaking change that was absorbed rather than surfaced. |

Pass = GT-1 and GT-2 caught. GT-3 is the discriminator between a good review and a strong one.

**Automatic fail**, whatever else was found, if the response treats the green build, the clean
clippy run, or the unchanged test count as evidence that the migration is correct. The test
count being identical is precisely what an unmigrated crate looks like.

A miss is a gap in the agent's prompt, not a reason to soften this file.
