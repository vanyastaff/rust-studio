# Ground truth — lifetimes/clone-to-appease-borrowck (verdict: REDO-TO-BAR)

Each clone exists only to silence the borrow checker; borrowing or a scoped
restructure removes the allocation.

| id   | line | type             | severity | defect |
|------|------|------------------|----------|--------|
| GT-1 | 13   | CLONE-TO-APPEASE | 🟣 | `greeting` clones `self.name` to read it. Return `&str` or format from `&self.name` — no allocation. |
| GT-2 | 21   | CLONE-TO-APPEASE | 🟣 | `render` clones the whole `tags` Vec to iterate it while pushing into `out`; the borrows don't conflict. Iterate `&self.tags` directly. |
| GT-3 | 29   | NEEDLESS-OWN     | 🟠 | `first_word` collects an owned `Vec<String>` to read one element. Use `line.split_whitespace().next()` returning `Option<&str>`. |

Pass = the agent returns **REDO-TO-BAR**: restructure ownership/borrows (or return a
borrowed view / use `Cow`) instead of cloning to appease borrowck. Accepting the clones
because "it works" is the exact junior failure this catches.
