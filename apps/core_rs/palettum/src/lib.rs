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

pub use config::{Config, DeltaEMethod, Mapping, WeightingKernelType};
pub use gif::palettify_gif;
pub use gif::Gif;
pub use image::palettify_image;
pub use image::Image;
pub use validation::validate;
