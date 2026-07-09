# Rust Code Studio — Coordination Protocol

This is the shared contract every agent and skill in the studio follows. It is
the Rust adaptation of a studio model: a tiered team that delegates downward,
consults sideways, and never ships without your sign-off.

It is split into three parts so a skill loads only the part it needs. Read the
one that covers your question; the section numbers are stable across the split.

| Part | Sections | Covers |
|------|----------|--------|
| [`collaboration.md`](collaboration.md) | §0, §1, §9 | The quality bar, the autonomy/ask loop, what to escalate, memory |
| [`delegation.md`](delegation.md) | §2, §3, §6, §8 | The three tiers, who delegates to whom, the file-write protocol, agent teams |
| [`verdicts.md`](verdicts.md) | §4, §5, §7 | Quality gates and review modes, the verdict set, evidence over assertion |

## Section index

- **§0 First-pass quality is the contract** → `collaboration.md`
- **§1 Collaborative Protocol** (a quality loop, not a permission loop) → `collaboration.md`
- **§2 The team (3 tiers)** → `delegation.md`
- **§3 Delegation model** → `delegation.md`
- **§4 Quality gates** (and review modes) → `verdicts.md`
- **§5 Verdicts** → `verdicts.md`
- **§6 File-write protocol** → `delegation.md`
- **§7 Evidence over assertion** → `verdicts.md`
- **§8 Team execution (agent teams)** → `delegation.md`
- **§9 Memory (the second brain)** → `collaboration.md`

If you are here because a skill told you to "honor the collaboration protocol",
read [`collaboration.md`](collaboration.md).
