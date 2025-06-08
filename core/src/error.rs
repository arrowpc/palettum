use std::path::PathBuf;

use thiserror::Error as ThisError;

#[derive(Debug, ThisError)]
pub enum Error {
    #[error("Failed to load image: {0}")]
    ImageLoadError(#[from] image::ImageError),

    #[error("Failed to save image: {0}")]
    ImageSaveError(image::ImageError),

    #[error("PNG encoding or I/O error: {0}")]
    PngEncodingError(#[from] png::EncodingError),

    #[error("FFmpeg error: {0}")]
    FFmpegError(#[from] ffmpeg_next::Error),

    #[error("Video stream not found")]
    StreamNotFound,

    #[error("Media format not supported")]
    UnsupportedFormat,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Thread pool creation failed: {0}")]
    ThreadPool(#[from] rayon::ThreadPoolBuildError),

    #[error("LUT index {index} out of bounds (size {size})")]
    LutIndexOutOfBounds { index: usize, size: usize },

    #[error("Not a valid GIF file")]
    InvalidGifFile,

    #[error(
        "Invalid palette size: must have at least one color and at most {max} colors, got {size}"
    )]
    InvalidPaletteSize { size: usize, max: usize },

    #[error("Invalid quant_level: must be between 0 (to disable) and {max}, got {value}")]
    InvalidQuantLevel { value: u8, max: u8 },

    #[error("Invalid smooth_strength: must be between 0.0 and 1.0, got {0}")]
    InvalidSmoothStrength(f32),

    #[error("Invalid dither_strength: must be between 0.0 and 1.0, got {0}")]
    InvalidDitherStrength(f32),

    #[error("Invalid resize dimensions: width and height must be positive")]
    InvalidResizeDimensions,

    #[error("Invalid resize scale: Scale factor must be positive")]
    InvalidResizeScale,

    #[error(
        "Invalid thread count: Specifying more threads than available CPU cores ({0}) is redundant"
    )]
    InvalidThreadCount(usize),

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Missing required field in palette data: '{0}'")]
    MissingField(&'static str),

    #[error("Cannot override default palette: '{0}'")]
    CannotOverrideDefault(String),

    #[error("Custom palette already exists at {0}")]
    CustomPaletteExists(PathBuf),

    #[error("Could not determine the custom palettes directory")]
    CannotDetermineCustomDir,

    #[error("Invalid path for saving palette")]
    InvalidSavePath,

    #[error("Cannot delete default palette: {0}")]
    DefaultPaletteDeletion(String),

    #[error(
        "Cannot delete palette '{0}' with Unset kind. It might not be a saved custom palette."
    )]
    UnsetPaletteDeletion(String),

    #[error("Invalid input media or color count")]
    InvalidPaletteFromMedia,
}

/// Result type of the core library
pub type Result<T> = core::result::Result<T, Error>;
