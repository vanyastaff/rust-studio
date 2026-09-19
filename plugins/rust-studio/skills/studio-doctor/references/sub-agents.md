# When sub-agents are unavailable

Many skills here name an agent: "task owned by `rust-scout`", "delegate all writes to
`rust-builder`", "`rust-reviewer` performs the final diff audit". Those agents are separate
processes with their own context, and they ship with the full studio — not with an individual
skill. If you were installed on your own, they do not exist here, and nothing you can call
will spawn them.

**That is not a blocker. Play the roles yourself, sequentially, in this session.**

A phase named for an agent is a phase, not a process. Scout the edit sites before you plan.
Plan before you write. Read the finished diff back as an adversarial reviewer, hunting for
what you would reject in someone else's work, before you call it done. The tiers, the quality
gates and the verdicts are unchanged — only the number of processes is.

**Where the agent does exist, what it returns is a verdict, not raw material.** The reason a
gate lens runs in its own process is that the session which read the code cannot also be the
one that judges it — so relaying its finding as part of your own merged summary gives back
exactly the independence the spawn was paid for. Its verdict token appears verbatim in the
message the user reads, attributed to the lens it came from, next to your own; if yours
differs, say so and say why, rather than quietly merging a blocking verdict into a passing
one. The full contract, including what each token means, is in `references/verdicts.md`.

Where a skill names `rust-builder` and no worker exists: **you write** within the authorized
scope. Establish edit sites and constraints when the task needs them; use a fresh review
perspective when the risk calls for it. A scout, plan, or separate review earns its cost through
filtering or independence, not because a fixed sequence requires it.

**A refused tool is a fact about the host, not a transient error.** When a command tool is
absent or a call is denied (no shell, a permission refusal, a sandbox without `cargo`), do not
retry the same call in a different spelling — a review session that burned twelve turns
re-running `cargo test` under new paths got nothing for them. Say once what could not run,
record that check as *unverified* (`integrity-and-evidence.md` — a valid and required state),
and continue with every phase that needs only reading: the map, the plan, the findings, the
verdict. An unverified line in the report is the honest result; a turn budget spent on
retries is not. The refusal comes in several wordings ("requires approval", "permission …
denied", "blocked", a tool missing from the list), and some hosts append "you may attempt this
with other tools". That offer is not empty: `Monitor` runs shell commands and a sub-agent's own
tool list can include `Bash`, so a build or test command is reachable through either. Taking it is
still the retry this paragraph forbids, and it measured worse: the two runs that routed around the
missing tool ended over budget with no verdict. `cd`, `--manifest-path`, `which cargo`, and `echo`
probes are the same retry in another spelling.

The same holds for anything else the full studio supplies out of band. Some hosts run the
studio's hooks, which inject a session briefing and push the relevant standards into context
the moment you touch a matching file. If yours does not, nothing is pushed: read the rules a
skill cites, in its `references/` directory, rather than waiting for them to arrive.
