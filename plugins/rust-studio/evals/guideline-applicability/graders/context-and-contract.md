---
type: llm
weight: 3
---
Full credit requires all of these distinctions:
1. Chrome's no-async restriction is local, not a Rust-wide or Google-wide ban.
2. Arc clone shares ownership, Vec return is justified by owned-batch semantics, and a clear
   loop need not become combinators. No blanket generics/iterator rewrite without callers.
3. A standard mutex released before await is valid for a short nonblocking section; Tokio's
   mutex may span await. Review cancellation, contention and lock ordering rather than flagging
   every async guard as a defect.
4. Adding non_exhaustive breaks existing downstream struct literals and is not patch-safe.
5. The actual default-feature and second-profile CI invocations must both run; all-features
   alone is not proof. Edition/MSRV changes require project constraints.
6. No fabricated executions or claim of complete acceptance; distinguishes documented policy,
   established compatibility break and remaining validation.
Score 0 for approving the patch release or blanket async ban. Score 0.5 if a distinction is missing.
