//! kvconf — parse `KEY=value` configuration text.

use std::collections::BTreeMap;

/// A parsed configuration.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Config {
    values: BTreeMap<String, String>,
}

impl Config {
    /// Parse `KEY=value` lines. Blank lines and `#` comments are skipped.
    pub fn parse(text: &str) -> Result<Config, ParseError> {
        let mut values = BTreeMap::new();
        for (index, line) in text.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let (key, value) = line.split_once('=').ok_or(ParseError::MissingEquals { line: index + 1 })?;
            values.insert(key.trim().to_string(), value.trim().to_string());
        }
        Ok(Config { values })
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.values.get(key).map(String::as_str)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    MissingEquals { line: usize },
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::MissingEquals { line } => write!(f, "line {line}: expected KEY=value"),
        }
    }
}
impl std::error::Error for ParseError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_pairs_and_skips_comments() {
        let c = Config::parse("# c\nA = 1\n\nB=two").unwrap();
        assert_eq!(c.get("A"), Some("1"));
        assert_eq!(c.get("B"), Some("two"));
    }

    #[test]
    fn reports_the_line_without_equals() {
        assert_eq!(Config::parse("A=1\noops").unwrap_err(), ParseError::MissingEquals { line: 2 });
    }
}
