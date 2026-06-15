# Ground truth — api/bool-and-stringly-types (verdict: RESHAPE NEEDED)

> Mapped agent is `api-design-lead` (a pre-code lead), whose reject token is
> **RESHAPE NEEDED**. `REDO-TO-BAR` is the `rust-reviewer` equivalent — accept either as
> "rejected the shape".

Public API encoding decisions as bool flags and stringly params. Make illegal states
unrepresentable; parse, don't validate.

| id   | line | type          | severity | defect |
|------|------|---------------|----------|--------|
| GT-1 | 6    | BOOL-FLAGS    | 🟣 | `connect(_, secure: bool, verify_cert: bool, _)` — two adjacent bools are indistinguishable at the call site and admit a nonsensical `secure=false, verify_cert=true`. Replace with a `TlsPolicy` enum. |
| GT-2 | 6    | STRINGLY      | 🟣 | `mode: &str` ("ro"/"rw"/"admin") is a closed set as a string, validated nowhere. Use a `Mode` enum. |
| GT-3 | 16   | ILLEGAL-STATE | 🟠 | `apply(level: &str, force: bool, dry_run: bool)` — `level` should be an enum, and `force && dry_run` is a representable illegal combination; model the choice as one enum so it cannot occur. |

Pass = the agent returns a reject verdict (**RESHAPE NEEDED**, or REDO-TO-BAR from a
reviewer): replace bool flags and stringly params with domain enums/newtypes so the call
sites read clearly and illegal combinations cannot be constructed. Accepting the signature
because it compiles is the miss.
