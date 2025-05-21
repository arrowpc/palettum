use crate::{
    color::ConvertToLab,
    color::Lab,
    config::Config,
    error::{Error, Result},
    processing, Filter,
};
use ico::{IconDir, IconDirEntry, IconImage, ResourceType};

use image::RgbaImage;

use std::io::Cursor;
use std::path::Path;
use std::{fs::File, path::PathBuf};

pub struct Ico {
    pub buffers: Vec<RgbaImage>,
    pub widths: Vec<u32>,
    pub heights: Vec<u32>,
}

impl Ico {
    pub fn from_memory(icon_bytes: &[u8]) -> Result<Self> {
        let cursor = Cursor::new(icon_bytes);
        Self::read_from_reader(cursor)
    }

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = File::open(&path)?;
        Self::read_from_reader(file)
    }

    fn read_from_reader<R: std::io::Read + std::io::Seek>(mut reader: R) -> Result<Self> {
        let icon_dir = IconDir::read(&mut reader)?;

        let mut buffers = Vec::with_capacity(icon_dir.entries().len());
        let mut widths = Vec::with_capacity(icon_dir.entries().len());
        let mut heights = Vec::with_capacity(icon_dir.entries().len());

        for entry in icon_dir.entries() {
            let icon_image = entry.decode()?;
            let width = icon_image.width();
            let height = icon_image.height();
            let rgba_data = icon_image.rgba_data();

            let rgba = RgbaImage::from_raw(width, height, rgba_data.to_vec()).unwrap();

            buffers.push(rgba);
            widths.push(width);
            heights.push(height);
        }

        Ok(Self {
            buffers,
            widths,
            heights,
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
        path_with_ext.set_extension("ico");

        let file = File::create(&path_with_ext)?;
        self.write_to_writer(file)?;
        Ok(())
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
        let mut icon_dir = IconDir::new(ResourceType::Icon);

        for image_buffer in &self.buffers {
            let width = image_buffer.width();
            let height = image_buffer.height();

            let rgba_data_vec = image_buffer.to_vec();

            let icon_image = IconImage::from_rgba_data(width, height, rgba_data_vec);

            let entry = IconDirEntry::encode(&icon_image).unwrap();
            icon_dir.add_entry(entry);
        }

        icon_dir.write(&mut writer)?;

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

        for (i, buffer) in self.buffers.iter_mut().enumerate() {
            let orig_width = self.widths[i];
            let orig_height = self.heights[i];

            // Determine base dimensions before scaling
            let (base_width, base_height) = match (target_width, target_height) {
                (Some(w), Some(h)) => (w, h),
                (Some(w), None) => {
                    let aspect_ratio = orig_height as f32 / orig_width as f32;
                    let h = (w as f32 * aspect_ratio).round() as u32;
                    (w, if h == 0 { 1 } else { h })
                }
                (None, Some(h)) => {
                    let aspect_ratio = orig_width as f32 / orig_height as f32;
                    let w = (h as f32 * aspect_ratio).round() as u32;
                    (if w == 0 { 1 } else { w }, h)
                }
                (None, None) => (orig_width, orig_height),
            };

            // Apply scale if provided
            let (final_width, final_height) = if let Some(s) = scale {
                let w = ((base_width as f32) * s).round() as u32;
                let h = ((base_height as f32) * s).round() as u32;
                (if w == 0 { 1 } else { w }, if h == 0 { 1 } else { h })
            } else {
                if target_width.is_none() && target_height.is_none() {
                    // No operation specified
                    log::debug!(
                        "Skipping resize for icon {}: No target dimensions or scale provided.",
                        i
                    );
                    continue;
                }
                (base_width, base_height)
            };

            if final_width != orig_width || final_height != orig_height {
                log::debug!(
                    "Resizing icon {} from {}x{} to {}x{} using filter {:?}",
                    i,
                    orig_width,
                    orig_height,
                    final_width,
                    final_height,
                    filter
                );
                *buffer = image::imageops::resize(buffer, final_width, final_height, filter.into());
                self.widths[i] = final_width;
                self.heights[i] = final_height;
            } else {
                log::debug!(
                    "Skipping resize for icon {}: Target dimensions match original.",
                    i
                );
            }
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

        // Precompute lookup table if needed (size is max of all images)
        let max_img_size = self
            .widths
            .iter()
            .zip(self.heights.iter())
            .map(|(&w, &h)| w as usize * h as usize)
            .max()
            .unwrap_or(0);

        let lookup = if config.quant_level > 0 {
            processing::generate_lookup_table(config, &lab_colors, Some(max_img_size))
        } else {
            Vec::new()
        };

        for (i, buffer) in self.buffers.iter_mut().enumerate() {
            let width = self.widths[i];
            let height = self.heights[i];

            log::debug!("Processing icon pixels {} ({}x{})", i, width, height);
            processing::process_pixels(
                buffer,
                config,
                &lab_colors,
                if lookup.is_empty() {
                    None
                } else {
                    Some(&lookup)
                },
            )?;
        }

        log::debug!("All icons in ico palettified.");
        Ok(())
    }
}
