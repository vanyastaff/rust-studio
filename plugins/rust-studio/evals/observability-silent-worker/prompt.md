---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
This settlement worker in `src/workers/settle.rs` 'works', but when it fails in production nobody can tell why from the logs. Review its observability and diagnostics; list findings with line numbers and end with a verdict.

```rust
//! crate: `acme-billing` — `src/workers/settle.rs`, the background job that settles invoices.
//! It runs in production and "works"; when it doesn't, nobody can tell why from the logs.
//! Every defect below is one `rules/observability.md` names.

use std::time::Duration;

pub enum State {
    Pending,
    Charging,
    Settled,
    Failed,
}

pub struct Job {
    pub invoice_id: u64,
    pub customer_email: String,
    pub card_token: String,
    pub state: State,
}

pub struct Settler {
    gateway: Gateway,
}

impl Settler {
    pub async fn run(&self, job: &mut Job) {
        job.state = State::Charging;
        let mut attempt = 0;
        loop {
            match self.gateway.charge(&job.card_token).await {
                Ok(_) => {
                    job.state = State::Settled;
                    println!("settled invoice {} for {} with card {}", job.invoice_id, job.customer_email, job.card_token);
                    return;
                }
                Err(e) if attempt < 5 => {
                    attempt += 1;
                    let _ = e;
                    tokio::time::sleep(Duration::from_millis(100 * attempt)).await;
                }
                Err(_) => {
                    job.state = State::Failed;
                    return;
                }
            }
        }
    }

    /// Invariant: a job is only ever settled once (the gateway is not idempotent).
    pub async fn settle_all(&self, jobs: &mut [Job]) {
        for job in jobs.iter_mut() {
            if let State::Pending = job.state {
                self.run(job).await;
            }
        }
    }
}

pub struct Gateway;
impl Gateway {
    pub async fn charge(&self, _card_token: &str) -> Result<(), GatewayError> {
        Ok(())
    }
}

#[derive(Debug)]
pub struct GatewayError(pub String);
```
