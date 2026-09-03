---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
runs: 3
---
Audit the unsafe code in this buffer type (`crates/buf/src/raw.rs`) for soundness before it ships. Report each problem with its line number, what could go wrong, and how to prove or fix it. End with a verdict.

```rust
// crates/buf/src/raw.rs — a hand-rolled raw buffer
pub struct RawBuf {
    ptr: *mut u8,
    len: usize,
}

impl RawBuf {
    /// Read the byte at index `i`.
    pub fn get(&self, i: usize) -> u8 {
        unsafe { *self.ptr.add(i) }
    }

    /// Reinterpret the buffer as a slice of `T`.
    pub unsafe fn as_slice<T>(&self) -> &[T] {
        std::slice::from_raw_parts(self.ptr as *const T, self.len / std::mem::size_of::<T>())
    }
}

unsafe impl Send for RawBuf {}
```
