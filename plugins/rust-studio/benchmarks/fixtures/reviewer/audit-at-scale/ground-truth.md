# Ground truth — reviewer/audit-at-scale (mode: defect-recall; expected verdict: NEEDS WORK)

**Multi-file fixture.** The source is the `src/` tree (14 files, ~194 lines), not a single
`input.rs`. Point the agent at the directory.

## What this measures

`name-vs-body` shows a reviewer *can* catch a body that contradicts its name — but it hands over
one 72-line file, so reading everything is cheap and there is no reason to shortcut. This fixture
restores the missing condition: **enough files that sampling is tempting, and grep evidence that
lies.**

Every planted defect sits in a file that *does* contain the string a grep-driven audit searches
for. The sweep comes back clean. Only reading bodies finds them.

Run it with an audit task, not a diff review — this is the prompt the fixture is calibrated for:

> This crate's house rule: every public entry point that consumes attacker-controlled bytes must
> enforce a size limit before it allocates or decodes. Audit the crate and report any path that
> does not. `src/lib.rs` states the rule.

## The trap, concretely

| The sweep an agent reaches for | What it shows | Why it is wrong |
|---|---|---|
| `rg validate_len src/ingest/` | a hit in **all five** ingest paths | `body.rs:6` discards the result — the call is there, the check is not |
| `rg validate_depth` / read the call sites | every caller uses `?` correctly | the bug is inside the validator itself, not at any call site |
| `rg decode_checked` | defined, called, and covered by two tests | the production entry point calls `decode_unchecked` instead |

## Defects

| id   | file:line | type | severity | defect |
|------|-----------|------|----------|--------|
| GT-1 | `src/ingest/body.rs:6` | DISCARDED-CHECK | 🔴 | `let _ = validate_len(raw, MAX_BODY);` throws the `Result` away — the `?` is missing, so `read_body` allocates a copy of any payload at any size. Every sibling ingest path uses `validate_len(..)?`, which is exactly why a call-site grep reports 5/5 clean. Unbounded allocation from attacker bytes. Fix: `validate_len(raw, MAX_BODY)?;`. |
| GT-2 | `src/limits.rs:21-23` | INVERTED-VALIDATOR | 🔴 | `validate_depth` returns `Ok(())` inside `if depth > max` — the over-limit branch reports success, so the function cannot fail for any input. Every caller uses it correctly with `?`; auditing call sites finds nothing. `codec/json.rs` therefore has no depth bound at all, giving a stack-exhaustion vector on nested input. Fix: `return Err(Error::TooDeep { got: depth, max });`. |
| GT-3 | `src/codec/base64.rs:23-25` | UNCHECKED-ENTRY | 🔴 | `decode_transfer_encoded` is a public entry point that calls `decode_unchecked` directly, skipping the limit check. `decode_checked` exists, is documented, and is the only thing the tests exercise — so both a name sweep and a coverage glance suggest the checked path is the one in use. Fix: call `decode_checked`, or validate before delegating. |

## Scoring

Recall = caught / 3. **A report that concludes the house rule holds is a zero**, regardless of how
much other detail it contains — that is the failure this fixture exists to catch.

Two signals distinguish a real audit from a sampled one, and both should appear in a passing run:
the agent states which files it opened, and it reasons about `validate_depth`'s *body* rather than
its call sites. An agent that cites only grep counts has not done the work even if it guesses one
defect.

The crate compiles clean with zero warnings under `rustc --edition 2021 --crate-type lib`
(verified). Neither rustc nor clippy flags any of the three — there is no compiler shortcut here,
which is the point. GT-1 in particular is invisible to `cargo clippy --all-targets -- -D warnings`:
`let_underscore_must_use` is restriction-tier and off by default, verified against clippy 1.97.

## Real findings this fixture does not score

A live run surfaced these. They are genuine — do **not** count them against precision — but they
are incidental to what the fixture measures, so they stay out of recall:

- `net/listener.rs:7` — `handle_frame` inherits GT-1 through `read_body`. The transitive
  consequence, and the widest blast radius; crediting it with GT-1 is correct.
- `codec/base64.rs:12` — `decode_unchecked` is not a base64 decoder at all: it shifts raw bytes
  with no alphabet lookup, so `decode_checked(b"TWFu")` yields `[85]` where `b"Man"` is correct,
  and it reserves 3 bytes per chunk while emitting 1.
- `ingest/multipart.rs:8` — `raw.split(|b| boundary.first() == Some(b))` splits on the boundary's
  *first byte*, not the boundary sequence; an empty boundary never splits.
- `ingest/multipart.rs:6` — the whole payload is bounded by `MAX_PART` (1 MiB) rather than
  `MAX_BODY`; stricter, so the rule holds, but the constant contradicts the intent, and the
  per-chunk re-check on line 9 is dead because each chunk is already a subslice of `raw`.
- `lib.rs:10` — `Error` has no `Display` and no `std::error::Error` impl, and no
  `#[non_exhaustive]`; `TooDeep` is dead until GT-2 is fixed.
- `codec/base64.rs:37` — `decodes_small_input` asserts only `.is_ok()`, so it passes against a
  decoder returning categorically wrong bytes.

## Result of the calibration run (rust-reviewer, plugin 0.30.0)

**3/3**, each finding backed by an executable probe rather than an assertion — the reviewer
synthesized a `Cargo.toml`, built a scratch crate, confirmed `clippy -D warnings` is clean, and
wrote nine independent probe tests as an oracle rather than trusting the two shipped ones. It
also retracted its own first probe when it passed for the wrong reason (input length `% 4 == 1`
tripped a `Malformed` arm before the limit mattered) and re-ran with a corrected input.

Its strongest finding is one this fixture did not plant: the three defects are not three slips
but one **shape** defect — a validator returning bare `Result<(), E>` lets a hole open by omission,
and three entry points independently fell in. That observation is now `rules/types.md`.
