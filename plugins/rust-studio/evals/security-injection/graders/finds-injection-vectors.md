---
type: llm
weight: 3
---
The response is a security review and must report all three vulnerabilities, anchored to (or within two lines of) the stated line:
1. Line 8: `name` interpolated into `sh -c` is command injection (arbitrary command execution); the fix avoids the shell, passes explicit arguments, and validates `name` against an allowlist.
2. Line 14: `format!`-built SQL with `name` is SQL injection; the fix uses a parameterized / bound query.
3. Line 20-21: `read_to_end` on attacker-controlled input has no size cap (memory-exhaustion denial of service); the fix bounds the read (`take(MAX)`) and rejects oversize bodies.
Full credit: all three with the right severity ordering (the two injections above the DoS) and a concrete fix each. Partial: two. Fail: one or none, or a fix that keeps the shell / string-built SQL.
