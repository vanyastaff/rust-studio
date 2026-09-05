---
type: llm
weight: 3
---
The critique must construct concrete failure scenarios, not restate the plan. Required:
1. The single global `Mutex<HashMap>` on every request is a serialization point on the hot path (contention; and the sliding-window `Vec<Instant>` per tenant is O(n) per request); an alternative shape must be proposed (sharded/`DashMap`, per-tenant atomics, a token bucket or GCRA that needs O(1) state).
2. Unbounded memory growth: tenants are never evicted, and a hostile client sending random tenant ids grows the map without bound — "later" is not a plan.
3. `Instant::now()` inside the limiter makes it untestable and the two tests time-dependent; inject a clock.
4. The evidence is attacked: one happy-path + one rejection test proves nothing about the window boundary, burst at the edge, concurrent requests for one tenant, or clock behaviour — the test plan is vacuous for the properties that matter.
Plus at least one of: the header-supplied tenant id is untrusted input (spoofing, authorization of the key); a `u32` limit read once means no per-tenant limits and no reload; the all-at-once boolean rollout has no canary, no metrics, and no kill switch per tenant; what happens on lock poisoning / panic.
Full credit: all four required plus one, with a verdict (SURVIVES with required changes / DOESN'T SURVIVE, or the studio's verdict vocabulary), no praise. Partial: three of the four. Fail: agrees the plan is fine, or two or fewer.
