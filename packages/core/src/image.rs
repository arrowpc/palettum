use crate::{color::ConvertToLab, color::Lab, config::Config, errors::Errors, processing};

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

    // TODO: Simplify branching
    pub fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: image::imageops::FilterType,
    ) {
        fn apply_scale(dim: u32, scale: Option<f32>) -> u32 {
            match scale {
                Some(s) if s > 0.0 => ((dim as f32) * s).round() as u32,
                _ => dim,
            }
        }

        match (target_width, target_height, scale) {
            // Both width and height specified
            (Some(new_w), Some(new_h), scale) if new_w > 0 && new_h > 0 => {
                let scaled_w = apply_scale(new_w, scale);
                let scaled_h = apply_scale(new_h, scale);

                if scaled_w != self.width || scaled_h != self.height {
                    log::debug!(
                        "Resizing self from {}x{} to {}x{} using filter {:?}",
                        self.width,
                        self.height,
                        scaled_w,
                        scaled_h,
                        filter
                    );
                    self.buffer = image::imageops::resize(&self.buffer, scaled_w, scaled_h, filter);
                    self.width = scaled_w;
                    self.height = scaled_h;
                } else {
                    log::debug!("Skipping resize: Target dimensions match original.");
                }
            }
            // Only width specified, preserve aspect ratio
            (Some(new_w), None, scale) if new_w > 0 => {
                let aspect_ratio = self.height as f32 / self.width as f32;
                let new_h = (new_w as f32 * aspect_ratio).round() as u32;

                let scaled_w = apply_scale(new_w, scale);
                let scaled_h = apply_scale(new_h, scale);

                if scaled_w != self.width || scaled_h != self.height {
                    log::debug!(
                    "Resizing self from {}x{} to {}x{} (preserved aspect ratio) using filter {:?}",
                    self.width,
                    self.height,
                    scaled_w,
                    scaled_h,
                    filter
                );
                    self.buffer = image::imageops::resize(&self.buffer, scaled_w, scaled_h, filter);
                    self.width = scaled_w;
                    self.height = scaled_h;
                } else {
                    log::debug!("Skipping resize: Target dimensions match original.");
                }
            }
            // Only height specified, preserve aspect ratio
            (None, Some(new_h), scale) if new_h > 0 => {
                let aspect_ratio = self.width as f32 / self.height as f32;
                let new_w = (new_h as f32 * aspect_ratio).round() as u32;

                let scaled_w = apply_scale(new_w, scale);
                let scaled_h = apply_scale(new_h, scale);

                if scaled_w != self.width || scaled_h != self.height {
                    log::debug!(
                    "Resizing self from {}x{} to {}x{} (preserved aspect ratio) using filter {:?}",
                    self.width,
                    self.height,
                    scaled_w,
                    scaled_h,
                    filter
                );
                    self.buffer = image::imageops::resize(&self.buffer, scaled_w, scaled_h, filter);
                    self.width = scaled_w;
                    self.height = scaled_h;
                } else {
                    log::debug!("Skipping resize: Target dimensions match original.");
                }
            }
            // Only scale specified
            (None, None, Some(s)) if s > 0.0 && (self.width > 0 && self.height > 0) => {
                let scaled_w = apply_scale(self.width, Some(s));
                let scaled_h = apply_scale(self.height, Some(s));

                if scaled_w != self.width || scaled_h != self.height {
                    log::debug!(
                        "Resizing self from {}x{} to {}x{} (scale only) using filter {:?}",
                        self.width,
                        self.height,
                        scaled_w,
                        scaled_h,
                        filter
                    );
                    self.buffer = image::imageops::resize(&self.buffer, scaled_w, scaled_h, filter);
                    self.width = scaled_w;
                    self.height = scaled_h;
                } else {
                    log::debug!("Skipping resize: Target dimensions match original.");
                }
            }
            // No valid dimensions or scale provided
            _ => {
                log::debug!("Skipping resize: No valid dimensions or scale provided.");
            }
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
