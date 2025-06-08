mod gif;
mod ico;
mod image;
mod video;
use ::image::{guess_format, ImageFormat};
pub use gif::Gif;
pub use ico::Ico;
pub use image::Image;
pub use video::Video;

use crate::{
    config::Config,
    error::{Error, Result},
    Filter,
};
use std::path::Path;

#[derive(Clone)]
pub enum Media {
    Gif(Gif),
    Ico(Ico),
    Image(Image),
    Video(Video),
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
            _ => Err(Error::UnsupportedFormat),
        }
    }

    pub fn from_memory(bytes: &[u8]) -> Result<Self> {
        let format = guess_format(bytes)?;
        match format {
            ImageFormat::Gif => Ok(Media::Gif(Gif::from_memory(bytes)?)),
            ImageFormat::Ico => Ok(Media::Ico(Ico::from_memory(bytes)?)),
            ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP => {
                Ok(Media::Image(Image::from_memory(bytes)?))
            }
            _ => Err(Error::UnsupportedFormat),
        }
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        match self {
            Media::Gif(gif) => gif.write_to_file(path),
            Media::Ico(ico) => ico.write_to_file(path),
            Media::Image(img) => img.write_to_file(path),
            Media::Video(vid) => vid.write_to_file(path),
        }
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        match self {
            Media::Gif(gif) => gif.write_to_memory(),
            Media::Ico(ico) => ico.write_to_memory(),
            Media::Image(img) => img.write_to_memory(),
            Media::Video(vid) => vid.write_to_memory(),
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
            Media::Video(vid) => vid.resize(target_width, target_height, scale, filter),
        }
    }

    pub async fn palettify(&mut self, config: &Config) -> Result<()> {
        match self {
            Media::Gif(gif) => gif.palettify(config).await,
            Media::Ico(ico) => ico.palettify(config).await,
            Media::Image(img) => img.palettify(config).await,
            Media::Video(vid) => vid.palettify(config).await,
        }
    }

    pub fn default_extension(&self) -> &'static str {
        match self {
            Media::Gif(_) => "gif",
            Media::Ico(_) => "ico",
            Media::Image(_) => "png",
            Media::Video(_) => "mp4",
        }
    }
}

pub fn load_media_from_path(path: &Path) -> Result<Media> {
    if path.extension().unwrap().to_str().unwrap() == "mp4" {
        return Ok(Media::Video(Video::from_file(path)?));
    }

    let format = ImageFormat::from_path(path)?;
    match format {
        ImageFormat::Gif => Ok(Media::Gif(Gif::from_file(path)?)),
        ImageFormat::Ico => Ok(Media::Ico(Ico::from_file(path)?)),
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP => {
            Ok(Media::Image(Image::from_file(path)?))
        }
        _ => Err(Error::UnsupportedFormat),
    }
}

pub fn load_media_from_memory(bytes: &[u8]) -> Result<Media> {
    let format = guess_format(bytes)?;
    match format {
        ImageFormat::Gif => Ok(Media::Gif(Gif::from_memory(bytes)?)),
        ImageFormat::Ico => Ok(Media::Ico(Ico::from_memory(bytes)?)),
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP => {
            Ok(Media::Image(Image::from_memory(bytes)?))
        }
        _ => Err(Error::UnsupportedFormat),
    }
}
