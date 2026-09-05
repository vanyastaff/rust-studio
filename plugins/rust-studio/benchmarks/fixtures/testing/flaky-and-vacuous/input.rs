//! crate: `acme-queue` — `tests/queue.rs`. CI is green about nine runs in ten. Every defect
//! below is one `rules/testing.md` names; the code under test is fine.

use acme_queue::{Queue, Worker};
use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;
use std::time::Duration;

static PROCESSED: AtomicUsize = AtomicUsize::new(0);

#[test]
fn test1() {
    let q = Queue::new();
    q.push(1);
    assert!(q.pop().is_some());
}

#[test]
fn worker_drains_queue() {
    let q = Queue::new();
    for i in 0..100 {
        q.push(i);
    }
    let w = Worker::start(q.clone(), |_| {
        PROCESSED.fetch_add(1, Ordering::SeqCst);
    });
    thread::sleep(Duration::from_millis(200));
    assert_eq!(PROCESSED.load(Ordering::SeqCst), 100);
    drop(w);
}

#[test]
fn counter_starts_where_the_other_test_left_it() {
    // Relies on worker_drains_queue having run first.
    assert!(PROCESSED.load(Ordering::SeqCst) >= 100);
}

#[test]
fn listens_on_the_metrics_port() {
    let listener = TcpListener::bind("127.0.0.1:9090").unwrap();
    let addr = listener.local_addr().unwrap();
    assert_eq!(addr.port(), 9090);
}

#[test]
fn fetches_the_schema_from_upstream() {
    let body = reqwest::blocking::get("https://schema.acme.example/queue/v1.json").unwrap().text().unwrap();
    assert!(body.contains("queue"));
}

#[test]
fn roundtrip() {
    let q = Queue::new();
    q.push(7);
    let got = q.pop().unwrap();
    assert_eq!(got, got);
}

#[test]
#[ignore]
fn ordering_is_fifo() {
    let q = Queue::new();
    q.push(1);
    q.push(2);
    assert_eq!(q.pop(), Some(1));
    assert_eq!(q.pop(), Some(2));
}

#[tokio::test]
async fn retries_after_backoff() {
    let q = Queue::new();
    q.push_with_delay(1, Duration::from_secs(2)).await;
    tokio::time::sleep(Duration::from_millis(2100)).await;
    assert_eq!(q.pop(), Some(1));
}
