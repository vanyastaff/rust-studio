# Navigation

Resolve definitions, callers, implementations, re-exports, features and test locations for
the requested symbols. Use the available language server for semantic relationships, then
`rg` for macro-generated and cfg-gated sites; if the semantic tool is unavailable, use the
text fallback and state the coverage limit. Cargo metadata, tree and module queries establish
workspace boundaries. Read recalled decision notes first and verify their current anchors.

Return a compact `file:line` map grouped by definitions, callers, trait implementations,
tests and feature conditions. Distinguish a located symbol from a body actually read.
State unresolved targets and unexamined consumers; a navigation map is not a design or
correctness verdict. For tool selection read `${CLAUDE_PLUGIN_ROOT}/docs/tooling.md`.
