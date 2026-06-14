# Ground truth — perf/needless-alloc (agent: perf-engineer)

Planted defects in `input.rs`. A hot path (`sum_labels`, per-event) with avoidable allocation.

| id   | line | type             | severity | defect |
|------|------|------------------|----------|--------|
| GT-1 | 5    | PERF (alloc)     | 🟠 | `e.labels.clone()` clones the whole `Vec<String>` every iteration — borrow it (`&e.labels`) instead; no allocation needed. |
| GT-2 | 6    | PERF (alloc)     | 🟡 | `Vec::new()` then `push` in a loop reallocates as it grows; reuse a scratch buffer across iterations or `Vec::with_capacity`. |
| GT-3 | 8–9  | PERF / COMPLEXITY | 🟠 | `seen.contains(l)` inside the loop is **O(n²)** and `l.clone()` allocates each kept label — use a `HashSet<&str>` for O(1) dedup with borrowed keys. |

Pass = all three caught (the agent must also propose measuring before/after with criterion).
