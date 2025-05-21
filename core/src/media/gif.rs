use crate::{
    color::ConvertToLab,
    config::Config,
    error::{Error, Result},
    processing, Filter, Image,
};

use image::{
    codecs::gif::{GifEncoder, Repeat},
    AnimationDecoder, Frame, ImageDecoder,
};

use std::path::Path;
use std::{fs::File, io::SeekFrom};
use std::{
    io::{BufReader, BufWriter, Cursor, Read, Seek},
    path::PathBuf,
};

pub struct Gif {
    pub frames: Vec<Frame>,
    pub width: u32,
    pub height: u32,
    pub repeat: Option<Repeat>,
    pub speed: u16,
}

impl Gif {
    pub fn from_memory(gif_bytes: &[u8]) -> Result<Self> {
        let mut cursor = Cursor::new(gif_bytes);
        let (repeat, speed) = Self::extract_metadata(&mut cursor)?;
        cursor.seek(SeekFrom::Start(0))?;

        let decoder = image::codecs::gif::GifDecoder::new(cursor)?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;

        Ok(Self {
            frames,
            width,
            height,
            repeat,
            speed,
        })
    }

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let mut file = File::open(&path)?;
        let (repeat, speed) = Self::extract_metadata(&mut file)?;
        file.seek(SeekFrom::Start(0))?;

        let decoder = image::codecs::gif::GifDecoder::new(BufReader::new(file))?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;

        Ok(Self {
            frames,
            width,
            height,
            repeat,
            speed,
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
        path_with_ext.set_extension("gif");

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

    fn write_to_writer<W: std::io::Write>(&self, writer: W) -> Result<()> {
        let mut encoder = GifEncoder::new_with_speed(writer, self.speed.into());

        // Use the repeat setting from the original GIF, defaulting to Infinite if not specified
        if let Some(repeat) = self.repeat {
            encoder.set_repeat(repeat)?;
        } else {
            encoder.set_repeat(Repeat::Infinite)?;
        }

        encoder.encode_frames(self.frames.clone())?;
        Ok(())
    }

    pub fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) -> Result<()> {
        let (base_width, base_height) = match (target_width, target_height) {
            (Some(w), Some(h)) => (w, h),
            (Some(w), None) => {
                let aspect_ratio = self.height as f32 / self.width as f32;
                let h = (w as f32 * aspect_ratio).round() as u32;
                (w, if h == 0 { 1 } else { h })
            }
            (None, Some(h)) => {
                let aspect_ratio = self.width as f32 / self.height as f32;
                let w = (h as f32 * aspect_ratio).round() as u32;
                (if w == 0 { 1 } else { w }, h)
            }
            (None, None) => (self.width, self.height),
        };

        let (final_width, final_height) = if let Some(s) = scale {
            let w = ((base_width as f32) * s).round() as u32;
            let h = ((base_height as f32) * s).round() as u32;
            (if w == 0 { 1 } else { w }, if h == 0 { 1 } else { h })
        } else {
            (base_width, base_height)
        };

        // If the final dimensions are the same as the current, skip and log once
        if final_width == self.width && final_height == self.height {
            log::debug!("Skipping resize: Target dimensions match original.");
            return Ok(());
        }

        // Otherwise, resize all frames
        for frame in &mut self.frames {
            let mut image = Image {
                buffer: frame.buffer().clone(),
                width: frame.buffer().width(),
                height: frame.buffer().height(),
                palette: None,
            };
            image.resize(target_width, target_height, scale, filter)?;
            *frame = Frame::from_parts(image.buffer, frame.left(), frame.top(), frame.delay());
        }

        self.width = final_width;
        self.height = final_height;

        Ok(())
    }

    fn extract_metadata<R: Read + Seek>(reader: &mut R) -> Result<(Option<Repeat>, u16)> {
        // GIF header is 6 bytes ("GIF87a" or "GIF89a")
        let mut header = [0u8; 6];
        reader.read_exact(&mut header)?;

        if &header[0..3] != b"GIF" {
            return Err(Error::InvalidGifFile);
        }

        // Skip logical screen descriptor (width, height, etc.) - 7 bytes
        reader.seek(SeekFrom::Current(7))?;

        let mut repeat = None;
        let mut speed = 10; // Default speed

        // Read blocks to find application extension for NETSCAPE2.0 (loop info)
        let mut block_type = [0u8; 1];
        while reader.read_exact(&mut block_type).is_ok() {
            match block_type[0] {
                0x21 => {
                    // Extension Introducer
                    let mut ext_label = [0u8; 1];
                    reader.read_exact(&mut ext_label)?;

                    match ext_label[0] {
                        0xFF => {
                            // Application Extension
                            let mut block_size = [0u8; 1];
                            reader.read_exact(&mut block_size)?;

                            if block_size[0] == 11 {
                                // NETSCAPE2.0 block size
                                let mut app_id = [0u8; 11];
                                reader.read_exact(&mut app_id)?;

                                if &app_id[0..11] == b"NETSCAPE2.0" {
                                    let mut sub_block_size = [0u8; 1];
                                    reader.read_exact(&mut sub_block_size)?;

                                    if sub_block_size[0] == 3 {
                                        let mut data = [0u8; 3];
                                        reader.read_exact(&mut data)?;

                                        if data[0] == 1 {
                                            let loop_count = u16::from_le_bytes([data[1], data[2]]);
                                            repeat = if loop_count == 0 {
                                                Some(Repeat::Infinite)
                                            } else {
                                                Some(Repeat::Finite(loop_count))
                                            };
                                        }
                                    }
                                }
                            } else {
                                // Skip this block
                                reader.seek(SeekFrom::Current(block_size[0] as i64))?;
                            }
                        }
                        0xF9 => {
                            // Graphic Control Extension - might contain speed info
                            let mut block_size = [0u8; 1];
                            reader.read_exact(&mut block_size)?;

                            if block_size[0] == 4 {
                                let mut data = [0u8; 4];
                                reader.read_exact(&mut data)?;

                                // Extract delay time in 1/100 seconds
                                let delay = u16::from_le_bytes([data[1], data[2]]);
                                if delay > 0 && speed == 10 {
                                    // Only set speed if not already set and valid
                                    // Mapping delay to speed (10 is default speed)
                                    // Lower delays need higher speed values
                                    speed = if delay < 5 {
                                        30
                                    } else if delay < 10 {
                                        20
                                    } else {
                                        10
                                    };
                                }
                            } else {
                                // Skip this block
                                reader.seek(SeekFrom::Current(block_size[0] as i64))?;
                            }
                        }
                        _ => {
                            // Skip unknown extension
                            let mut block_size = [0u8; 1];
                            reader.read_exact(&mut block_size)?;
                            reader.seek(SeekFrom::Current(block_size[0] as i64))?;
                        }
                    }

                    // Skip sub-blocks
                    let mut sub_block_size = [0u8; 1];
                    reader.read_exact(&mut sub_block_size)?;
                    while sub_block_size[0] != 0 {
                        reader.seek(SeekFrom::Current(sub_block_size[0] as i64))?;
                        reader.read_exact(&mut sub_block_size)?;
                    }
                }
                0x2C => {
                    // Image Descriptor
                    // Found an image descriptor, we've read enough metadata
                    break;
                }
                _ => {
                    // Unknown block, stop parsing to avoid confusion
                    break;
                }
            }
        }

        // Reset the reader position
        reader.seek(SeekFrom::Start(0))?;

        Ok((repeat, speed))
    }

    pub fn palettify(&mut self, config: &Config) -> Result<()> {
        config.validate()?;

        let lab_colors = config
            .palette
            .colors
            .iter()
            .map(|rgb| rgb.to_lab())
            .collect::<Vec<_>>();

        let lookup = if config.quant_level > 0 {
            let avg_frame_size = self.width as usize * self.height as usize;
            processing::generate_lookup_table(config, &lab_colors, Some(avg_frame_size))
        } else {
            Vec::new()
        };

        let lookup_opt = if lookup.is_empty() {
            None
        } else {
            Some(&lookup[..])
        };

        log::debug!("Processing gif pixels ({}x{})", self.width, self.height);
        for frame in &mut self.frames {
            processing::process_pixels(frame.buffer_mut(), config, &lab_colors, lookup_opt)?;
        }
        log::debug!("Pixel processing complete.");

        Ok(())
    }
}
