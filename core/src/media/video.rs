use crate::{
    color::{ConvertToLab, Lab},
    config::Config,
    error::{Error, Result},
    processing, Filter, Mapping,
};

use ffmpeg_next as ffmpeg;
use image::{EncodableLayout, ImageFormat, Rgb, RgbaImage};

use std::fs::{File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;
use std::{
    collections::HashMap,
    io::{BufReader, BufWriter, Cursor},
};

use png::{BitDepth, ColorType, Encoder};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Debug)]
pub struct Packet {
    pub data: Vec<u8>,
    pub pts: Option<i64>,
}

#[derive(Clone)]
pub struct Video {
    pub width: u32,
    pub height: u32,
    pub framerate: ffmpeg::Rational,
    pub time_base: ffmpeg::Rational,
    pub duration_ts: i64,

    // For decoding
    codec_params: ffmpeg::codec::Parameters,
    packets: Vec<Packet>,
}

impl Video {
    pub fn from_memory(bytes: &[u8]) -> Result<Self> {
        let mut path = std::env::temp_dir();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        path.push(format!("ffmpeg_temp_{}.tmp", nanos));

        // Write the bytes to the file
        let mut file = File::create(&path)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.seek(SeekFrom::Start(0))?;
        Self::from_file(path)
    }

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        ffmpeg::init()?;
        let mut ictx = ffmpeg::format::input(&path)?;
        let stream = ictx
            .streams()
            .best(ffmpeg::media::Type::Video)
            .ok_or(Error::StreamNotFound)?;
        let stream_idx = stream.index();
        let codec_params = stream.parameters();
        let ctx = ffmpeg::codec::Context::from_parameters(codec_params.clone())?;
        let (width, height) = if let Ok(decoder) = ctx.decoder().video() {
            (decoder.width(), decoder.height())
        } else {
            (0, 0)
        };

        let framerate = stream.rate();
        let time_base = stream.time_base();
        let duration_ts = stream.duration();
        let codec_params = codec_params.clone();

        let mut packets = Vec::new();
        for (s, packet) in ictx.packets() {
            if s.index() == stream_idx {
                packets.push(Packet {
                    data: packet.data().unwrap_or(&[]).to_vec(),
                    pts: packet.pts(),
                });
            }
        }

        Ok(Video {
            width,
            height,
            framerate,
            time_base,
            duration_ts,
            codec_params,
            packets,
        })
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        todo!()
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        todo!()
    }

    fn write_to_writer<W: std::io::Write + std::io::Seek>(&self, mut writer: W) -> Result<()> {
        todo!()
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

            todo!();
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

        todo!()
    }
}
