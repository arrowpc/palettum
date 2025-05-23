mod color;
mod config;
mod math;
mod palette;
pub mod palettized;
mod processing;
pub mod smoothed;

pub mod error;
pub mod media;
pub use config::Config;
pub use error::{Error, Result};
pub use media::{Gif, Ico, Image, Media};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "cli", derive(ValueEnum, Display))]
pub enum Mapping {
    Palettized,
    #[default]
    Smoothed,
    SmoothedPalettized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "cli", derive(ValueEnum, Display))]
pub enum Filter {
    Nearest,
    Triangle,
    CatmullRom,
    Gaussian,
    #[default]
    Lanczos3,
}

impl From<Filter> for ::image::imageops::FilterType {
    fn from(f: Filter) -> Self {
        match f {
            Filter::Nearest => ::image::imageops::FilterType::Nearest,
            Filter::Triangle => ::image::imageops::FilterType::Triangle,
            Filter::CatmullRom => ::image::imageops::FilterType::CatmullRom,
            Filter::Gaussian => ::image::imageops::FilterType::Gaussian,
            Filter::Lanczos3 => ::image::imageops::FilterType::Lanczos3,
        }
    }
}
