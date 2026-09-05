//! Fixed-width codecs, stamped out by a macro. A grep for `impl Codec` will not find these.

/// Defines a codec that pads or truncates every input to `$width` bytes.
macro_rules! fixed_width_codec {
    ($name:ident, $label:literal, $width:expr) => {
        #[doc = concat!("Pads or truncates input to ", stringify!($width), " bytes.")]
        #[derive(Debug, Default, Clone, Copy)]
        pub struct $name;

        impl $crate::codec::Codec for $name {
            fn name(&self) -> &'static str {
                $label
            }

            fn encode(&self, input: &[u8]) -> Vec<u8> {
                let mut out = input.to_vec();
                out.resize($width, 0);
                out
            }

            fn decode(&self, input: &[u8]) -> Result<Vec<u8>, $crate::codec::DecodeError> {
                if input.len() != $width {
                    return Err($crate::codec::DecodeError { offset: input.len().min($width) });
                }
                let end = input.iter().rposition(|b| *b != 0).map_or(0, |i| i + 1);
                Ok(input[..end].to_vec())
            }
        }
    };
}

fixed_width_codec!(Compact8, "compact8", 8);
fixed_width_codec!(Compact16, "compact16", 16);
