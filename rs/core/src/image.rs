use crate::{
    color::ConvertToLab,
    color::Lab,
    config::{Config, Filter},
    errors::Errors,
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
    pub fn from_memory(image_bytes: &[u8]) -> Result<Self, Errors> {
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

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, Errors> {
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

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<(), Errors> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer, ImageFormat::Png)
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>, Errors> {
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
    ) -> Result<(), Errors> {
        self.buffer.write_to(&mut writer, format)?;
        Ok(())
    }

    pub fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) {
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
                    return;
                }
            },

            _ => {
                log::debug!("Skipping resize: No valid dimensions or scale provided.");
                return;
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
    }

    pub fn palettify(&mut self, config: &Config) -> Result<(), Errors> {
        config.validate()?;

        let lab_palette = config
            .palette
            .iter()
            .map(|rgb| rgb.to_lab())
            .collect::<Vec<Lab>>();

        let lookup = if config.quant_level > 0 {
            let img_size = self.width as usize * self.height as usize;
            processing::generate_lookup_table(config, &lab_palette, Some(img_size))
        } else {
            Vec::new()
        };

        self.resize(
            config.resize_width,
            config.resize_height,
            config.resize_scale,
            config.resize_filter,
        );

        processing::process_pixels(
            &mut self.buffer,
            config,
            &lab_palette,
            if lookup.is_empty() {
                None
            } else {
                Some(&lookup)
            },
        )?;
        Ok(())
    }
}
