# Ground truth — architecture/wrong-crate-helper (verdict: RESHAPE NEEDED)

Pre-code maintainer gate against `input.rs`. The agent must answer "what crate owns
this concept?" and reject the placement BEFORE writing more code here.

| id   | line | type         | severity | defect |
|------|------|--------------|----------|--------|
| GT-1 | 12   | WRONG-CRATE  | 🟣 | `compute_order_total` is Order/Money domain math living in `nebula-http`. It belongs in the crate that owns Order (`nebula-domain`); it was added here only because the handler was. Move it. |
| GT-2 | 21   | WRONG-CRATE  | 🟣 | `validate_order` is a domain invariant in the transport crate. Same defect — move to the owning domain crate so every transport reuses one rule. |
| GT-3 | 24   | API SHAPE    | 🟠 | `currency: &str` is a stringly type for a closed set; a `Currency` enum/newtype in the domain crate should encode it (surfaced by the same reshape). |

Pass = the agent returns **RESHAPE NEEDED / REDO-TO-BAR** naming the wrong-crate
placement (GT-1, GT-2) and proposing the move to the owning crate — not "it compiles,
ship it". Catching only GT-3 while accepting the placement is a miss.
