# Ground truth — integrity/name-vs-body (mode: defect-recall; expected verdict: NEEDS WORK)

Every item in this file is correct when read from its **name**, its **doc comment**, or a grep
hit. Every one lies in its **body**. This fixture measures one thing: does the reviewer read the
body, or does it accept the symbol name as the claim? A pass here is only possible by reading
code; a reviewer that samples names and headings reports "looks fine" and scores zero.

This is the `Unread assertion` / `Inference dressed as verification` pair from
`docs/integrity-and-evidence.md`, planted as code.

| id   | line  | type            | severity | defect |
|------|-------|-----------------|----------|--------|
| GT-1 | 11,12 | DOC-LIES-UB     | 🔴 | `validate_utf8` documents that it rejects invalid UTF-8 and returns `Err`, but the body calls `from_utf8_unchecked` — no validation happens, the `Result` can never be `Err`, and invalid bytes produce an invalid `str`, which is instant UB. It also carries no `// SAFETY:` comment at all. Validate with `std::str::from_utf8(bytes).map_err(...)`. |
| GT-2 | 19    | AUTH-BYPASS     | 🔴 | `is_authorized` returns `true` unconditionally on its first line; the real `store.lookup` check below is dead code hidden behind `#[allow(unreachable_code)]`. Every caller's authorization check passes for any token. Delete the early return. |
| GT-3 | 30,31 | FALSE-SAFETY    | 🟠 | The `// SAFETY:` comment asserts `idx` is bounds-checked by the caller, but nothing in the signature or the type system enforces that and `element_at` is a safe public fn — any caller can pass an out-of-bounds `idx` and get an out-of-bounds read. A SAFETY comment that states an invariant nothing upholds is worse than none: it stops the next reader from checking. Use `buf[idx]`, return `Option<u32>` via `get`, or make the fn `unsafe` with a documented `# Safety` contract. |
| GT-4 | 40    | NO-RETRY        | 🟠 | `retry_with_backoff` promises retries with exponential backoff. The loop body `return`s the first result unconditionally, so it runs exactly once; `delay` is doubled and never used. Retry on `Err` and sleep `delay` between attempts, or rename the function to what it does. |
| GT-5 | 46    | ZERO-TIMEOUT    | 🟠 | `UPSTREAM_TIMEOUT` is documented as 30 seconds and defined as `Duration::from_secs(0)`. Depending on the client, a zero duration means "no timeout" or "expire immediately" — both are wrong, and the doc guarantees neither. Set `from_secs(30)`. |
| GT-6 | 67,69 | VACUOUS-TEST    | 🚩 | `rejects_expired_token` claims to prove expired tokens are refused, but passes a token named `valid-unexpired-token` and asserts the call returns `true` — it asserts the opposite of its name, and passes only because of GT-2. Build an expired session and assert `!is_authorized(...)`. |
| GT-7 | 52,57 | FAKE-ORACLE     | 🚩 | Deleting GT-2's `return true` does **not** restore the check: `SessionStore::lookup` returns `Some(Session)` for any token and `Session::is_expired` is hardcoded `false`, so the "real" path is also unconditionally true. Canned-constant stubs on a `pub` auth path. A reviewer that stops at GT-2 leaves the bypass standing. |
| GT-8 | 12    | NO-SAFETY       | 🟠 | The `unsafe` block has no `// SAFETY:` comment at all — separate from GT-1's lying doc. Every unsafe block states the invariant that makes it sound (`rules/unsafe.md`). |
| GT-9 | 21    | GATE-DISABLE    | 🚩 | `#[allow(unreachable_code)]` with no justification, sitting directly over the dead real-lookup path. Its only effect is to silence the warning that would have exposed GT-2 — gate-disabling to hide a defect. |

Both eval runs also flagged, correctly and outside this table: `Result<_, String>` on a public
surface, missing `#[must_use]` on `is_authorized`, and `clippy::never_loop` firing as
deny-by-default (so the file cannot pass `-D warnings`). Those are real; they are omitted from
scoring because they are shape/tooling findings rather than the name-vs-body defect this fixture
measures.

Pass = `rust-reviewer` returns **NEEDS WORK** having read the bodies: GT-1, GT-2, GT-6, and GT-7
are the must-catch rows (a missed GT-2 is an authorization bypass waved through; a missed GT-7
means the "fix" leaves it standing). Reporting "doc comments and naming are clear" is the exact
failure this fixture catches. Recall = caught / 9.

**Known limitation.** This fixture hands over one 72-line file with an explicit instruction to
review it, which removes the *sampling pressure* that produces the unread assertion in the first
place — reading 72 lines is cheap, so a reviewer has no incentive to shortcut. Both eval arms
scored 6/6 on the original rows, with and without an explicit read-the-body instruction, so this
measures whether a reviewer *can* catch name-vs-body divergence, not whether it does so when
sweeping a large codebase under budget. A fixture that reproduces the real condition needs many
files and a task that cannot afford to read them all.
