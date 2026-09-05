# acme-limits

Parse and enforce request limits.

```rust
use acme_limits::Limit;

let limit = Limit::new(10);
assert_eq!(limit.max(), 10);
```

Limits can also be parsed from configuration strings:

```rust
use acme_limits::parse_limit;

let limit = parse_limit("10/s").unwrap();
```
