# ADR 0001: DeepSeek Harness third-host evaluation is open work, not settled; record the 2026-09 Agent Skills research

*The 2026-09-04 brief asked to "study new AI papers," "look into DeepSeek Harness," and an
open-ended "и тд" ("etc."). This ADR is where that research lives so it outlives
`.autopilot/`, and where the one decision it produced — DeepSeek Harness stays unadded until
someone actually runs it, not merely finds it — is recorded. A same-day follow-up pass found
that decision's original justification was itself wrong: the "cannot verify" claim rested on two
404s from guessed package/repo names, not the real ones. That correction is recorded in place in
Decision 1 below, along with citation errors a reviewer caught in three of the seven research
findings.*

---

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** rust-studio autopilot session, 2026-09-04 — research and decisions drafted in
  `.autopilot/best-rust-plugin/spec.md` §1, §6 and `manifest.md` (R02, R03, R04, R01.5, R06i);
  written up here per ticket T05 so it survives the run.

---

## Context

`.autopilot/` is scratch space: it dies with the autopilot run that produced it. The brief
asked to "изучи" (study/look into) three things — new AI papers from August/September, DeepSeek
Harness, and an unbounded "и тд." If the research those requests produced doesn't land
somewhere durable, the next session re-reads the same sources from scratch. This ADR is that
durable landing spot.

Seven dated, source-checked findings came out of the session:

| # | Source (date) | Finding |
|---|---|---|
| F1 | SameCapRisk-Bench, ["Right Family, Wrong Skill: Benchmarking Risk Exposure in Agent Skill Retrieval"](https://arxiv.org/abs/2606.10388) (arXiv:2606.10388, v2, online 2026-08-20) — **corrected 2026-09-04**; original text used a fabricated name ("SkillResolve-Bench") and mischaracterized the paper | Same-capability *risk exposure*, not catalog-size degradation: tests whether a retriever that finds the right capability family still surfaces a risky same-capability sibling, over **fixed candidate pools** (1,190 skill-risk units / 1,686 query cases) — the paper does not vary catalog size. Public retrievers (SkillRouter, SkillRet, R3-Skill) reach high Recall@3 (0.848–0.888) but expose the marked risky sibling at HSR@3 0.346–0.372; a score-and-cluster pipeline cuts that to HSR@3 0.128–0.182 (Recall@3 0.713–0.776). |
| F2 | SkillsBench, [arXiv:2602.12670](https://arxiv.org/abs/2602.12670) (v4, 2026-06-14) — **figure corrected 2026-09-04** | Curated skills raise the average pass rate from 33.9% to 50.5% — **+16.6 percentage points, not the originally stated +16.2** — across 87 tasks / 8 domains / 18 model-harness configurations (per-configuration range +4.1 to +25.7 pp). Focused skills (≤3 modules) outperform larger bundles; skill value is not proportional to length. *(v1 was submitted 2026-02-13; even v4, checked here, is dated 2026-06-14 — both outside the brief's August/September window.)* |
| F3 | ["Agent Skills in the Wild: An Empirical Study of Security Vulnerabilities at Scale"](https://arxiv.org/abs/2601.10338) (arXiv:2601.10338, 2026-01-15) — **primary source added 2026-09-04**; "Agent Skills: Portable, Popular, Unmeasured" (nerdleveltech.com) is secondary coverage of the same figures | Of 42,447 skills collected across two marketplaces, 31,132 were analyzed with the SkillScan detector (86.7% precision / 82.5% recall); 26.1% carried at least one vulnerability across 14 patterns in 4 categories. Skills bundling executable scripts were 2.12x more likely to contain one (OR=2.12, p<0.001). No publisher-trust mechanism exists for skills — unlike the MCP Registry for servers. |
| F4 | "Agent Skills: Portable, Popular, Unmeasured" (nerdleveltech.com) — not independently re-verified this pass | A skill's value is a property of its interaction with one specific model and harness, and both change underneath you. Verification has to be re-run on every model upgrade, not assumed to still hold. |
| F5 | DeepSeek Harness, Aug. 2026 (InfoQ, Developers Digest, VentureBeat, The Register) | Micro-kernel architecture on the Cordis plugin/event-bus framework, MIT licensed. Everything is a plugin — model adapters, tools, persistence, the agent loop, the web UI. Composition layers: profile → bundles (npm packages) → config patches. The session log is append-only and load-bearing: used as test fixtures and to derive a deterministic mock model. Hook bridges for Claude Code exist in the codebase; it can call Claude Code or Codex as sub-agents. Preview at 0.1.0-rc.6. |
| F6 | Agent Skills ecosystem, 2026 | The format is an open standard now supported by roughly 40 products. A vendor-neutral package format published 2026-08-06 carries Agent Skills and MCP server config in one directory. This plugin already implements it: root `plugin.json` declares `$schema: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` (verified present at `plugins/rust-studio/plugin.json`). |
| F7 | Toolchain state, measured on the host, 2026-09-04 | `rustc 1.98.0 (88d9e12ae 2026-08-18)`; `rustup check` reports the latest stable release as `1.98.1 (48a229cea 2026-09-01)`. The plugin's Rust doctrine is current: `rules/core.md` covers stabilizations 1.95–1.98 by API name and knows let-chains and let-else; forward-looking Cargo 1.100 references in `rules/cargo-manifest.md` are correctly hedged as not-yet-stable. |

Both arXiv links resolved when first checked while writing this ADR (2026-09-04) — but a
resolving link is not the same as a correct citation: F1's benchmark name and characterization
were wrong even though `arxiv.org/abs/2606.10388` returned 200. That error and the DeepSeek
Harness URLs originally cited under Decision 1 share one root cause; see Decision 1's
verification-failure note for the correct method.

---

## Decision

Three decisions came out of this research. Only the first changes what the plugin ships (and
that decision was itself corrected same-day, below); the other two record how the research
itself was bounded and measured, because R01.5/R06i require that "изучи" leave something behind
besides prose.

### Decision 1 — DeepSeek Harness: open work, not held out

**This reverses the original Decision 1.** The original text said DeepSeek Harness could not be
added because its first-party source was unverifiable (two 404s). Those 404s were checked
against guessed names — `@deepseek/harness` on npm, `deepseek-ai/harness` on GitHub —
reconstructed from memory of secondary press coverage, not looked up. Re-verified live
2026-09-04 against the actual names:

- `https://github.com/deepseek-ai/deepseek-harness` → **200** — "GitHub - deepseek-ai/deepseek-harness:
  DeepSeek Harness: Everything is a Plugin."
- `https://deepseek.com/harness/en/` → **200** — first-party docs, "DeepSeek Harness developer
  preview: Everything is a plugin."
- `npm view @deepseek-ai/dsh version` → `0.1.2-rc.1` — org-scoped `@deepseek-ai`, not the guessed
  `@deepseek`; one maintainer address is `@deepseek.com`.

The revisit condition this ADR originally set — "a runnable first-party source appears" — was
already satisfied when Decision 1 was first written; the session just hadn't looked under the
right names.

**Verification failure, recorded so it isn't repeated:** reading a 404 on a guessed identifier as
"no first-party source exists" is a search-method error, not a finding — the guess was wrong, not
the artifact absent. Correct method: search for the artifact by name first, then verify the name
the search turns up — don't verify a name reconstructed from memory and read its 404 as evidence.

```sh
npm search deepseek harness       # or a web search: "<project> npm package"
gh search repos deepseek harness  # or a web search: "<project> github"
# only then check the specific name that search actually turns up:
npm view <resolved-name> version
curl -sI https://github.com/<resolved-owner>/<resolved-repo>
```

**What is, and isn't, decided now:** a resolving package and repo is evidence the project exists
and is installable — it is not evidence its Claude Code hook bridges work. Nobody in this session
ran `@deepseek-ai/dsh`, loaded a plugin under it, or fired a hook; F5's claim that "hook bridges
for Claude Code exist in the codebase" is itself still unverified by this ADR, only reported
secondhand. Shipping a host-compatibility manifest on "the package resolves" alone would repeat
the mistake the original Decision 1 was trying to avoid, just from a corrected premise —
`docs/untrusted-context.md` rules out adding things because text named them; it doesn't get
overridden by the text turning out to be accurate this time.

**Decision:** DeepSeek Harness is not added as a third host in this session — not because it
can't be verified, but because running it wasn't attempted. Evaluating it is open work:

1. Install `@deepseek-ai/dsh` (`npm install -g @deepseek-ai/dsh`, or per the install docs at
   deepseek.com/harness/en/).
2. Confirm a plugin loads under it — smallest case: this plugin's `plugin.json` or a trivial stub.
3. Confirm a hook bridge actually fires end-to-end, not just that bridge code exists in the
   harness's source.

Only a pass on those three earns this plugin a DeepSeek Harness compatibility manifest.

**Revisit condition:** superseded — already met. The open item is no longer "wait for a runnable
source to appear," it's "run the three steps above."

### Decision 2 — how the open-ended "и тд" was bounded

The brief's third research line ("и тд") had no natural stopping point. It was bounded to: what
changes a line in this plugin — the Agent Skills standard and its ecosystem, skill benchmarks,
agent harnesses, and the state of the Rust toolchain as measured on this host. It was **not**
read as general AI news, model releases, or product announcements — those have no checkable
effect on `rules/`, `agents/`, `docs/`, or `benchmarks/fixtures/`, and reading them would have
made the research boundary unfalsifiable (no way to say "done").

### Decision 3 — the doctrine-currency measurement method, and its recorded failure

The question behind F7 was whether `rules/` had fallen behind the language. The first
measurement searched the doctrine for `let_chains` (underscore) and reported "0 of 20 rule
files mention it" — a false gap. The doctrine spells the feature `let-chains` (hyphen); the
underscore form is the `#[feature(let_chains)]` gate name, not the prose term documentation
would use.

**Correct method, recorded so a future re-measurement doesn't repeat the mistake** — grep both
spellings:

```sh
grep -rl 'let_chains' rules/   # the feature-gate spelling
grep -rl 'let-chains' rules/   # the prose spelling actually used in the doctrine
```

Re-measured result: `rules/core.md` uses the hyphenated spelling twice (nesting-reduction
guidance citing `let-else` and let-chains; a modern-idiom checklist entry). The doctrine is
current — it covers stabilizations 1.95 through 1.98 by name, and both let-chains and let-else
are present. No edit to `rules/` follows from this ADR.

The same measurement pass produced ground-truth coverage numbers, recorded here because they're
the honest map of what's tested versus what's merely asserted — not because this ADR closes the
gap:

- **6 of 33 agents** have benchmark fixtures behind them: `api-design-lead`, `chief-architect`,
  `perf-engineer`, `rust-reviewer`, `security-auditor`, `unsafe-auditor` (`benchmarks/fixtures/`).
- **7 of 20 rule domains** have a fixture family.
- **`async` has zero fixtures**, despite shipping a 5.2K rule (`rules/async.md`), two agents
  (`async-runtime-specialist`, `async-systems-lead`), an ASYNC-GATE, and `/team-async`.

Closing that gap is fixture/eval work, not a documentation change — out of scope for this ADR
and for the docs-engineer role. It is recorded here so the next session doesn't have to
re-derive it from scratch.

---

## Consequences

**Positive**

- The plugin makes no DeepSeek Harness compatibility claim it hasn't earned — Decision 1 now
  says "not attempted" instead of a false "can't be verified," and ties re-adding it to a
  concrete three-step check instead of a vague revisit condition.
- The Rust doctrine's currency is now a measured fact with a reproducible command, not an
  assumption — and the measurement held up: no `rules/` edit was needed.
- The coverage gap (6/33 agents, 7/20 rule domains, `async` at zero) is now a number a future
  session can act on, instead of a vague sense that "some agents lack fixtures."
- Research from a one-shot autopilot run now has a permanent address instead of dying with
  `.autopilot/`.

**Negative / Trade-offs**

- DeepSeek Harness stays unevaluated — not because it can't be, but because this session didn't
  run it. The revisit condition is already met (Decision 1); the next step is the three-item
  checklist there, not a calendar reminder.
- This ADR records the async/agent fixture gap; it does not close it. That work needs whoever
  owns `benchmarks/fixtures/` and `evals/`, not the docs-engineer role that wrote this ADR.

**Follow-ups**

- Run Decision 1's three-step DeepSeek Harness evaluation (install `@deepseek-ai/dsh`, confirm a
  plugin loads, confirm a hook bridge fires end-to-end) and ship a host-compatibility manifest
  only if all three pass.
- Fixture/eval coverage for `async` and the remaining agents/rule-domains without ground truth
  is open work. See `.autopilot/best-rust-plugin/spec.md` §1 ("Rust-линия") for the reasoning
  that surfaced it; hand to whoever owns `benchmarks/fixtures/` and `evals/`.

---

## Alternatives Considered

| Option | Why rejected |
|---|---|
| Install `dsh@1.0.1` or `deepseek-harness@0.0.1` from npm "just to check" | Names reconstructed from blog coverage, not confirmed upstream; installing to verify is the exact pattern `docs/untrusted-context.md` forbids — a dependency does not get added on the strength of third-party text alone. |
| Ship a DeepSeek Harness host-compatibility manifest based on F5's secondary-source description | Would assert compatibility with a host never run against this plugin — an unverified claim placed where a tested one is expected. |
| Treat the npm/GitHub 404s on guessed names (`@deepseek/harness`, `deepseek-ai/harness`) as proof no first-party source exists | This was the original Decision 1's actual mistake — a 404 on a guessed identifier is evidence about the guess, not the artifact. The real names (`@deepseek-ai/dsh`, `deepseek-ai/deepseek-harness`) both resolve. See Decision 1's verification-failure note. |
| Ship a compatibility manifest now that `@deepseek-ai/dsh` is confirmed to resolve | Rejected this session — a resolving package proves installability, not that this plugin's hooks work under it. Nobody ran the harness; that's open work, not a documentation change. |
| Read "и тд" as unbounded (all AI news from the period) | Makes the research boundary unfalsifiable — no way to call it done. Bounded instead to what can change a line in `rules/`, `agents/`, `docs/`, or `benchmarks/fixtures/`. |
| Trust the first `let_chains` (underscore) grep and file it as a doctrine gap | Would have been a false-positive fix — editing already-current doctrine because of a search-string artifact. Re-measured with both spellings before concluding anything. |

---

## References

- SameCapRisk-Bench, "Right Family, Wrong Skill: Benchmarking Risk Exposure in Agent Skill
  Retrieval" — <https://arxiv.org/abs/2606.10388> (v2, 2026-08-20; title and figures corrected
  2026-09-04 — original text used the fabricated name "SkillResolve-Bench")
- SkillsBench — <https://arxiv.org/abs/2602.12670> (v4, 2026-06-14; figures corrected 2026-09-04)
- "Agent Skills in the Wild: An Empirical Study of Security Vulnerabilities at Scale" —
  <https://arxiv.org/abs/2601.10338> (2026-01-15) — primary source for F3's 26.1% / 2.12x /
  31,132 figures, added 2026-09-04
- "Agent Skills: Portable, Popular, Unmeasured" — nerdleveltech.com — secondary coverage of F3's
  figures; sole source for F4
- DeepSeek Harness coverage, Aug. 2026 — InfoQ, Developers Digest, VentureBeat, The Register
- Agent Skills vendor-neutral package format, published 2026-08-06 — agent-plugins.org
- `https://github.com/deepseek-ai/deepseek-harness` → 200 (checked 2026-09-04) — the real repo
- `https://deepseek.com/harness/en/` → 200 (checked 2026-09-04) — first-party docs
- `npm view @deepseek-ai/dsh version` → `0.1.2-rc.1` (checked 2026-09-04) — the real package
- `https://registry.npmjs.org/@deepseek/harness` → 404 (checked 2026-09-04) — guessed name,
  wrong; see Decision 1's verification-failure note
- `https://github.com/deepseek-ai/harness` → 404 (checked 2026-09-04) — guessed name, wrong; see
  Decision 1's verification-failure note
- `https://registry.npmjs.org/dsh` → 200, latest `1.0.1` (checked 2026-09-04) — unrelated
  package, name collision, not upstream
- `https://registry.npmjs.org/deepseek-harness` → 200, latest `0.0.1` (checked 2026-09-04) —
  unrelated package, name collision, not upstream
- `rustc --version` → `1.98.0 (88d9e12ae 2026-08-18)`; `rustup check` → latest stable
  `1.98.1 (48a229cea 2026-09-01)` (checked 2026-09-04)
- `plugins/rust-studio/plugin.json` — `$schema: agent-plugins.org/schemas/1.0.0`
- `docs/untrusted-context.md` — the rule Decision 1 applies
- `.autopilot/best-rust-plugin/spec.md` §1, §6, §7 — full research writeup this ADR condenses
- `.autopilot/best-rust-plugin/manifest.md` — R02, R03, R04, R01.5, R06i
