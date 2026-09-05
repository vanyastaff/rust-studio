---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
Before we build it, attack this design. Give me the strongest case against it, what it is missing, and whether it survives.

# Plan: per-tenant rate limiter for the public API

- One `Arc<Mutex<HashMap<String, Vec<Instant>>>>` shared by all axum handlers; the key is the tenant id from the request header.
- On each request: lock, push `Instant::now()`, drop entries older than 60 s, allow if `len <= limit`.
- Cleanup of tenants that stopped sending requests: "later, if memory becomes a problem".
- The limit is a `u32` read from the config file at startup.
- Tests: one test that sends `limit` requests and asserts they are allowed, then one more and asserts it is rejected.
- Rollout: enable for all tenants at once behind a boolean config flag.
