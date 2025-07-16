use crate::{
    config::Config,
    error::{Error, Result},
    processing, Filter,
};

use ffmpeg_next as ffmpeg;

use std::io::{Seek, SeekFrom, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{fs::File, path::PathBuf};

pub struct Video {
    pub width: u32,
    pub height: u32,
    pub framerate: ffmpeg::Rational,
    pub time_base: ffmpeg::Rational,
    pub duration_ts: i64,

    // For decoding
    codec_params: ffmpeg::codec::Parameters,
    packets: Vec<ffmpeg::codec::packet::Packet>,
}

impl Clone for Video {
    fn clone(&self) -> Self {
        Video {
            width: self.width,
            height: self.height,
            framerate: self.framerate,
            time_base: self.time_base,
            duration_ts: self.duration_ts,
            codec_params: self.codec_params.clone(),
            packets: self.packets.to_vec(),
        }
    }
}

impl Video {
    pub fn from_memory(bytes: &[u8]) -> Result<Self> {
        let mut path = std::env::temp_dir();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        path.push(format!("ffmpeg_temp_{}.tmp", nanos));

        let mut file = File::create(&path)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.seek(SeekFrom::Start(0))?;

        let video = Self::from_file(&path);

        std::fs::remove_file(&path).ok();

        video
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
        let (width, height) = if let Ok(decoder) =
            ffmpeg::codec::Context::from_parameters(codec_params.clone())?
                .decoder()
                .video()
        {
            (decoder.width(), decoder.height())
        } else {
            (0, 0)
        };

        let framerate = stream.rate();
        let time_base = stream.time_base();
        let duration_ts = stream.duration();

        let packets = ictx
            .packets()
            .filter_map(|(s, p)| {
                if s.index() == stream_idx {
                    Some(p)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

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
        let path = path.as_ref();
        if matches!(path.extension(), Some(ext) if ext != "mp4") {
            log::debug!(
                "Output path {} has a non-mp4 extension; replacing with .mp4",
                path.display()
            );
        }
        let mut path_with_ext = PathBuf::from(path);
        path_with_ext.set_extension("mp4");
        ffmpeg::init()?;

        let mut octx = ffmpeg::format::output(&path_with_ext)?;

        let stream_mapping = [0];
        let ist_time_bases = [self.time_base];

        let mut ost = octx.add_stream(
            ffmpeg::encoder::find(self.codec_params.id()).ok_or(Error::StreamNotFound)?,
        )?;
        ost.set_parameters(self.codec_params.clone());
        unsafe {
            (*ost.parameters().as_mut_ptr()).codec_tag = 0;
        }

        octx.write_header()?;

        for packet in &self.packets {
            let mut packet = packet.clone();
            let ist_index = 0;
            let ost_index = stream_mapping[ist_index];
            let ost = octx.stream(ost_index as _).unwrap();
            packet.rescale_ts(ist_time_bases[ist_index], ost.time_base());
            packet.set_position(-1);
            packet.set_stream(ost_index as _);
            packet.write_interleaved(&mut octx)?;
        }

        octx.write_trailer()?;
        Ok(())
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        let mut temp_path = std::env::temp_dir();
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        temp_path.push(format!("ffmpeg_output_{}.mp4", nanos));

        self.write_to_file(&temp_path)?;

        let buffer = std::fs::read(&temp_path)?;
        std::fs::remove_file(&temp_path).ok();

        Ok(buffer)
    }

    pub async fn palettify(&mut self, config: &Config) -> Result<()> {
        config.validate()?;
        ffmpeg::init()?;

        let decoder_ctx = ffmpeg::codec::Context::from_parameters(self.codec_params.clone())?;
        let mut decoder = decoder_ctx.decoder().video()?;

        let encoder_codec = ffmpeg::encoder::find_by_name("libx264rgb").unwrap();

        let encoder_ctx = ffmpeg::codec::Context::new_with_codec(encoder_codec);
        let mut encoder = encoder_ctx.encoder().video()?;

        encoder.set_width(self.width);
        encoder.set_height(self.height);

        let output_pix_fmt = ffmpeg::format::Pixel::RGB24;
        encoder.set_format(output_pix_fmt);
        encoder.set_time_base(self.time_base);
        encoder.set_frame_rate(Some(self.framerate));
        encoder.set_colorspace(ffmpeg::color::Space::RGB);

        let opts = ffmpeg::Dictionary::from_iter([("crf", "0")]);
        let mut encoder = encoder.open_as_with(encoder_codec, opts)?;

        let mut to_rgba_scaler = ffmpeg::software::scaling::context::Context::get(
            decoder.format(),
            decoder.width(),
            decoder.height(),
            ffmpeg::format::Pixel::RGBA,
            self.width,
            self.height,
            ffmpeg::software::scaling::flag::Flags::POINT,
        )?;

        let mut to_encoder_scaler = ffmpeg::software::scaling::context::Context::get(
            ffmpeg::format::Pixel::RGBA,
            self.width,
            self.height,
            output_pix_fmt,
            self.width,
            self.height,
            ffmpeg::software::scaling::flag::Flags::POINT,
        )?;

        let mut new_packets = Vec::new();
        for packet in &self.packets {
            decoder.send_packet(packet)?;

            let mut decoded_frame = ffmpeg::util::frame::video::Video::empty();
            while decoder.receive_frame(&mut decoded_frame).is_ok() {
                let mut rgba_frame = ffmpeg::util::frame::video::Video::new(
                    ffmpeg::format::Pixel::RGBA,
                    self.width,
                    self.height,
                );
                to_rgba_scaler.run(&decoded_frame, &mut rgba_frame)?;

                let mut img_buf = Self::frame_to_img_buf(&rgba_frame)?;
                let (w, h) = (img_buf.width(), img_buf.height());
                processing::process_pixels(img_buf.as_mut(), w, h, &config).await?;
                let processed_rgba_frame = Self::img_buf_to_frame(&img_buf)?;

                let mut output_frame =
                    ffmpeg::util::frame::video::Video::new(output_pix_fmt, self.width, self.height);
                to_encoder_scaler.run(&processed_rgba_frame, &mut output_frame)?;
                output_frame.set_pts(decoded_frame.pts());

                encoder.send_frame(&output_frame)?;
                let mut encoded_packet = ffmpeg::codec::packet::Packet::empty();
                while encoder.receive_packet(&mut encoded_packet).is_ok() {
                    new_packets.push(encoded_packet.clone());
                }
            }
        }

        encoder.send_eof()?;
        let mut encoded_packet = ffmpeg::codec::packet::Packet::empty();
        while encoder.receive_packet(&mut encoded_packet).is_ok() {
            new_packets.push(encoded_packet.clone());
        }

        self.packets = new_packets;
        self.codec_params = ffmpeg::codec::Parameters::from(&encoder);
        self.time_base = encoder.time_base();

        log::debug!("Video processing and re-encoding complete");
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

            self.width = final_width;
            self.height = final_height;

            ffmpeg::init()?;

            let decoder_ctx = ffmpeg::codec::Context::from_parameters(self.codec_params.clone())?;
            let mut decoder = decoder_ctx.decoder().video()?;

            let encoder_codec =
                ffmpeg::encoder::find(self.codec_params.id()).ok_or(Error::StreamNotFound)?;
            let encoder_ctx = ffmpeg::codec::Context::new_with_codec(encoder_codec);
            let mut encoder = encoder_ctx.encoder().video()?;

            encoder.set_width(self.width);
            encoder.set_height(self.height);
            let pix_fmt = decoder.format();
            encoder.set_format(pix_fmt);
            encoder.set_time_base(self.time_base);
            encoder.set_frame_rate(Some(self.framerate));

            let mut encoder = encoder.open_as(encoder_codec)?;

            let flag = match filter {
                Filter::Nearest => ffmpeg::software::scaling::flag::Flags::POINT,
                Filter::Triangle => ffmpeg::software::scaling::flag::Flags::BILINEAR,
                Filter::Lanczos3 => ffmpeg::software::scaling::flag::Flags::LANCZOS,
            };

            let mut scaler = ffmpeg::software::scaling::context::Context::get(
                decoder.format(),
                decoder.width(),
                decoder.height(),
                pix_fmt,
                self.width,
                self.height,
                flag,
            )?;

            // Decode → scale → encode
            let mut new_packets = Vec::new();
            for packet in &self.packets {
                decoder.send_packet(packet)?;
                let mut decoded = ffmpeg::util::frame::video::Video::empty();
                while decoder.receive_frame(&mut decoded).is_ok() {
                    let mut frame =
                        ffmpeg::util::frame::video::Video::new(pix_fmt, self.width, self.height);
                    scaler.run(&decoded, &mut frame)?;
                    frame.set_pts(decoded.pts());

                    encoder.send_frame(&frame)?;
                    let mut encoded = ffmpeg::codec::packet::Packet::empty();
                    while encoder.receive_packet(&mut encoded).is_ok() {
                        new_packets.push(encoded.clone());
                    }
                }
            }

            encoder.send_eof()?;
            let mut encoded = ffmpeg::codec::packet::Packet::empty();
            while encoder.receive_packet(&mut encoded).is_ok() {
                new_packets.push(encoded.clone());
            }

            self.packets = new_packets;
            self.codec_params = ffmpeg::codec::Parameters::from(&encoder);
            self.time_base = encoder.time_base();
        } else {
            log::debug!("Skipping resize: Target dimensions match original.");
        }

        Ok(())
    }

    /// Helper to convert an FFmpeg video frame to an `image::RgbaImage`.
    fn frame_to_img_buf(frame: &ffmpeg::util::frame::video::Video) -> Result<image::RgbaImage> {
        let width = frame.width();
        let height = frame.height();
        let data = frame.data(0);
        let stride = frame.stride(0);
        let mut buf = Vec::with_capacity((width * height * 4) as usize);

        for y in 0..height {
            let start = y as usize * stride;
            let end = start + (width as usize * 4);
            buf.extend_from_slice(&data[start..end]);
        }

        image::RgbaImage::from_raw(width, height, buf)
            .ok_or_else(|| Error::Video("Failed to create RgbaImage from raw buffer".into()))
    }

    fn img_buf_to_frame(rgba: &image::RgbaImage) -> Result<ffmpeg::util::frame::video::Video> {
        let width = rgba.width();
        let height = rgba.height();
        let mut frame =
            ffmpeg::util::frame::video::Video::new(ffmpeg::format::Pixel::RGBA, width, height);

        let stride = frame.stride(0);
        let data = frame.data_mut(0);
        let raw = rgba.as_raw();

        for y in 0..height as usize {
            let src_start = y * (width as usize * 4);
            let src_end = src_start + (width as usize * 4);
            let dst_start = y * stride;
            let dst_end = dst_start + (width as usize * 4);

            if let (Some(dst_slice), Some(src_slice)) = (
                data.get_mut(dst_start..dst_end),
                raw.get(src_start..src_end),
            ) {
                dst_slice.copy_from_slice(src_slice);
            } else {
                return Err(Error::Video("Buffer slice bounds error".into()));
            }
        }

        Ok(frame)
    }
}
