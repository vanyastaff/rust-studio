---
name: security
paths: "**/handlers/**,**/routes/**,**/api/**,**/server/**,**/parser/**,**/parsers/**,**/auth/**,**/deserialize/**"
description: Rust security standards for untrusted-input and boundary code
---

# Security Standards

Applies to code at trust boundaries (request handlers, parsers, auth, deserialization).
Owned by `security-auditor`; feeds the RELEASE-GATE security check. The full sweep is
`/security-audit`.

## Treat all external input as hostile
- Validate and bound untrusted input at the boundary; downstream code receives typed, valid
  data. Cap sizes (bodies, collections, recursion depth) — never allocate based on an
  attacker-controlled length without a limit.
- Parse, don't trust: reject malformed input with an error, don't best-effort it.

## Injection & traversal
- **Command injection**: never build a shell string from input. Use `std::process::Command`
  with explicit args (no `sh -c`); never interpolate user data into a command line.
- **SQL injection**: use parameterized queries / bind parameters (sqlx query macros, diesel
  DSL). Never `format!` user data into SQL.
- **Path traversal**: canonicalize and confirm the resolved path stays within an allowed root;
  reject `..` and absolute paths from input. Don't join untrusted paths blindly.
- **SSRF/format**: validate URLs/hosts against an allowlist before fetching.

## Deserialization & parsing
- `#[serde(deny_unknown_fields)]` on externally-sourced structs where appropriate.
- Bound recursion and collection sizes when deserializing untrusted data (DoS via deep/large
  inputs). Prefer formats and crates with known-safe defaults.
- Be wary of `#[serde(flatten)]` and untagged enums on hostile input (ambiguity, blowup).

## Memory & arithmetic safety
- No `unwrap`/`expect`/`panic!`/indexing that an attacker can trigger — a panic on a request
  path is a DoS. Return errors instead.
- Use checked/saturating/wrapping arithmetic on untrusted numbers; `-O` does not catch
  overflow in release. Validate casts (`try_into`).
- `unsafe` on an input path gets extra scrutiny — see `unsafe.md` and `unsafe-auditor`.

## Secrets & crypto
- No hardcoded secrets, keys, or tokens in source or logs. Read from env/secret store; keep
  them out of `Debug`/error messages (wrap in a redacting newtype, e.g. `secrecy::Secret`).
- Don't roll your own crypto. Use vetted crates; compare secrets in constant time
  (`subtle`/`constant_time_eq`), never `==`.
- TLS verification on by default; never disable cert validation.

## Supply chain
- `cargo audit` (RUSTSEC) and `cargo deny` clean before release. Vet new deps (`/add-dep`).
- Pin and review anything touching crypto, parsing, or process/exec.
