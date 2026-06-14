# Ground truth — security/injection (agent: security-auditor)

Planted defects in `input.rs`. All three sit on an untrusted-input boundary.

| id   | line | type              | severity | defect |
|------|------|-------------------|----------|--------|
| GT-1 | 8    | COMMAND INJECTION | 🔴 | `name` is interpolated into `sh -c` → arbitrary command execution (`name = "x; rm -rf /"`). Don't use a shell; pass explicit args and validate `name` against an allowlist. |
| GT-2 | 14   | SQL INJECTION     | 🔴 | `format!`-built SQL with `name` → SQL injection. Use a parameterized/bound query (sqlx macro / diesel DSL). |
| GT-3 | 21   | DoS (unbounded)   | 🟠 | `read_to_end` on attacker-controlled input has no size cap → memory exhaustion. Bound with `reader.take(MAX)` and reject oversize. |

Pass = all three caught. A miss here is a security gap — fix the `security-auditor` prompt.
