# Observability

Use for tracing, structured events, metrics and OpenTelemetry. Read
`${CLAUDE_PLUGIN_ROOT}/rules/observability.md` and `${CLAUDE_PLUGIN_ROOT}/rules/async.md`.

Inventory entry points, error paths and exporter setup. Define span hierarchy, meaningful
fields, levels and correlation propagation across task boundaries. Instrument async futures;
holding Span::enter across an await can attach unrelated work to the span.

Use skip/explicit fields to exclude secrets and PII, including values exposed indirectly
through Debug. Credentials, tokens, email addresses and request bodies do not belong in
events. Counter/gauge/histogram labels have bounded cardinality; user-controlled values must
not create unbounded dimensions. Record failures and error status at the responsible boundary
without losing the source context or flooding duplicate events.

Specify exporter configuration, traceparent propagation, resource attributes and sampling;
retention/backend changes are explicit design decisions. Verify exporter initialization and
show a sample span tree/event with correlation IDs, plus project check output. For hot-path
instrumentation costs load `performance.md`. Observability evidence contributes to ASYNC-GATE.
