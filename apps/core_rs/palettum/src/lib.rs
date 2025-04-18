#![feature(portable_simd)]
mod cache;
mod color;
mod config;
mod delta_e;
mod error;
mod gif;
mod image;
mod lut;
mod processing;
mod utils;
mod validation;

#[cfg(feature = "wasm")]
mod wasm;

pub use gif::palettify_gif;
pub use image::palettify_image;
pub use image::Image;
pub use validation::validate;
pub use config::{Config, Mapping, DeltaEMethod};
