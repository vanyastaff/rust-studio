# Ground truth — modern-rust/stale-idiom (verdict: REDO-TO-BAR, or NEEDS WORK with compile evidence)

Pre-2021 idioms a current-edition maintainer rejects; the fix requires checking the
current std (C4 freshness), not coding from stale memory.

> Verdict note: on edition 2024 the `static mut` shared reference in GT-1 is a
> deny-by-default **hard error** (`static_mut_refs`), so the file no longer compiles
> there. Protocol §5 defines REDO-TO-BAR as compiles-but-wrong-shape; an agent that
> proves the compile failure with rustc output and returns **NEEDS WORK** is therefore
> also a pass — provided GT-1/GT-2/GT-3 are all still flagged with the modern reshape
> named. Waving any row through because "it's how it was written" remains the miss.

| id   | line | type         | severity | defect |
|------|------|--------------|----------|--------|
| GT-1 | 6,9  | UNSAFE-STALE | 🟣 | `Once` + `static mut CONFIG` + `unsafe` is the pre-`OnceLock` pattern. Use `std::sync::OnceLock` (or `LazyLock`) — safe, no `unsafe`, no `static mut`. |
| GT-2 | 21   | STALE-IDIOM  | 🟠 | `match opt { Some(x) => x, None => return 0 }` should be `let Some(&id) = items.first() else { return 0 };` (let-else). |
| GT-3 | 33   | BUSYWORK     | 🟠 | `.map(\|x\| x.clone()).map(\|x\| x).collect()` — the identity `map` is dead, and the clone is needless if a borrowed iterator suffices. |

Pass = the agent returns **REDO-TO-BAR** AND signals it should verify the current std
(OnceLock/LazyLock stability) before choosing — modernize GT-1/GT-2/GT-3. Using the
stale pattern because it compiles is the miss.
