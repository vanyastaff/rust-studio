//! crate: `acme-codec-sys` — `src/ffi.rs`, the C API exported for the Python and Go
//! bindings. Edition 2024, `panic = "unwind"` (the default profile). It links and the smoke
//! test passes. Every defect below is one `rules/ffi.md` or `rules/unsafe.md` names.

use std::ffi::{c_char, c_int, CStr, CString};

/// Status codes shared with the C header.
#[repr(u32)]
pub enum Status {
    Ok = 0,
    InvalidInput = 1,
    Internal = 2,
}

pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

extern "C" {
    fn acme_log(msg: *const c_char);
    fn acme_status_from_c() -> u32;
}

#[no_mangle]
pub extern "C" fn acme_decode(input: *const c_char, out_len: *mut usize) -> *mut Frame {
    let s = unsafe { CStr::from_ptr(input) }.to_str().unwrap();
    let frame = decode(s).expect("decoder never fails on valid input");
    unsafe { *out_len = frame.data.len() };
    Box::into_raw(Box::new(frame))
}

#[no_mangle]
pub extern "C" fn acme_last_status() -> Status {
    let raw = unsafe { acme_status_from_c() };
    unsafe { std::mem::transmute::<u32, Status>(raw) }
}

#[no_mangle]
pub extern "C" fn acme_describe(frame: *const Frame) -> *const c_char {
    let frame = unsafe { &*frame };
    let text = format!("{}x{}", frame.width, frame.height);
    let log_line = CString::new(text.clone()).unwrap().as_ptr();
    unsafe { acme_log(log_line) };
    CString::new(text).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn acme_frame_len(frame: *const Frame) -> c_int {
    unsafe { (*frame).data.len() as c_int }
}

fn decode(_s: &str) -> Result<Frame, String> {
    Ok(Frame { width: 1, height: 1, data: vec![0] })
}
