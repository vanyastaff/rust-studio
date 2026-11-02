# HTTP services

Use for axum/actix handlers, extractors, routing, Tower layers and shared application state.
Read `references/async.md` and `references/security.md`;
load `async.md` for ASYNC-GATE and `data.md` for persistence.

- Validate hostile Json/Path/Query/custom extractor input at extraction. Check extraction
  order and rejection mappings, including 400/422 and authentication/authorization 401/403.
- Trace actual middleware execution order through nesting and ServiceBuilder wrapping:
  authentication precedes authorization and business logic; rate/body limits protect work.
  Verify fallback routes, method filters and each layer's coverage rather than trusting
  declaration order. Security/resource limits must also cover rejected requests as intended.
- Shared state meets the framework's Clone/Send/Sync/'static bounds; use FromRef or equivalent
  sub-state when a handler needs one component. Preserve ownership rather than cloning all state.
- IntoResponse maps typed errors to appropriate status codes without unwrap or internal
  diagnostic disclosure. Apply request deadlines and body limits at service/router boundaries.
- Check cancellation-safe middleware, handler blocking and error-path observability. Exercise
  changed routes through the public service with the project lint/test gate.

Report route/layer findings and check output as ASYNC-GATE evidence; state uncovered routes.
