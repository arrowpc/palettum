use thiserror::Error;

#[derive(Debug, Error)]
pub enum Errors {
    #[error("Failed to load image: {0}")]
    ImageLoad(#[from] image::ImageError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

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
}
