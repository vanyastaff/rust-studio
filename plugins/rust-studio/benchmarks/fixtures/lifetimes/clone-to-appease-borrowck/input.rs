//! crate: `nebula-parser`. Clones added purely to silence the borrow checker
//! where borrowing or a scoped restructure would compile. Each clone is a heap
//! copy the design does not need.

pub struct Session {
    name: String,
    tags: Vec<String>,
}

impl Session {
    /// Clones `name` just to read it — a borrowed `&str` return (or formatting
    /// straight from `&self.name`) needs no allocation.
    pub fn greeting(&self) -> String {
        let n = self.name.clone();
        format!("hello {n}")
    }

    /// Clones the whole Vec to iterate it while pushing into a separate buffer;
    /// the borrows don't actually conflict — iterate `&self.tags` directly.
    pub fn render(&self, out: &mut Vec<String>) {
        let tags = self.tags.clone();
        for t in tags {
            out.push(format!("#{t}"));
        }
    }
}

/// Collects into an owned `Vec<String>` only to read the first element.
pub fn first_word(line: &str) -> String {
    let words: Vec<String> = line.split_whitespace().map(|s| s.to_owned()).collect();
    words.into_iter().next().unwrap_or_default()
}
