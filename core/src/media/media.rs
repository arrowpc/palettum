use image::ImageFormat;

use super::{gif::Gif, ico::Ico, image::Image};
use crate::{config::Config, error::Result, Filter};
use std::path::Path;

pub trait Media: Sized {
    fn from_memory(bytes: &[u8]) -> Result<Self>;
    fn from_file<P: AsRef<std::path::Path>>(path: P) -> Result<Self>;
    fn write_to_file<P: AsRef<std::path::Path>>(&self, path: P) -> Result<()>;
    fn write_to_memory(&self) -> Result<Vec<u8>>;
    fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) -> Result<()>;
    fn palettify(&mut self, config: &Config) -> Result<()>;
    fn default_extension() -> &'static str;
}

macro_rules! impl_media {
    ($ty:ty, $ext:expr) => {
        impl Media for $ty {
            fn from_memory(bytes: &[u8]) -> Result<Self> {
                <$ty>::from_memory(bytes)
            }
            fn from_file<P: AsRef<std::path::Path>>(path: P) -> Result<Self> {
                <$ty>::from_file(path)
            }
            fn write_to_file<P: AsRef<std::path::Path>>(&self, path: P) -> Result<()> {
                self.write_to_file(path)
            }
            fn write_to_memory(&self) -> Result<Vec<u8>> {
                self.write_to_memory()
            }
            fn resize(
                &mut self,
                target_width: Option<u32>,
                target_height: Option<u32>,
                scale: Option<f32>,
                filter: Filter,
            ) -> Result<()> {
                self.resize(target_width, target_height, scale, filter)
            }
            fn palettify(&mut self, config: &Config) -> Result<()> {
                self.palettify(config)
            }
            fn default_extension() -> &'static str {
                $ext
            }
        }
    };
}

impl_media!(Gif, "gif");
impl_media!(Ico, "ico");
impl_media!(Image, "png");

enum MediaKind {
    Gif,
    Ico,
    Image,
}

fn detect_media_kind(path: &Path) -> Result<MediaKind> {
    let format = ImageFormat::from_path(path)?;
    match format {
        ImageFormat::Gif => Ok(MediaKind::Gif),
        ImageFormat::Ico => Ok(MediaKind::Ico),
        _ => Ok(MediaKind::Image),
    }
}
