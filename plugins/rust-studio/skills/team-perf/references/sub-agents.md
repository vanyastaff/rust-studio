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

Where a skill says the orchestrator must never write and must delegate to `rust-builder`, and
no `rust-builder` exists: **you write** — but only after running the scout and plan phases you
would otherwise have handed off. The protocol exists to keep those phases from collapsing into
one hurried edit. Skipping the delegation is fine. Skipping the phase is not.

The same holds for anything else the full studio supplies out of band. Some hosts run the
studio's hooks, which inject a session briefing and push the relevant standards into context
the moment you touch a matching file. If yours does not, nothing is pushed: read the rules a
skill cites, in its `references/` directory, rather than waiting for them to arrive.
