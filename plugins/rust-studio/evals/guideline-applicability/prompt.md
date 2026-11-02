---
max_turns: 18
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
runs: 1
targets: [skill:review, agent:rust-reviewer, agent:api-design-lead]
---
Use `/rust-studio:review` and its applicable guidance to assess these proposed rules. This
is a supplied design scenario, not a runnable repository; do not invent test results or edit.

Our Rust 2021 application uses Tokio, clones `Arc<Config>` to share immutable configuration,
returns an owned `Vec<Row>` from a batch loader because the caller owns the batch, and uses
a direct `for` loop for a stateful operation. A short nonblocking critical section uses
`std::sync::Mutex`, released before awaiting. A separate connection uses `tokio::sync::Mutex`
across an I/O await; its cancellation invariant and lock ordering still need review.

A reviewer read Google's Rust guide and proposes banning async everywhere because Chrome
does; rewriting all four choices to generics/iterators/no locks; and upgrading the edition
without checking the declared MSRV. They also want to add `#[non_exhaustive]` to our published
library's existing public `Config { pub timeout: u64 }` in a patch release. Downstream crates
currently construct it with a struct literal. Finally, they ran only `--all-features` Clippy
and call that proof of the CI gate, which lints default features and a second supported profile.

Which claims are actionable defects, which need evidence, and which are overgeneralizations?
