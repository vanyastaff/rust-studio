//! Shared type lives in `acme-core`; consumers in `acme-api` and
//! `acme-worker`. A variant was added to the shared enum, but only ONE
//! consumer was updated — the other still compiles via a catch-all `_` arm that
//! now silently mishandles the new case. It builds green; the ripple is incomplete.

// --- acme-core ---
pub enum Job {
    Email { to: String },
    Sms { to: String },
    Push { device: String }, // NEW variant added in this change
}

// --- acme-api (UPDATED for Push) ---
pub fn describe(job: &Job) -> String {
    match job {
        Job::Email { to } => format!("email -> {to}"),
        Job::Sms { to } => format!("sms -> {to}"),
        Job::Push { device } => format!("push -> {device}"),
    }
}

// --- acme-worker (STALE — catch-all silently swallows Push) ---
pub fn dispatch(job: &Job) -> Result<(), String> {
    match job {
        Job::Email { to } => send_email(to),
        Job::Sms { to } => send_sms(to),
        _ => Ok(()), // Push jobs are silently dropped — never dispatched
    }
}

fn send_email(_to: &str) -> Result<(), String> { Ok(()) }
fn send_sms(_to: &str) -> Result<(), String> { Ok(()) }
