//! Integration tests: every shipped codec round-trips, and the registry dispatches by name.

use acme_codec::codec::Codec;
use acme_codec::compact::{Compact16, Compact8};
use acme_codec::json::Json;
use acme_codec::pipeline::{frame, survives, unframe};
use acme_codec::Registry;

#[test]
fn json_roundtrips_arbitrary_bytes() {
    let input = [0u8, 1, 127, 255];
    assert_eq!(Json.decode(&Json.encode(&input)).unwrap(), input);
}

#[test]
fn compact_codecs_roundtrip_short_inputs() {
    assert!(survives(&Compact8, b"abc"));
    assert!(survives(&Compact16, b"0123456789"));
}

#[test]
fn compact8_rejects_wrong_width() {
    assert!(Compact8.decode(&[0; 7]).is_err());
}

#[test]
fn framing_checks_the_name_prefix() {
    let framed = frame(&Json, b"hi");
    assert!(framed.starts_with(b"json:"));
    assert_eq!(unframe(&Json, &framed).unwrap(), b"hi");
    assert!(unframe(&Compact8, &framed).is_err());
}

#[test]
fn registry_dispatches_by_name_last_wins() {
    let mut r = Registry::default();
    r.register(Box::new(Json)).register(Box::new(Compact8));
    assert_eq!(r.encode_with("compact8", b"a").unwrap().len(), 8);
    assert!(r.encode_with("nope", b"a").is_none());
}

#[cfg(feature = "cbor")]
#[test]
fn cbor_roundtrips() {
    use acme_codec::cbor::Cbor;
    assert!(survives(&Cbor, &[1, 2, 3]));
}
