use cold_handoff::{contains, End, IntRange, RangeError};

fn check(start: i64, end: i64, exclusive: bool, values: &[i64]) {
    let kind = if exclusive { End::Exclusive } else { End::Inclusive };
    let result = IntRange::new(start, end, kind);
    if start > end {
        assert!(matches!(result, Err(RangeError::Inverted)), "inverted {start}..{end}");
        for &value in values {
            assert!(!contains(start, end, value), "legacy inverted membership");
        }
        return;
    }
    let range = match result {
        Ok(range) => range,
        Err(_) => panic!("valid range rejected: {start}..{end}, exclusive={exclusive}"),
    };
    assert_eq!(range.is_empty(), exclusive && start == end, "empty {start}..{end}");
    for &value in values {
        let expected = start <= value && if exclusive { value < end } else { value <= end };
        assert_eq!(range.contains(value), expected, "membership {start}..{end} value={value} exclusive={exclusive}");
        assert_eq!(contains(start, end, value), start <= value && value <= end, "legacy inclusive");
    }
}

fn main() {
    let values = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    for start in -3..=3 {
        for end in -3..=3 {
            for exclusive in [false, true] {
                check(start, end, exclusive, &values);
            }
        }
    }
    let extremes = [i64::MIN, i64::MIN + 1, -1, 0, 1, i64::MAX - 1, i64::MAX];
    for start in extremes {
        for end in extremes {
            for exclusive in [false, true] {
                check(start, end, exclusive, &extremes);
            }
        }
    }
    println!("private library probe passed: exhaustive small ranges, extremes, amendment, legacy");
}
