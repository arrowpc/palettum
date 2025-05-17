mod color;
mod config;
mod gif;
mod image;
mod math;
mod processing;

pub mod utils;
pub mod palettized;
pub mod smoothed;
pub mod error;

pub use config::{Config, Mapping, Palette, Filter, PaletteKind};
pub use gif::Gif;
pub use image::Image;
