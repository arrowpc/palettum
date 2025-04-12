use image::Rgb;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PalettumError {
    #[error("Palette cannot be empty for this operation.")]
    EmptyPalette,
    #[error("RGB palette size ({0}) and Lab palette size ({1}) mismatch.")]
    PaletteSizeMismatch(usize, usize),
    #[error("Configuration requires palettized output, but palette is empty.")]
    ValidationPaletteEmpty,
    #[error("Validation failed: Pixel {0:?} at ({1}, {2}) is not in the configured palette.")]
    ValidationPixelNotInPalette(Rgb<u8>, u32, u32),
    #[error("Validation requires a palettized mapping type.")]
    ValidationInvalidMapping,
    #[error("GIF processing requires a palettized mapping type when saving with limited palette.")]
    GifRequiresPalettized,
    #[error("GIF palette size ({0}) exceeds the maximum of 256 colors.")]
    GifPaletteTooLarge(usize),
    #[error("Lookup table index {0} out of bounds (size: {1}).")]
    LutIndexOutOfBounds(usize, usize),
    #[error("Failed to build thread pool: {0}")]
    ThreadPoolBuildError(String),
    #[error("Image processing error: {0}")]
    ImageError(#[from] image::ImageError),
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Unsupported image format or color type for direct processing.")]
    UnsupportedFormat,
    #[error("WASM specific error: {0}")]
    WasmError(String),
}

impl From<String> for PalettumError {
    fn from(s: String) -> Self {
        PalettumError::WasmError(s)
    }
}

#[cfg(feature = "wasm")]
impl From<wasm_bindgen::JsValue> for PalettumError {
    fn from(js_err: wasm_bindgen::JsValue) -> Self {
        PalettumError::WasmError(format!("{:?}", js_err))
    }
}
