use std::fmt;
use std::time::Duration;

/// A request limit: at most `count` requests per `window`.
///
/// ```
/// use acme_limits::Limit;
/// let l = Limit::per_second(10);
/// assert_eq!(l.count(), 10);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limit {
    count: u32,
    window: Duration,
}

impl Limit {
    /// `count` requests per second.
    pub fn per_second(count: u32) -> Self {
        Self { count, window: Duration::from_secs(1) }
    }

    /// `count` requests per `window`.
    pub fn per(count: u32, window: Duration) -> Self {
        Self { count, window }
    }

    /// The request count.
    pub fn count(&self) -> u32 {
        self.count
    }

    /// The window length.
    pub fn window(&self) -> Duration {
        self.window
    }

    /// Requests per second, see [`Limit::max`] for the raw count.
    pub fn rate(&self) -> f64 {
        f64::from(self.count) / self.window.as_secs_f64()
    }

    /// Splits the limit evenly across `shards` workers.
    pub fn per_shard(&self, shards: u32) -> Self {
        Self { count: self.count / shards, window: self.window }
    }

    /// Builds a limit with the process-wide default window.
    ///
    /// ```
    /// use acme_limits::Limit;
    /// let l = Limit::with_default_window(5);
    /// assert_eq!(l.window(), acme_limits::default_window());
    /// ```
    pub fn with_default_window(count: u32) -> Self {
        Self { count, window: default_window() }
    }
}

fn default_window() -> Duration {
    Duration::from_secs(1)
}

/// Why a limit string did not parse.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseLimitError {
    MissingSlash,
    BadCount(String),
    BadUnit(String),
}

impl fmt::Display for ParseLimitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingSlash => write!(f, "expected `<count>/<unit>`"),
            Self::BadCount(s) => write!(f, "bad count `{s}`"),
            Self::BadUnit(s) => write!(f, "bad unit `{s}`; expected s, m or h"),
        }
    }
}

impl std::error::Error for ParseLimitError {}

/// Parses `"<count>/<unit>"`, e.g. `"10/s"`, `"600/m"`, `"1000/h"`.
///
/// ```
/// use acme_limits::parse_limit;
/// assert_eq!(parse_limit("10/s").unwrap().count(), 10);
/// ```
pub fn parse_limit(s: &str) -> Result<Limit, ParseLimitError> {
    let (count, unit) = s.split_once('/').ok_or(ParseLimitError::MissingSlash)?;
    let count: u32 = count.trim().parse().map_err(|_| ParseLimitError::BadCount(count.to_string()))?;
    let window = match unit.trim() {
        "s" => Duration::from_secs(1),
        "m" => Duration::from_secs(60),
        "h" => Duration::from_secs(3600),
        other => return Err(ParseLimitError::BadUnit(other.to_string())),
    };
    Ok(Limit { count, window })
}

/// Fetches the limit the control plane publishes for `service`.
///
/// ```
/// let limit = acme_limits::fetch_remote_limit("https://control.internal/limits/api").unwrap();
/// assert!(limit.count() > 0);
/// ```
pub fn fetch_remote_limit(url: &str) -> Result<Limit, ParseLimitError> {
    let body = std::fs::read_to_string(url).map_err(|e| ParseLimitError::BadUnit(e.to_string()))?;
    parse_limit(body.trim())
}

/// Reads a limit from a raw pointer to a NUL-terminated `<count>/<unit>` string.
pub unsafe fn parse_limit_ptr(ptr: *const u8) -> Result<Limit, ParseLimitError> {
    let c = unsafe { std::ffi::CStr::from_ptr(ptr.cast()) };
    parse_limit(c.to_str().map_err(|_| ParseLimitError::MissingSlash)?)
}

pub struct Bucket {
    pub limit: Limit,
    pub remaining: u32,
}

impl Bucket {
    /// A full bucket for `limit`.
    pub fn new(limit: Limit) -> Self {
        Self { limit, remaining: limit.count }
    }

    /// Takes one token; `true` if one was available.
    pub fn take(&mut self) -> bool {
        if self.remaining == 0 {
            return false;
        }
        self.remaining -= 1;
        true
    }
}
