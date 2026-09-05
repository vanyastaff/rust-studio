# Ground truth — macros/hygiene-and-double-eval (agent: `macro-specialist`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"Review these `#[macro_export]`ed helpers; three sibling crates use them. List every finding with file:line and severity, then give a verdict."* Both unit tests pass; every defect is one `rules/macros.md` names and is visible only in `cargo expand`.

| id   | line   | type                    | severity | defect |
|------|--------|-------------------------|----------|--------|
| GT-1 | 7–16   | MULTIPLE EVALUATION     | 🔴 | `clamp!` expands `$v` up to three times and `$lo`/`$hi` twice — `clamp!(next_sample(), …)` calls the side-effecting expression repeatedly. Bind each argument once with `let` inside a block, or make it a generic `fn clamp<T: PartialOrd>`. |
| GT-2 | 31–34  | DOUBLE EVALUATION + PRECEDENCE | 🔴 | `square!($e)` → `$e * $e`: `square!(x + 1)` expands to `x + 1 * x + 1`, wrong by precedence, and evaluates `$e` twice. Parenthesize (`($e) * ($e)`) and bind once — or make it `fn square`. |
| GT-3 | 23–25  | UNDOCUMENTED RESERVED LOCAL | 🟡 | `traced!` introduces `let tmp`. `macro_rules!` hygiene does keep the caller's `tmp` and the macro's apart — this is not a capture bug — but `rules/macros.md` still asks for an unlikely name (`__traced_value`) or a documented reservation, because hygiene does not extend to *items* and because the `cargo expand` output a debugger reads shows two `tmp`s with no marker of which is which. A convention finding, not a soundness one; an agent that says "not a real capture bug, but rename per the rule" has caught it. |
| GT-4 | 24     | HARDCODED CRATE NAME    | 🔴 | `acme_util::log::debug` inside an exported macro — breaks for any downstream that renamed the dependency or uses it through a facade. `$crate::log::debug`. |
| GT-5 | 41     | UNQUALIFIED EXTERNAL PATH | 🟠 | `HashMap::new()` relies on the call site having imported `HashMap`. Use the full path `::std::collections::HashMap`. |
| GT-6 | 49–53  | MACRO WHERE A FUNCTION BELONGS | 🟡 | `add!` (and arguably `square!`/`clamp!`) capture no syntax, are not variadic, and emit no items — plain generic functions, inlined by the compiler. "Saves keystrokes" is not a reason. |
| GT-7 | 61–70  | NO EXPANSION / COMPILE-FAIL TESTS | 🟡 | The tests never exercise a side-effecting argument, a shadowing caller, or an error message; no `trybuild`. Add a double-evaluation test (counter incremented once) and trybuild cases. |

Pass = GT-1, GT-2, GT-4 and at least two of the others, with a `NEEDS WORK` verdict. "The tests
pass" is the fail — both defects that matter are invisible to these tests.
