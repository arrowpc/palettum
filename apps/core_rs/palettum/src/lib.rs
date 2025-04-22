mod color;
mod config;
mod delta_e;
mod gif;
mod image;
mod lut;
mod processing;
mod utils;

#[cfg(feature = "wasm")]
mod wasm;

pub use config::{Config, DeltaEMethod, Mapping, WeightingKernelType};
pub use gif::palettify_gif;
pub use gif::Gif;
pub use image::palettify_image;
pub use image::Image;
