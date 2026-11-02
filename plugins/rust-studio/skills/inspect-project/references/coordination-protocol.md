# Rust Code Studio — Coordination Protocol

This is the shared contract every agent and skill in the studio follows. It is
the Rust adaptation of an evidence-driven workflow: roles separate actions, profiles supply
domain expertise, and fresh instances establish required independence within authorization.

It is split into three parts so a skill loads only the part it needs. Read the
one that covers your question; the section numbers are stable across the split.

| Part | Sections | Covers |
|------|----------|--------|
| [`collaboration.md`](collaboration.md) | §0, §1, §9 | The quality bar, the autonomy/ask loop, what to escalate, memory |
| [`delegation.md`](delegation.md) | §2, §3, §6, §8 | Roles/profiles, fresh context, write ownership and integration |
| [`verdicts.md`](verdicts.md) | §4, §5, §7 | Quality gates and review modes, the verdict set, evidence over assertion |

## Section index

- **§0 First-pass quality is the contract** → `collaboration.md`
- **§1 Collaborative Protocol** (a quality loop, not a permission loop) → `collaboration.md`
- **§2 Roles and expertise** → `delegation.md`
- **§3 Delegation model** → `delegation.md`
- **§4 Quality gates** (and review modes) → `verdicts.md`
- **§5 Verdicts** → `verdicts.md`
- **§6 File-write protocol** → `delegation.md`
- **§7 Evidence over assertion** → `verdicts.md`
- **§8 Team execution (agent teams)** → `delegation.md`
- **§9 Memory (the second brain)** → `collaboration.md`

If you are here because a skill told you to "honor the collaboration protocol",
read [`collaboration.md`](collaboration.md).
