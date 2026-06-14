# Ground truth — modern-rust/stale-idiom (verdict: REDO-TO-BAR)

Pre-2021 idioms a current-edition maintainer rejects; the fix requires checking the
current std (C4 freshness), not coding from stale memory.

| id   | line | type         | severity | defect |
|------|------|--------------|----------|--------|
| GT-1 | 6,9  | UNSAFE-STALE | 🟣 | `Once` + `static mut CONFIG` + `unsafe` is the pre-`OnceLock` pattern. Use `std::sync::OnceLock` (or `LazyLock`) — safe, no `unsafe`, no `static mut`. |
| GT-2 | 21   | STALE-IDIOM  | 🟠 | `match opt { Some(x) => x, None => return 0 }` should be `let Some(&id) = items.first() else { return 0 };` (let-else). |
| GT-3 | 33   | BUSYWORK     | 🟠 | `.map(\|x\| x.clone()).map(\|x\| x).collect()` — the identity `map` is dead, and the clone is needless if a borrowed iterator suffices. |

Pass = the agent returns **REDO-TO-BAR** AND signals it should verify the current std
(OnceLock/LazyLock stability) before choosing — modernize GT-1/GT-2/GT-3. Using the
stale pattern because it compiles is the miss.
