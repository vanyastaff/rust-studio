# Build and tooling

Use for manifests, build.rs, CI, xtask, feature/target matrices and reproducibility. Read
`${CLAUDE_PLUGIN_ROOT}/rules/build-scripts.md`, `${CLAUDE_PLUGIN_ROOT}/rules/cargo-manifest.md`
and `${CLAUDE_PLUGIN_ROOT}/docs/project-gate.md`.

- Map workspace members, resolver, shared dependencies/lints/profiles, target triples and
  additive features. Centralize values shared by members at the workspace root.
- Reproduce the exact failing configuration before diagnosing linker, cfg, feature or codegen
  errors. The project's command, wrappers, environment and feature sets define the build gate.
  Extra feature-powerset probes supplement it; all-features cannot replace a shipped config.
- build.rs must be deterministic and offline: declare every file/env input with rerun triggers,
  write generated files only to OUT_DIR, preserve link flag order and DEP_* metadata, and use
  target-aware probes/sysroots rather than host assumptions. Compare build.rs, xtask and
  proc-macro approaches by build cost and the actual generation requirement.
- Cover default/no-default/selected features and valid powersets with cargo hack, plus cross
  targets. Record matrix exclusions with reasons. CI cache keys, sharding and artifact reuse
  must preserve input identity; assess build-time changes with before/after evidence.

## BUILD-GATE

The project lint/build gate and required feature/target matrix pass with zero warnings.
Build scripts obey the input/output contract; same inputs produce reproducible artifacts.
Cross-target output, cargo hack results, cargo deny and cargo audit evidence are attached;
load `dependencies.md` and `security.md` for their distinct checks. Name each unrun row and
the CI run that supplies it, or leave that row unverified.
