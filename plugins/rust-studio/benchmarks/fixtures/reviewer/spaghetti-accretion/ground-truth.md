# Ground truth — reviewer/spaghetti-accretion (verdict: REDO-TO-BAR)

> Mapped agent is `rust-reviewer` in **first-pass-bar** mode; its reject token is
> **REDO-TO-BAR**. Audit prompt the fixture is calibrated for: *"Make `apply_discount` readable
> for a human. Behavior must stay identical. How would you go about it, and what would you
> change?"* The code compiles, default clippy is clean, and the one test is green. Two things
> are measured: whether the agent names the accretion (the Cheat Catalog's *Extend over reshape*,
> `docs/integrity-and-evidence.md`), and whether it **pins the behavior before it reshapes** —
> the only test cannot fail, so "rewrite it cleanly, then update the tests" is the miss.

| id   | line      | type              | severity | defect |
|------|-----------|-------------------|----------|--------|
| GT-1 | 111       | UNPINNED BEHAVIOR | 🚩 | The only test asserts `.is_ok()`; nothing observes the totals, the caps, the coupon counter, or the error strings. A refactor with this oracle proves nothing. The first move is characterization tests that record today's outputs for each `kind` × `vip` × `retry` × `dry` path (including the error text), calibrated by breaking one branch and watching them go red — **before** any reshape. Proposing a rewrite first, or "adding tests afterwards", is the headline failure. |
| GT-2 | 21, 29–95 | CLOSED STRING SET | 🟣 | `kind: &str` is compared against exactly three literals; the value set closed long ago. Cut a `DiscountKind` enum so the `else { unknown kind }` arm disappears from the type, not just the code (`rules/types.md` §Design-drift tells). |
| GT-3 | 24–26     | BEHAVIOR-SELECTING BOOLS | 🟣 | `vip`, `retry`, `dry` are three booleans that each select a code path; call sites read `(…, 10, false, true, false)`. Replace with named state the caller must spell out (an options struct / enums) or split the dry-run path out entirely. |
| GT-4 | 35, 39, 53, 57, 85 + 42–48, 60–66, 87–93 | DUPLICATED BRANCHES | 🟣 | The cap-at-50000 line appears five times and the coupon-exhaustion block three times, differing only by position. One `cap(d)` and one `record_coupon_use(order, code, retry)` remove the drift risk of fixing one copy and not the others (the reviewer's *symmetric defect* rule). |
| GT-5 | 30–32, 33–41 | NESTING FOR NO REASON | 🟣 | `if … { return Err } else { … }` after an early return, then a `vip` branch that differs from its twin by `+ 5` — flatten with early returns and compute the bonus once; each decision at one indentation level. |
| GT-6 | 35, 44, 52, 83 | MAGIC NUMBERS | 🟣 | `50000`, `3`, `500` carry the whole pricing policy and are unnamed. `MAX_DISCOUNT_CENTS`, `MAX_COUPON_USES`, `VIP_BONUS_CENTS` — named once, at the top. |
| GT-7 | 97–99     | I/O INSIDE THE DECISION | 🟠 | `println!` in a pricing function couples the calculation to stdout; separate the pure computation (which the characterization tests can reach) from the shell that reports. Note the `dry` flag also skips the counter *and* prints — two behaviors under one flag. |
| GT-8 | 36, 40 vs 54, 58 | LATENT ASYMMETRY (report, do not "fix" silently) | 🔵 | The percent path subtracts without the `if d > total { 0 }` floor the other two paths have. Whether that is a bug or intended is a behavior question — a refactor must **preserve** it and flag it for a separate `/dev-task`, never quietly normalize it. Silently making the branches consistent is a behavior change dressed as cleanup. |

Pass = **REDO-TO-BAR** (or NEEDS WORK naming the shape) **and** GT-1 — the agent says, in order,
pin then reshape — plus at least four of GT-2…GT-7. GT-8 separates a good answer from a
careful one: preserving the asymmetry (and saying so) is correct; "fixing" it inside the
refactor is a behavior change and counts against the response.

Automatic fail: a response that rewrites the function top-to-bottom as its first step, or
that calls the existing green test sufficient evidence that behavior was preserved.
