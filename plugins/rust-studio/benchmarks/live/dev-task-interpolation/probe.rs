use kvconf::{Config, ParseError};
fn main() {
    let c = Config::parse("A=1\nB=${A}${A}\nC=$$\nD=x${A}y").expect("valid input parses");
    assert_eq!(c.get("B"), Some("11"));
    assert_eq!(c.get("C"), Some("$"));
    assert_eq!(c.get("D"), Some("x1y"));
    assert_eq!(Config::parse("B=${A}\nA=1").expect_err("forward reference"), ParseError::UnknownReference { line: 1, name: "A".into() });
    assert_eq!(Config::parse("A=1\nB=${A").expect_err("unterminated"), ParseError::UnterminatedReference { line: 2 });
    assert_eq!(Config::parse("oops").expect_err("missing equals"), ParseError::MissingEquals { line: 1 });
    assert_eq!(Config::parse("# c\nA = 1\n\nB=two").expect("existing behavior").get("B"), Some("two"));
    println!("probe ok");
}
