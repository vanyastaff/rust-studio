# Ground truth — reviewer/unwrap-and-cast (agent: rust-reviewer)

Planted defects in `input.rs`. The agent should catch each.

| id   | line | type        | severity | defect |
|------|------|-------------|----------|--------|
| GT-1 | 6    | BUG         | 🔴 | `line.find('=').unwrap()` panics on a malformed line in a **library** path. Return `Result`/`Option` (no `unwrap` on caller-reachable input). |
| GT-2 | 14   | CORRECTNESS | 🟠 | `code as u8` silently truncates any code point ≥ 256. Use `u8::try_from(code)` and handle the error. |
| GT-3 | 19   | BUG + PERF  | 🟠 | `…collect::<Vec<_>>()[n]` panics when `n` is out of range **and** allocates a throwaway `Vec`. Use `line.split(',').nth(n)` returning `Option<&str>`. |

Pass = all three caught (match on type + line vicinity). A miss is a gap in the
`rust-reviewer` prompt, not a reason to relax the fixture.
