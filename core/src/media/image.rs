use crate::{
    color::{ConvertToLab, Lab},
    config::Config,
    error::{Error, Result},
    processing, Filter, Mapping,
};

use image::{EncodableLayout, ImageFormat, Rgb, RgbaImage};

use std::path::Path;
use std::{
    collections::HashMap,
    io::{BufReader, BufWriter, Cursor},
};
use std::{fs::File, path::PathBuf};

use png::{BitDepth, ColorType, Encoder};

#[derive(Clone, Debug)]
pub struct Image {
    pub buffer: RgbaImage,
    pub width: u32,
    pub height: u32,
    pub palette: Option<Vec<Rgb<u8>>>,
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
            palette: None,
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
            palette: None,
        })
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();

        if matches!(path.extension(), Some(ext) if ext != "png") {
            log::debug!(
                "Output path {} has a non-png extension; replacing with .png",
                path.display()
            );
        }

        let mut path_with_ext = PathBuf::from(path);
        path_with_ext.set_extension("png");

        let file = File::create(&path_with_ext)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer)
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        let mut buffer = Vec::new();
        {
            let writer = Cursor::new(&mut buffer);
            self.write_to_writer(writer)?;
        }
        Ok(buffer)
    }

    fn write_to_writer<W: std::io::Write + std::io::Seek>(&self, mut writer: W) -> Result<()> {
        if let Some(palette) = &self.palette {
            log::debug!(
                "Attempting to write indexed PNG with {} palette colors.",
                palette.len()
            );

            let mut encoder = Encoder::new(&mut writer, self.width, self.height);
            encoder.set_color(ColorType::Indexed);
            encoder.set_depth(BitDepth::Eight);
            encoder.set_compression(png::Compression::Fast);

            let mut plte_palette: Vec<u8> = Vec::with_capacity(palette.len() * 3);
            let mut trns_alphas: Vec<u8> = Vec::with_capacity(palette.len());

            for color in palette.iter().take(palette.len() - 1) {
                plte_palette.push(color.0[0]); // R
                plte_palette.push(color.0[1]); // G
                plte_palette.push(color.0[2]); // B
                trns_alphas.push(255u8); // A (Opaque)
            }

            let transparent_index = (palette.len() - 1) as u8;
            let transparent_color = &palette[palette.len() - 1];
            plte_palette.push(transparent_color.0[0]);
            plte_palette.push(transparent_color.0[1]);
            plte_palette.push(transparent_color.0[2]);
            trns_alphas.push(0u8); // Transparent

            encoder.set_palette(plte_palette);
            encoder.set_trns(trns_alphas);

            let mut writer = encoder.write_header()?;

            let color_to_index: HashMap<Rgb<u8>, u8> = palette
                .iter()
                .enumerate()
                .map(|(i, color)| (*color, i as u8))
                .collect();

            let width = self.width as usize;
            let height = self.height as usize;
            let mut indices = Vec::with_capacity(width * height);

            for y in 0..self.height {
                for x in 0..self.width {
                    let pixel_rgba = self.buffer.get_pixel(x, y);
                    let r = pixel_rgba[0];
                    let g = pixel_rgba[1];
                    let b = pixel_rgba[2];
                    let a = pixel_rgba[3];

                    if a == 0 {
                        indices.push(transparent_index);
                    } else {
                        let current_color = Rgb([r, g, b]);
                        match color_to_index.get(&current_color) {
                            Some(&idx) => indices.push(idx),
                            None => {
                                log::error!(
                                "Pixel color ({},{},{}) not found in palette! Defaulting to index 0.",
                                r, g, b
                            );
                                indices.push(0);
                            }
                        }
                    }
                }
            }

            writer.write_image_data(&indices)?;
        } else {
            self.buffer.write_to(&mut writer, ImageFormat::Png)?
        }
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

    pub async fn palettify(&mut self, config: &Config) -> Result<()> {
        config.validate()?;

        let lab_colors = config
            .palette
            .colors
            .iter()
            .map(|rgb| rgb.to_lab())
            .collect::<Vec<Lab>>();

        log::debug!("Processing image pixels ({}x{})", self.width, self.height);
        log::debug!("{}", config);
        processing::process_pixels(&mut self.buffer, config, &lab_colors).await?;
        log::debug!("Pixel processing complete.");

        if config.mapping != Mapping::Smoothed {
            self.palette = Some(config.palette.colors.clone());
            self.palette.as_mut().unwrap().push(Rgb([0, 0, 0]));
            log::debug!("Set image palette: {:?}", self.palette);
        }

        Ok(())
    }

    pub fn as_bytes(&self) -> Vec<u8> {
        self.buffer.as_bytes().to_vec()
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }
}
