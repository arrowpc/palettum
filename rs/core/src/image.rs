use crate::{
    color::ConvertToLab,
    color::Lab,
    config::{Config, Filter},
    error::{Error, Result},
    processing,
};

use image::{ImageFormat, RgbaImage};

use std::fs::File;
use std::io::{BufReader, BufWriter, Cursor};
use std::path::Path;

#[derive(Clone, Debug)]
pub struct Image {
    pub buffer: RgbaImage,
    pub width: u32,
    pub height: u32,
}

impl Image {
    pub fn from_memory(image_bytes: &[u8]) -> Result<Self> {
        let dynamic_image = image::load_from_memory(image_bytes)?;
        let buffer = dynamic_image.into_rgba8();
        let width = buffer.width();
        let height = buffer.height();
        Ok(Self {
            buffer,
            width,
            height,
        })
    }

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = File::open(&path)?;
        let format = ImageFormat::from_path(&path)?;
        let dynamic_image = image::load(BufReader::new(file), format)?;
        let buffer = dynamic_image.into_rgba8();
        let width = buffer.width();
        let height = buffer.height();
        Ok(Self {
            buffer,
            width,
            height,
        })
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer, ImageFormat::Png)
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        let mut buffer = Vec::new();
        {
            let writer = Cursor::new(&mut buffer);
            self.write_to_writer(writer, ImageFormat::Png)?;
        }
        Ok(buffer)
    }

    // TODO: encode with https://docs.rs/mtpng/latest/mtpng/ as it supports indexed PNGs
    fn write_to_writer<W: std::io::Write + std::io::Seek>(
        &self,
        mut writer: W,
        format: ImageFormat,
    ) -> Result<()> {
        self.buffer.write_to(&mut writer, format)?;
        Ok(())
    }

    pub fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) -> Result<()> {
        if let Some(width) = target_width {
            if width == 0 {
                return Err(Error::InvalidResizeDimensions);
            }
        }

        if let Some(height) = target_height {
            if height == 0 {
                return Err(Error::InvalidResizeDimensions);
            }
        }

        if let Some(s) = scale {
            if s < 0.0 {
                return Err(Error::InvalidResizeScale);
            }
        }
        // Calculate target dimensions based on inputs
        let (new_width, new_height) = match (target_width, target_height) {
            (Some(w), Some(h)) if w > 0 && h > 0 => (w, h),

            (Some(w), None) if w > 0 => {
                let aspect_ratio = self.height as f32 / self.width as f32;
                let h = (w as f32 * aspect_ratio).round() as u32;
                (w, h)
            }

            (None, Some(h)) if h > 0 => {
                let aspect_ratio = self.width as f32 / self.height as f32;
                let w = (h as f32 * aspect_ratio).round() as u32;
                (w, h)
            }

            (None, None) => match scale {
                Some(s) if s > 0.0 => {
                    let w = ((self.width as f32) * s).round() as u32;
                    let h = ((self.height as f32) * s).round() as u32;
                    (w, h)
                }
                _ => {
                    log::debug!("Skipping resize: No valid dimensions or scale provided.");
                    return Ok(());
                }
            },

            _ => {
                log::debug!("Skipping resize: No valid dimensions or scale provided.");
                return Ok(());
            }
        };

        // Apply scaling if provided
        let final_width = match scale {
            Some(s) if s > 0.0 => ((new_width as f32) * s).round() as u32,
            _ => new_width,
        };

        let final_height = match scale {
            Some(s) if s > 0.0 => ((new_height as f32) * s).round() as u32,
            _ => new_height,
        };

        // Only resize if dimensions actually change
        if final_width != self.width || final_height != self.height {
            log::debug!(
                "Resizing from {}x{} to {}x{} using filter {:?}",
                self.width,
                self.height,
                final_width,
                final_height,
                filter
            );

            self.buffer =
                image::imageops::resize(&self.buffer, final_width, final_height, filter.into());
            self.width = final_width;
            self.height = final_height;
        } else {
            log::debug!("Skipping resize: Target dimensions match original.");
        }

        Ok(())
    }

    pub fn palettify(&mut self, config: &Config) -> Result<()> {
        config.validate()?;

        let lab_colors = config
            .palette
            .colors
            .iter()
            .map(|rgb| rgb.to_lab())
            .collect::<Vec<Lab>>();

        let lookup = if config.quant_level > 0 {
            let img_size = self.width as usize * self.height as usize;
            processing::generate_lookup_table(config, &lab_colors, Some(img_size))
        } else {
            Vec::new()
        };

        processing::process_pixels(
            &mut self.buffer,
            config,
            &lab_colors,
            if lookup.is_empty() {
                None
            } else {
                Some(&lookup)
            },
        )?;
        Ok(())
    }
}
