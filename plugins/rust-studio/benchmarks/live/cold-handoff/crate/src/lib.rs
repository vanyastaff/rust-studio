//! Inclusive integer membership used by the range-check CLI.

/// Whether `value` lies between the inclusive endpoints.
pub fn contains(start: i64, end: i64, value: i64) -> bool {
    start <= value && value <= end
}

#[cfg(test)]
mod tests {
    #[test]
    fn legacy_membership() {
        assert!(super::contains(2, 4, 2));
        assert!(super::contains(2, 4, 4));
        assert!(!super::contains(2, 4, 5));
        assert!(!super::contains(4, 2, 3));
    }
}
