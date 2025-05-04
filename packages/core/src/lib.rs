mod color;
mod config;
mod delta_e;
mod gif;
mod image;
mod lut;
mod processing;
mod utils;

pub use config::{Config, DeltaEMethod, Mapping, SmoothingStyle};
pub use gif::palettify_gif;
pub use gif::Gif;
pub use image::palettify_image;
pub use image::Image;
