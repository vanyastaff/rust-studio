# Ground truth — testing/flaky-and-vacuous (agent: `qa-lead`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"CI is green about nine runs in ten with no code changes. Review this test file — which tests are flaky, which cannot fail, and what does each need to become a real test? Then give a QA-GATE verdict."* The code under test is fine; every defect is in the tests and is one `rules/testing.md` names.

| id   | line   | type                    | severity | defect |
|------|--------|-------------------------|----------|--------|
| GT-1 | 13–16  | VACUOUS + UNNAMED       | 🟠 | `test1` asserts `is_some()` and never checks the value; the name says nothing. Assert `Some(1)` and name it for the behavior. |
| GT-2 | 25–29  | SLEEP AS SYNCHRONIZATION | 🔴 | `thread::sleep(200ms)` then assert the worker finished — the one-in-ten failure. Synchronize on a channel / `Notify` / join, never on wall-clock. |
| GT-3 | 10, 26, 34–36 | SHARED GLOBAL STATE + ORDERING DEPENDENCE | 🔴 | `PROCESSED` is a `static` shared between tests, and `counter_starts_where_the_other_test_left_it` **requires** another test to have run first. Tests run in any order and in parallel (nextest: separate processes, so this one always fails there). Scope state per test. |
| GT-4 | 41–43  | FIXED PORT              | 🟠 | Binding `127.0.0.1:9090` collides with any other test or process using it. Bind port 0 and read the assigned port. |
| GT-5 | 48–49  | REAL NETWORK            | 🔴 | A live HTTPS call to an external host in a unit test — fails offline, in CI sandboxes, and whenever the schema host is slow. Vendor the fixture or mock the transport behind a trait/feature. |
| GT-6 | 56–57  | TAUTOLOGY               | 🟠 | `assert_eq!(got, got)` cannot fail. Assert `Some(7)`. |
| GT-7 | 60–62  | SILENT `#[ignore]`      | 🟠 | The one test that actually checks FIFO order is ignored with no reason and no tracking issue — the denominator quietly shrinks. Un-ignore (it looks correct), or quarantine with a linked issue and a reason string. |
| GT-8 | 70–75  | WALL-CLOCK ASYNC SLEEP  | 🟠 | A 2.1 s real sleep to test a 2 s delay: slow and racy. `#[tokio::test(start_paused = true)]` + `tokio::time::advance`. |

Pass = GT-2, GT-3, GT-5 (the flake sources) plus GT-6 and GT-7 (the integrity defects) and a
`NEEDS WORK` verdict that does not clear QA-GATE. Reporting the suite as "mostly fine, just
retry the flaky ones" is the fail.
