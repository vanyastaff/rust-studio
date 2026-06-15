---
name: active-dev
paths: "**/Cargo.toml,**/lib.rs,**/src/lib.rs,**/src/mod.rs,**/src/**/mod.rs,**/src/domain/**/*.rs,**/src/service/**/*.rs,**/src/services/**/*.rs,**/src/model*.rs"
description: Active-development mode: correct shape over compatibility fossils
---

# Active-Development Standards

Applies to solo/unpublished active development; published crates follow `api.md` semver.

- Code is not a contract until the pre-code maintainer gate passes.
- No shims, bridge adapters, deprecated aliases, or "migrate later" TODOs.
- If the touched shape is wrong, reshape it before adding the feature.
- Finish the ripple across crates, call sites, tests, docs, examples, and manifests.
- If the full ripple has a real blocker, stop with `BLOCKED`; do not land a partial state.
