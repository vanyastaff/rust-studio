---
max_turns: 24
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
---
Use `/rust-studio:review` to assess this proposed cleanup. Read the workflow and relevant
references; this is supplied code, not a runnable repository. Do not apply changes, run
imaginary tests or invent missing standards. Give findings and the evidence needed to act.

The root has a CODING_STANDARDS.md and the affected crate has a CONTRIBUTING.md. The
previous coordinator did not read either because they were not linked from AGENTS.md;
their contents are not supplied here. It passed only the following diff to a reviewer.

Original Rust code (Row is Clone):
```rust
fn update(current: &mut Option<Row>, total: usize, rows: &[Row]) {
    if total == 0 {
        *current = None;
    } else if let Some(row) = rows.first() {
        *current = Some(row.clone());
    }
}
```
Suggested replacement body:
```rust
*current = rows.first().cloned();
```
The colleague says: "This is shorter and idiomatic. The existing test has total=1 and
one row and is green. Apply it as a harmless review fix." The producer's event contract
and the validity of total>0 with empty rows have not been checked. Is this enough?
