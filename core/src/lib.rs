mod color;
pub mod color_difference;
mod config;
pub mod error;
mod math;
pub mod media;
mod palette;
pub mod palettized;
mod processing;
pub mod smoothed;
pub use config::Config;
pub use error::{Error, Result};
pub use media::{Gif, Ico, Image, Media};
#[cfg(feature = "gpu")]
pub mod gpu;

pub use processing::process_pixels;

pub use palette::{
    create_id, custom_palettes_dir, delete_custom_palette, find_palette, get_all_palettes,
    get_custom_palettes, get_default_palettes, palette_from_file_entry, palette_to_file,
    save_custom_palette, Palette, PaletteKind,
};

#[cfg(feature = "cli")]
use clap::ValueEnum;
#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "cli")]
use strum_macros::Display;
#[cfg(feature = "wasm")]
use tsify::Tsify;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Hash)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "cli", derive(ValueEnum, Display))]
pub enum Mapping {
    Palettized,
    #[default]
    Smoothed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Hash)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi))]
#[cfg_attr(feature = "cli", derive(ValueEnum, Display))]
pub enum Filter {
    Nearest,
    Triangle,
    #[default]
    Lanczos3,
}

impl From<Filter> for ::image::imageops::FilterType {
    fn from(f: Filter) -> Self {
        match f {
            Filter::Nearest => ::image::imageops::FilterType::Nearest,
            Filter::Triangle => ::image::imageops::FilterType::Triangle,
            Filter::Lanczos3 => ::image::imageops::FilterType::Lanczos3,
        }
    }
}

#[cfg(feature = "video")]
pub use ffmpeg_next;
