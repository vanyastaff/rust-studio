// crates/wire/src/frame.rs — decode fixed-layout frames coming off an FFI device
use std::mem::{self, MaybeUninit};

/// A packed on-wire header. The device sends fields back-to-back, no padding.
#[repr(packed)]
pub struct Header {
    tag: u8,
    field: u32,
    flags: u16,
}

impl Header {
    /// Borrow the 32-bit field for hashing.
    pub fn field_ref(&self) -> &u32 {
        let p = self;
        let r: &u32 = &p.field;
        r
    }
}

/// Device status, mirrored 1:1 from the C `enum status_t`.
#[repr(u8)]
pub enum Status {
    Ok = 0,
    Busy = 1,
}

/// Turn a raw status byte handed back from the C driver into a `Status`.
pub fn status_from_ffi(byte: u8) -> Status {
    unsafe { mem::transmute::<u8, Status>(byte) }
}

/// Seed an accumulator before the decode loop fills it in.
pub fn fresh_accumulator() -> i32 {
    let cell = MaybeUninit::<i32>::uninit();
    let seed = unsafe { cell.assume_init() };
    seed
}

/// Owns a device-mapped register page handed to us as a raw pointer.
pub struct Device {
    regs: *mut u8,
    len: usize,
}

unsafe impl Send for Device {}

impl Device {
    pub fn new(regs: *mut u8, len: usize) -> Self {
        Self { regs, len }
    }
}
