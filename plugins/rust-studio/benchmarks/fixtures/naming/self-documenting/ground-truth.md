# Ground truth — naming/self-documenting (verdict: REDO-TO-BAR)

> Mapped agent is `rust-reviewer` in **first-pass-bar** mode; its reject token is
> **REDO-TO-BAR**. The code compiles, is clippy-clean, and is correct — clippy is **silent**
> on weak-but-valid names, so the reviewer is the only gate. Accepting it because "it compiles
> and tests/clippy are green" is the miss. Per `${CLAUDE_PLUGIN_ROOT}/rules/core.md` *Naming*:
> a name must state intent, encode its unit/domain, and use one word per concept.

| id   | line     | type           | severity | defect |
|------|----------|----------------|----------|--------|
| GT-1 | 11       | ABBREVIATION   | 🟣 | Type `Mgr` is a domain-obscuring abbreviation; types read as nouns, spelled out. Rename to `ConnectionManager` (and fix call sites). |
| GT-2 | 12       | ABBREVIATION   | 🟣 | Field `cfg` abbreviates `config`/`configuration`. Spell it out: `config`. |
| GT-3 | 13       | UNIT-AMBIGUOUS | 🟣 | `timeout: u64` carries no unit — seconds? millis? Rename to `timeout_secs`, or better encode the unit in the type (`Duration`, or a `Secs(u64)` newtype) so the name can't lie. |
| GT-4 | 14       | BOOL-NAME      | 🟣 | `flag: bool` neither asks a question nor says what it gates (used at line 41 as the success precondition). Name it for the question it answers, e.g. `require_host` / `must_have_host`. |
| GT-5 | 22,26,30 | SYNONYM-CLASH  | 🟣 | `fetch`, `get`, and `load` are three names for one concept ("read one config value by key"). Converge on one word (`get`) and delete the synonyms; one concept, one word across the surface. |
| GT-6 | 36       | THROWAWAY      | 🟣 | `let x = Duration::from_secs(...)` — `x` hides that it is the per-attempt timeout. Rename to `attempt_timeout`. |
| GT-7 | 37       | THROWAWAY      | 🟣 | `let mut tmp` is the retry counter, not a temporary. Rename to `attempts`. |
| GT-8 | 38,42,48 | THROWAWAY      | 🟣 | `let mut res` is the connection outcome. Rename to `connected`. |
| GT-9 | 40       | THROWAWAY      | 🟣 | `let data = self.cfg.get("host")` holds the host entry, not generic "data". Rename to `host`. |

Pass = the agent returns **REDO-TO-BAR** (or NEEDS WORK that explicitly names the weak
identifiers) AND flags the intent-hiding names with the better identifier. Match on the named
identifier + line vicinity, not exact wording; cluster GT-5/GT-8 by concept. A "looks fine, it
compiles and clippy is green" verdict is a FAIL even if no rows are listed — that is exactly the
gap this fixture guards against.
