# Ground truth — api/planned-breaking-change (agent: `api-design-lead`, verdict: NEEDS WORK)

> Audit prompt the fixture is calibrated for: *"This is the working tree for the next
> `tinyconf` release. Can we tag it?"* The **change is right** — a `Result` with a typed error
> beats `None`, and dropping `raw` is a fine decision. What is wrong is how it ships. The
> fixture measures whether the studio handles an intended break the way a maintainer of a
> published crate does (`rules/api.md` §Making a breaking change on purpose): announce it,
> version it, give callers a path, and reconcile the tool's output instead of waving it off.

| id   | line     | type                                   | severity | defect |
|------|----------|----------------------------------------|----------|--------|
| GT-1 | 10, 51, 26 | BREAKING CHANGE SHIPPED AS MINOR     | 🔴 | A changed return type on a `pub fn` and a removed `pub` field are both MAJOR for a 1.x crate; `1.3.0` will break ~40 dependents on `cargo update`. Either **2.0.0**, or a deprecation cycle that keeps 1.x compatible: leave `parse` returning `Option`, add `try_parse` / `parse_str` returning `Result`, `#[deprecated]` the old one with a note, remove in 2.0. Approving the 1.3.0 tag is an automatic fail. |
| GT-2 | 18–19    | TOOL OUTPUT WAVED OFF                  | 🔴 | `cargo semver-checks` reported exactly the three breaks the author is shipping and the note dismisses it because CI is green. The tool's list **is** the set to announce or fix; "ignoring for now" is the *Skipped discipline* move. The release is tagged only when the tool's findings equal the CHANGELOG's `### Breaking` list. |
| GT-3 | 12–16    | NO MIGRATION PATH IN THE CHANGELOG     | 🟠 | Two breaks filed under `### Changed` with no before → after. Callers need `### Breaking` (or `Removed`) with the old signature, the new one, and what to write instead of `.raw` — per item. |
| GT-4 | 29–30    | UNDEPRECATED ALIAS                     | 🟠 | `pub type Cfg = Config;` "kept so 1.2 code compiles" is a permanent shim: no `#[deprecated(since, note)]`, no removal version, and — since the release is breaking anyway — no reason to exist. Either deprecate it with a note naming `Config` and a removal version, or drop it in the major. |
| GT-5 | 32–36    | NEW PUBLIC ENUM, NO `#[non_exhaustive]` | 🟡 | `ParseError` will grow (a duplicate key, an unterminated quote); without `#[non_exhaustive]` every new variant is another major. Add it now, while the surface is new. |
| GT-6 | 4, 26    | UNVERIFIED CLAIM ABOUT CALLERS         | 🔵 | "nobody should have relied on `raw`" is a belief, not a check: `cargo public-api` and a search of the dependents (crates.io reverse deps, `grep` of a few) turn it into evidence, or into a deprecation cycle. |

Pass = GT-1 and GT-2, with a concrete shipping plan (2.0.0 with `### Breaking` + migration notes,
**or** the deprecation-cycle variant that keeps 1.x green) — not a bare "this is breaking".
GT-3…GT-5 separate a correct answer from a release-ready one.

**Automatic fail**, whatever else was found: approving the `1.3.0` tag, recommending a
compatibility alias with no deprecation and no removal version as the fix, or proposing to
revert the improvement so the version can stay minor — the change is right; the shipping is not.
