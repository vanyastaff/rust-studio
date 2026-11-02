# Live cold handoff

Run `bun tools/eval-runner.ts --live-task cold-handoff --budget 8` from the plugin
root. This spends live host/API budget only when explicitly invoked. `--dry-run`
only lists it. It requires an authenticated Claude CLI, Bun, Git, Bash and Rust.

The author conversation invokes `/design-change --mode specification` on the unchanged crate, receives the
later user amendment via `follow-ups.md`, and writes only design artifacts. The
runner validates every product byte and untracked path, then creates a different
checkout from the original fixture plus the exact `handoff_files` list. The
continuation starts through `runConversation` with a new session ID and no author
follow-ups. It receives the continuation prompt and artifact paths. The output
JSON retains both traces and identities; the conventional `.stream.jsonl` is the
implementation trace and `.author.stream.jsonl` is the author trace. The `trace`
field keeps implementation output and aggregates cost, turns and duration for
both. The per-run budget is shared by author turns and implementation.

`check.sh` compares the manifest, lockfile and gate to the original fixture,
executes the gate, and runs private public-library and CLI probes. The original
baseline deliberately lacks End/IntRange and optional CLI arguments. The probe
checks the amended equal-exclusive empty behavior, singleton inclusivity,
inverted inputs, malformed CLI arguments, legacy calls and i64 extremes. Checker
success cannot make a missing/error/same-session implementation trace pass.

The native lifecycle gate inspects chronological tool events: a successful full
reconstruction Write, explicit coordinator acceptance, a successful CURRENT JSON
result from the trusted staged plugin's standalone helper check, then a successful
product Edit/Write. `handoff_reconstruction` and `handoff_packet` name those exact
paths. Missing results, code written before reconstruction, stale checks, unknown
shell effects and opaque nested agent tools leave lifecycle **unverified**. This
does not mean the implementation's behavior is wrong. `handoff.behaviorPassed`
records the private oracle independently; `passed` requires both behavior and
verified lifecycle evidence. A nonempty reconstruction file is insufficient.
Hosts that hide nested worker traces cannot establish native lifecycle acceptance
through this runner; separately recorded host evidence must retain that distinction.

Only `docs/designs/`, `intent/`, and `.rust-studio/reviews/` are eligible artifact
regions. Exact files are required; directories, symlinks, path escapes, baseline
overwrites and undeclared product additions are rejected. Author `.git` and
`target` outputs never cross. This is conversation and checkout isolation, not an
OS security sandbox. The host still has its ordinary filesystem permissions.

Runner unit tests simulate the protocol and cannot establish live agent quality.
A manual fresh-subagent run is separate supplied host evidence, not native CLI
evidence. A native live run requires real distinct successful session traces;
missing authentication must be reported as unavailable, never a pass.
