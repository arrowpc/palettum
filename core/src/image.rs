use crate::{
    color::ConvertToLab,
    color::Lab,
    config::Config,
    error::{Error, Result},
    processing, Filter,
};

use image::{ImageFormat, RgbaImage};

use std::io::{BufReader, BufWriter, Cursor};
use std::path::Path;
use std::{fs::File, path::PathBuf};

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
        let path = path.as_ref();

        if path.extension().is_some() {
            log::debug!(
                "{}",
                Error::FileExtensionAlreadySupplied(path.to_path_buf())
            );
        }

        let mut path_with_ext = PathBuf::from(path);
        path_with_ext.set_extension("png");

        let file = File::create(&path_with_ext)?;
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
            if s <= 0.0 {
                return Err(Error::InvalidResizeScale);
            }
        }
        // Determine base dimensions before scaling
        let (base_width, base_height) = match (target_width, target_height) {
            (Some(w), Some(h)) => (w, h), // Both width and height provided
            (Some(w), None) => {
                // Only width provided
                let aspect_ratio = self.height as f32 / self.width as f32;
                let h = (w as f32 * aspect_ratio).round() as u32;
                (w, if h == 0 { 1 } else { h }) // Ensure height is at least 1
            }
            (None, Some(h)) => {
                // Only height provided
                let aspect_ratio = self.width as f32 / self.height as f32;
                let w = (h as f32 * aspect_ratio).round() as u32;
                (if w == 0 { 1 } else { w }, h) // Ensure width is at least 1
            }
            (None, None) => {
                // No target dimensions provided. Base is original dimensions.
                // Scale will be applied later if present.
                // If no scale either, we'll skip.
                (self.width, self.height)
            }
        };

        // Now, apply scale to the base dimensions if scale is provided
        let (final_width, final_height) = if let Some(s) = scale {
            let w = ((base_width as f32) * s).round() as u32;
            let h = ((base_height as f32) * s).round() as u32;
            (if w == 0 { 1 } else { w }, if h == 0 { 1 } else { h }) // Ensure non-zero
        } else {
            // No scale provided, use base_width and base_height.
            // If target_width/height were also None, these are original dimensions.
            if target_width.is_none() && target_height.is_none() {
                // No operation specified (no target dimensions, no scale)
                log::debug!("Skipping resize: No target dimensions or scale provided.");
                return Ok(());
            }
            (base_width, base_height)
        };

        // Ensure final dimensions are not zero if they were calculated to be zero
        // (e.g. very small scale on small image)
        // This is now handled when calculating final_width/final_height and base_width/base_height

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

        log::debug!("Processing image pixels ({}x{})", self.width, self.height);
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
        log::debug!("Pixel processing complete.");

        Ok(())
    }
}
