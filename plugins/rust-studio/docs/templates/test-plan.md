<!-- rust-studio template — copy into your project and fill in every placeholder before opening a PR -->

# Test Plan: <feature>

*Short description of the feature under test and the crate/module it lives in (e.g. `crate::parser::json`, `tokio` async runtime integration).*

---

## Acceptance criteria -> test mapping

*One row per acceptance criterion from the ticket or RFC. Map each criterion to at least one concrete test name.*

| # | Acceptance criterion | Test(s) | Location |
|---|----------------------|---------|----------|
| 1 | *e.g. `parse()` returns `Ok` for all valid inputs* | `test_parse_valid_json`, `prop_parse_roundtrip` | `tests/parser.rs` |
| 2 | *e.g. error type carries the byte offset of the first invalid char* | `test_parse_error_offset` | `src/parser.rs` (inline) |
| 3 | | | |

---

## Test types

### Unit tests

*Fast, isolated, no I/O. Inline in `src/` with `#[cfg(test)]`. Cover the happy path and each error branch of every public function.*

- [ ] *e.g. `Tokenizer::next_token` — all token variants*
- [ ] *e.g. `Config::default` — field values match documented defaults*

### Integration tests

*Live in `tests/`. Exercise real I/O, external crates, or multi-module paths. Run with `cargo test --test <name>`.*

- [ ] *e.g. end-to-end parse -> serialize -> deserialize roundtrip against fixture files*
- [ ] *e.g. HTTP client sends correct headers (use `wiremock` or `httpmock`)*

### Doc tests

*Every public item with an example in its rustdoc must compile and pass. Run automatically with `cargo test --doc`.*

- [ ] *e.g. `/// # Examples` blocks in `lib.rs` cover the primary use case*
- [ ] *e.g. demonstrate error handling with `?` in doc examples*

### Property tests

*Use `proptest` or `quickcheck`. State invariants that must hold for arbitrary inputs.*

- [ ] *e.g. `prop_parse_roundtrip` — serialize(parse(x)) == x for any valid input*
- [ ] *e.g. `prop_ordering_consistent` — sort is stable and transitive*

### Benchmarks

*Live in `benches/` using `criterion`. Only add a bench if performance is an acceptance criterion.*

- [ ] *e.g. `bench_parse_1mb` — baseline and regression threshold (< X µs/op)*
- [ ] *e.g. compare `HashMap` vs `BTreeMap` for the hot path*

---

## Edge cases

*List every abnormal input or condition the implementation must handle correctly.*

| Category | Specific case | Expected behaviour |
|----------|---------------|--------------------|
| Empty | Empty `&str`, zero-length `Vec`, empty `Iterator` | *e.g. return `Ok(Default::default())` / `Err(ParseError::Empty)`* |
| Maximum | `usize::MAX` index, `i64::MAX` value, max-depth nesting | *e.g. saturate, overflow error, or depth-limit error* |
| Boundary | Off-by-one at buffer end, last valid UTF-8 byte | *e.g. no out-of-bounds panic; verify with `#[should_panic]` tests* |
| Unicode | Multi-byte sequences, right-to-left text, zero-width joiners, `\0` | *e.g. treated as opaque bytes / rejected with `Utf8Error`* |
| Concurrent | Parallel calls from multiple threads / tasks | *e.g. `Send + Sync` impl confirmed; no data races under `loom` or `miri`* |
| Error paths | I/O failure mid-stream, partial write, cancelled `Future` | *e.g. resource cleanup verified; no half-written state* |

---

## Property tests & laws

*State each algebraic law the API must satisfy. These drive `proptest`/`quickcheck` strategies.*

- **Round-trip:** `decode(encode(x)) == x` for all `x: T where T: Arbitrary`
- **Idempotence:** `normalize(normalize(x)) == normalize(x)`
- **Ordering:** if `a < b` and `b < c` then `a < c` (transitivity); `a <= a` (reflexivity)
- **Identity / zero:** `op(x, identity) == x` and `op(identity, x) == x`
- **Commutativity / associativity** *(if applicable):* `op(a, b) == op(b, a)`; `op(op(a,b),c) == op(a,op(b,c))`
- *Add any domain-specific laws here (e.g. checksum invariants, monotonic timestamps)*

---

## Fixtures / setup

*Describe static test data, helper macros, or shared state needed before tests run.*

- **Test files:** *e.g. `tests/fixtures/valid/*.json`, `tests/fixtures/invalid/*.json` — committed to the repo*
- **`TestEnv` helper:** *e.g. `struct TestEnv { tmp: TempDir, db: Db }` with `impl Drop` for cleanup*
- **Feature flags:** *e.g. run with `cargo test --features integration` for tests that need a live database*
- **Environment variables:** *e.g. `TEST_REDIS_URL` must be set; skip with `#[ignore]` if absent*
- **`miri` / `loom` runs:** *e.g. `cargo +nightly miri test` for unsafe code; `RUSTFLAGS="--cfg loom" cargo test` for concurrency*

---

## Out of scope

*Explicitly list what will NOT be tested in this plan, and why.*

- *e.g. Serialization formats other than JSON — covered by a separate plan*
- *e.g. Windows-specific path handling — tracked in issue #42*
- *e.g. Performance under >1 GB inputs — out of scope for v1; file a follow-up*

---

## Evidence

*Describe how passing tests will be demonstrated before the PR is merged.*

- `cargo test --all-features --all-targets` passes locally and in CI (GitHub Actions / cargo-nextest output attached)
- `cargo clippy -- -D warnings` clean
- `cargo doc --no-deps` builds without warnings; doc-test output included
- Coverage report: *e.g. `cargo llvm-cov --open` — target line coverage >= X %*
- Benchmark baseline committed to `benches/baselines/` and compared with `criterion`'s `--baseline`
- *Any manual verification steps (screenshots, log snippets) pasted in the PR description*
