mod gif;
mod ico;
mod image;
use ::image::ImageFormat;
pub use gif::Gif;
pub use ico::Ico;
pub use image::Image;

use crate::{
    config::Config,
    error::{Error, Result},
    Filter,
};
use std::path::Path;

pub enum Media {
    Gif(Gif),
    Ico(Ico),
    Image(Image),
}

impl Media {
    pub fn from_file(path: &Path) -> Result<Self> {
        let format = ImageFormat::from_path(path)?;
        match format {
            ImageFormat::Gif => Ok(Media::Gif(Gif::from_file(path)?)),
            ImageFormat::Ico => Ok(Media::Ico(Ico::from_file(path)?)),
            ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP => {
                Ok(Media::Image(Image::from_file(path)?))
            }
            _ => Err(Error::UnsupportedFormat(path.to_path_buf())),
        }
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        match self {
            Media::Gif(gif) => gif.write_to_file(path),
            Media::Ico(ico) => ico.write_to_file(path),
            Media::Image(img) => img.write_to_file(path),
        }
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        match self {
            Media::Gif(gif) => gif.write_to_memory(),
            Media::Ico(ico) => ico.write_to_memory(),
            Media::Image(img) => img.write_to_memory(),
        }
    }

    pub fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) -> Result<()> {
        match self {
            Media::Gif(gif) => gif.resize(target_width, target_height, scale, filter),
            Media::Ico(ico) => ico.resize(target_width, target_height, scale, filter),
            Media::Image(img) => img.resize(target_width, target_height, scale, filter),
        }
    }

    pub fn palettify(&mut self, config: &Config) -> Result<()> {
        match self {
            Media::Gif(gif) => gif.palettify(config),
            Media::Ico(ico) => ico.palettify(config),
            Media::Image(img) => img.palettify(config),
        }
    }

    pub fn default_extension(&self) -> &'static str {
        match self {
            Media::Gif(_) => "gif",
            Media::Ico(_) => "ico",
            Media::Image(_) => "png",
        }
    }
}

pub fn load_media_from_path(path: &Path) -> Result<Media> {
    let format = ImageFormat::from_path(path)?;
    match format {
        ImageFormat::Gif => Ok(Media::Gif(Gif::from_file(path)?)),
        ImageFormat::Ico => Ok(Media::Ico(Ico::from_file(path)?)),
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP => {
            Ok(Media::Image(Image::from_file(path)?))
        }
        _ => Err(Error::UnsupportedFormat(path.to_path_buf())),
    }
}
