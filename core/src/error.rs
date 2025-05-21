use std::path::PathBuf;

use thiserror::Error as ThisError;

#[derive(Debug, ThisError)]
pub enum Error {
    #[error("Failed to load image: {0}")]
    ImageLoad(#[from] image::ImageError),

    #[error("Failed to write image")]
    ImageWritingError,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("File extension already supplied: {0}")]
    FileExtensionAlreadySupplied(PathBuf),

    #[error("Thread pool creation failed: {0}")]
    ThreadPool(#[from] rayon::ThreadPoolBuildError),

    #[error("LUT index {index} out of bounds (size {size})")]
    LutIndexOutOfBounds { index: usize, size: usize },

    #[error("Not a valid GIF file")]
    InvalidGifFile,

    #[error("Empty palette: at least one color is required")]
    EmptyPalette,

    #[error("Invalid quant_level: must be between 0 (to disable) and {max}, got {value}")]
    InvalidQuantLevel { value: u8, max: u8 },

    #[error("Invalid smoothing_strength: must be between 0.0 and 1.0, got {0}")]
    InvalidsmoothingStrength(f32),

    #[error("Invalid lab_scales: scale values must be positive")]
    InvalidLabScales,

    #[error("Invalid resize dimensions: width and height must be positive")]
    InvalidResizeDimensions,

    #[error("Invalid resize scale: Scale factor must be positive")]
    InvalidResizeScale,

    #[error(
        "Invalid thread count: Specifying more threads than available CPU cores ({0}) is redundant"
    )]
    InvalidThreadCount(usize),

    #[error("Invalid filename (could not extract file stem)")]
    InvalidFilename,

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Missing required field in palette data: '{0}'")]
    MissingField(&'static str),

    #[error("Invalid data format: {0}")]
    InvalidDataFormat(String),

    #[error("Path contains invalid UTF-8 characters")]
    InvalidPathUtf8,

    #[error("Palette '{0}' not found by ID, name, or path")]
    PaletteNotFound(String),

    #[error("Cannot override default palette: '{0}'")]
    CannotOverrideDefault(String),

    #[error("Custom palette already exists at {0}")]
    CustomPaletteExists(PathBuf),

    #[error("Could not determine the custom palettes directory")]
    CannotDetermineCustomDir,

    #[error("Invalid path for saving palette")]
    InvalidSavePath,

    #[error("Logger error: `{0}`")]
    LoggerError(String),

    #[error("{0}")]
    ParseError(String),
}

/// Result type of the core library.
pub type Result<T> = core::result::Result<T, Error>;
