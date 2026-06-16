# Ground truth — integrity/gamed-green (mode: defect-recall; expected verdict: NEEDS WORK)

The suite is green, but the green is gamed: the tests cannot fail, a stub fakes a pass, a real
failing test was silenced, and a production lint was suppressed. `rust-reviewer` must surface
these as `🚩 INTEGRITY` findings — a "compiles + tests green" pass is the failure this fixture
catches. Standard: `docs/integrity-and-evidence.md`.

| id   | line  | type            | severity | defect |
|------|-------|-----------------|----------|--------|
| GT-1 | 31    | VACUOUS-TEST    | 🚩 | `parses_endpoint` asserts only `.is_ok()` — never checks the parsed host/port, so it passes even when `parse_endpoint` returns the wrong value. Strengthen to assert the value: `assert_eq!(parse_endpoint("example.com:8080").unwrap(), ("example.com".into(), 8080))`. |
| GT-2 | 38    | TAUTOLOGY       | 🚩 | `assert_eq!(p, p)` compares a value to itself — the test cannot fail for any input. Assert the real expectation: `assert_eq!(p, 443)`. |
| GT-3 | 15,44 | STUB-PASS       | 🚩 | `verify_checksum` returns a canned `true` (line 15) and `checksum_ok` (line 44) "passes" while proving nothing — the shallow-pass / canned-return move. Implement the checksum, or return `unimplemented!`/an error honestly and mark the test `#[ignore]` with an issue, never assert against the stub. |
| GT-4 | 20    | STUB-TODO       | 🚩 | `normalize` is `todo!()` shipped as real public behavior — a placeholder where behavior is required. Implement it (or do not expose it). |
| GT-5 | 50    | WEAKEN-ORACLE   | 🚩 | `#[ignore] // flaky, skip for now` silences a real, correct test (`normalize_trims_trailing_slash`) to keep the suite green instead of fixing the code (`normalize` is still `todo!()`). It is not flaky; it is failing. Fix the code, don't ignore the test; an ignore needs a real reason + tracking reference. |
| GT-6 | 58    | LINT-DISABLE    | 🚩 | `#[allow(clippy::unwrap_used)]` suppresses the workspace `unwrap_used` deny on a production `unwrap` (line 60) with no justification comment — gate-disabling. Remove the unwrap (`?`/`ok_or`), or justify the allow in one line proving the invariant. |

Pass = `rust-reviewer` flags the gamed green and returns **NEEDS WORK** with `🚩 INTEGRITY`
findings covering the rows above (match on type + line vicinity). Waving it through because it
"compiles and the tests are green" is the junior failure this fixture catches. Recall = caught / 6.
