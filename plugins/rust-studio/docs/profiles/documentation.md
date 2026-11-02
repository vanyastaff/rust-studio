# Consumer documentation

Use for rustdoc, doc-tests, README, examples, mdBook and API/RELEASE documentation evidence.
Read `${CLAUDE_PLUGIN_ROOT}/rules/api.md`, `${CLAUDE_PLUGIN_ROOT}/docs/working-preferences.md`
and `${CLAUDE_PLUGIN_ROOT}/docs/prose-gate.md`.

- Inventory all exported items, including cfg/macro-generated exports, and check meaningful
  item docs plus crate-level guidance. Required sections are Errors for fallible contracts,
  Panics for reachable panic conditions, Safety for caller obligations and Examples for
  nontrivial usage. The crate's missing_docs lint is enabled and clean.
- Run cargo doc --no-deps and cargo test --doc. Intra-doc links resolve; examples compile
  and run unless no_run/ignore has a stated environmental reason. Record every exclusion.
- Compare README install commands, versions and features with crate docs and examples;
  validate changed mdBook content with its project build command. Describe the API that
  exists; logic changes are a separate implementation scope.
- Run `bun "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/prose-gate.ts" --rustdoc <files>` for touched
  rustdoc, and the prose gate for edited Markdown. Carry its findings and fix guidance into
  the report; keep prose findings distinct from correctness/contract gaps.

API-GATE requires complete public docs, appropriate sections, passing doc-tests and resolved
links. RELEASE-GATE additionally requires README/crate docs agreement, a changelog entry and
compiling examples. Authorship supplies artifacts and check output; independent sign-off
must come from a different reviewer/verifier instance.
