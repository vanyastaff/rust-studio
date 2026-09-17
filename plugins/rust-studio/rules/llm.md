---
name: llm
paths: "**/llm/**/*.rs,**/agents.rs,**/prompts/**/*.rs,**/prompt/**/*.rs,**/agents/**/*.rs,**/agent/**/*.rs,**/ai/**/*.rs,**/*prompt*.rs,**/*llm*.rs,**/*completion*.rs"
description: LLM-integration standards — typed decisions inside deterministic Rust
---

# LLM Integration Standards

Applies to code that calls a language model: prompt construction, response parsing, the
decision points a model answer feeds, and the flows built around them. Owned by
`api-designer` (the decision types) with `security-auditor` on the trust boundary;
`error-architect` owns the retry taxonomy and `slop-auditor` flags the untyped call.

The shape this rule enforces: **deterministic Rust owns the control flow; the model answers
one typed question at a time.** A model call is a function from a typed question to a typed
decision. The `match` on that decision, the thresholds, the permissions and every side effect
live in code the compiler checks and a test can pin. The prompt never carries a branch table.

## The decision surface is a type (REQUIRED)
- Every model call returns a closed Rust type (an `enum` for a choice, a struct for an
  extraction, a bounded newtype for a score), deserialized through serde against a schema the
  provider is given: structured output, JSON mode, or a tool call. Free text is a return type
  only where a human reads it as prose.
- Model the answer set before writing the prompt: `enum Route { Billing, Support, Sales }`
  first, the question second. A `String` the code then compares against literals is the
  stringly drift `types.md` names, with a model on the other end of it.
- Carry the model's confidence as a field the caller can branch on; the threshold is a named
  `const` or a config value in Rust, decided once and tested once.
- A parse failure is a typed error (`LlmError::Malformed { raw, source }`). `unwrap_or_default()`
  on a model response turns a bad answer into a plausible one — the defect the type exists to
  stop.

## Control flow stays in Rust
- Branch on the typed decision with an exhaustive `match`. Mark the enum `#[non_exhaustive]`
  only when the model may legitimately answer outside the closed set, and then the `_` arm is
  a logged, typed outcome — not a slide into a real branch.
- A multi-step flow is a state machine (typestate, or `statig` for event-driven flows) with
  the model consulted at a node. The state is serializable, so a crash, a retry or a replay
  resumes from it, and a side effect a step already performed is recorded before the next step
  starts and is not performed again. "Ask the model what to do next" in a loop with no state
  the code can inspect is the shape this rule replaces.
- Tools the model may request come from a closed allow-list the code owns; the arguments are
  validated as untrusted input before anything runs (`security.md`).

## Prompts are code
- Prompt text lives in the repository, versioned beside the parser of its answer, as a
  `const`/template in the module or a file pulled in with `include_str!`. It is assembled in
  one place, so a prompt change is a diff a reviewer reads.
- User-supplied and third-party text enters a prompt through one boundary that delimits it as
  data; `format!` on a raw string is not that boundary. The model must be able to tell
  instruction from material (`${CLAUDE_PLUGIN_ROOT}/docs/untrusted-context.md`).
- Every prompt has two tests: a snapshot of the rendered text on a fixed fixture, and a parser
  test on recorded real responses, including a malformed one. Live model calls are integration
  tests behind a feature or env gate; a unit test never reaches the network.

## Budgets, retries, errors
- Every call carries a timeout, a token budget and a retry budget, enforced by the client type
  so a caller cannot forget one. A retry on a malformed answer feeds the validation error back
  to the model once or twice and then surfaces `LlmError` — bounded, not a loop.
- Classify errors by what the caller can do (`${CLAUDE_PLUGIN_ROOT}/rules/error-model.md`):
  `RateLimited`/`Timeout` retry with backoff, `Malformed` retries with feedback,
  `Refused`/`ContentFilter`/`Budget` are terminal. Provider error types stay behind the
  crate's own error.
- A call that triggers a side effect (send, charge, write) carries an idempotency key the code
  generates, so a retry cannot double the effect.

## Trust boundary (REQUIRED)
- Model output is untrusted input, exactly like a request body: validate before acting, and
  nothing in it reaches `Command`, a query, a file path or another prompt unchecked.
- Secrets and PII stay out of prompts and logs unless the feature requires them and the ADR
  says so; redact at the boundary. Log the decision, the confidence and the prompt version
  (`observability.md`), not the raw exchange.

## Testability
- The client sits behind a trait (`async fn decide(&self, q: Question) -> Result<Decision,
  LlmError>`) so the core runs against a fake that returns fixtures. The deterministic part (the
  `match`, the thresholds, the state machine) is tested without a network.
- A characterization test pins each decision the product relies on (recorded input → expected
  typed decision) before the prompt or the model changes; a model swap is then a diff of that
  test's outcomes, not a hope.
