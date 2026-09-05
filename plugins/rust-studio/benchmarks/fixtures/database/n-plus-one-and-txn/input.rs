//! crate: `acme-orders` — `src/db/repository.rs` (sqlx + Postgres). Every query returns the
//! right rows in the test database. Every defect below is one `rules/database.md` names, and
//! each surfaces only under load or hostile input.

use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};

pub struct Order {
    pub id: i64,
    pub customer_id: i64,
    pub total: f64,
    pub note: String,
}

pub struct OrderRepo;

impl OrderRepo {
    async fn pool(&self) -> Result<PgPool, sqlx::Error> {
        PgPoolOptions::new().max_connections(500).connect("postgres://app@db/orders").await
    }

    pub async fn list_sorted(&self, customer_id: i64, sort_by: &str) -> Result<Vec<Order>, sqlx::Error> {
        let pool = self.pool().await?;
        let sql = format!("SELECT id, customer_id, total, note FROM orders WHERE customer_id = $1 ORDER BY {sort_by}");
        let rows = sqlx::query(&sql).bind(customer_id).fetch_all(&pool).await?;
        let mut out = Vec::new();
        for row in rows {
            let id: i64 = row.get("id");
            let lines = sqlx::query("SELECT count(*) FROM order_lines WHERE order_id = $1").bind(id).fetch_one(&pool).await?;
            let _n: i64 = lines.get(0);
            out.push(Order { id, customer_id: row.get("customer_id"), total: row.get("total"), note: row.get::<Option<String>, _>("note").unwrap() });
        }
        Ok(out)
    }

    pub async fn search(&self, pool: &PgPool, term: &str) -> Result<Vec<i64>, sqlx::Error> {
        let pattern = format!("%{term}%");
        let rows = sqlx::query("SELECT id FROM orders WHERE note LIKE $1").bind(pattern).fetch_all(pool).await?;
        Ok(rows.iter().map(|r| r.get("id")).collect())
    }

    pub async fn transfer(&self, pool: &PgPool, from: i64, to: i64, amount: f64) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;
        sqlx::query("UPDATE accounts SET balance = balance - $1 WHERE id = $2").bind(amount).bind(from).execute(&mut *tx).await?;
        let receipt = reqwest::get(format!("https://ledger.acme.example/notify/{to}")).await;
        let _ = receipt;
        sqlx::query("UPDATE accounts SET balance = balance + $1 WHERE id = $2").bind(amount).bind(to).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(())
    }
}
