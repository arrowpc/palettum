use crate::{
    color::ConvertToLab,
    config::Config,
    error::{Error, Result},
    image::Image,
    processing, Filter,
};

use image::{
    codecs::gif::{GifEncoder, Repeat},
    AnimationDecoder, Frame, ImageDecoder,
};

use std::{fmt, path::Path};
use std::{fs::File, io::SeekFrom};
use std::{
    io::{BufReader, BufWriter, Cursor, Read, Seek},
    path::PathBuf,
};

use tracing::{debug, info, instrument, warn};

pub struct Gif {
    pub frames: Vec<Frame>,
    pub width: u32,
    pub height: u32,
    pub repeat: Option<Repeat>,
    pub speed: u16,
}

impl fmt::Debug for Gif {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Gif")
            .field("frames", &format_args!("<{} frames>", self.frames.len()))
            .field("width", &self.width)
            .field("height", &self.height)
            .field("repeat", &self.repeat)
            .field("speed", &self.speed)
            .finish()
    }
}

impl Gif {
    #[instrument(skip(gif_bytes))]
    pub fn from_memory(gif_bytes: &[u8]) -> Result<Self> {
        info!("Loading GIF from memory");
        let mut cursor = Cursor::new(gif_bytes);
        let (repeat, speed) = Self::extract_metadata(&mut cursor)?;
        cursor.seek(SeekFrom::Start(0))?;

        let decoder = image::codecs::gif::GifDecoder::new(cursor)?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;
        info!(
            "Loaded {} frames, dimensions {}x{}",
            frames.len(),
            width,
            height
        );

        Ok(Self {
            frames,
            width,
            height,
            repeat,
            speed,
        })
    }

    #[instrument(skip(path))]
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        info!("Loading GIF from file: {}", path.as_ref().display());
        let mut file = File::open(&path)?;
        let (repeat, speed) = Self::extract_metadata(&mut file)?;
        file.seek(SeekFrom::Start(0))?;

        let decoder = image::codecs::gif::GifDecoder::new(BufReader::new(file))?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;
        info!(
            "Loaded {} frames, dimensions {}x{}",
            frames.len(),
            width,
            height
        );

        Ok(Self {
            frames,
            width,
            height,
            repeat,
            speed,
        })
    }

    #[instrument(skip(path))]
    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();

        if path.extension().is_some() {
            debug!(
                "{}",
                Error::FileExtensionAlreadySupplied(path.to_path_buf())
            );
        }

        let mut path_with_ext = PathBuf::from(path);
        path_with_ext.set_extension("gif");
        debug!("Saving as GIF to: {}", path_with_ext.display());

        let file = File::create(&path_with_ext)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer)?;
        info!("GIF successfully written to file");
        Ok(())
    }

    #[instrument]
    pub fn write_to_memory(&self) -> Result<Vec<u8>> {
        info!("Writing GIF to memory buffer");
        let mut buffer = Vec::new();
        {
            let writer = Cursor::new(&mut buffer);
            self.write_to_writer(writer)?;
        }
        debug!(
            "GIF successfully written to memory buffer (size: {} bytes)",
            buffer.len()
        );
        Ok(buffer)
    }

    #[instrument(skip(writer))]
    fn write_to_writer<W: std::io::Write>(&self, writer: W) -> Result<()> {
        debug!("Encoding GIF with speed: {}", self.speed);
        let mut encoder = GifEncoder::new_with_speed(writer, self.speed.into());

        // Use the repeat setting from the original GIF, defaulting to Infinite if not specified
        let repeat_setting = self.repeat.unwrap_or(Repeat::Infinite);
        debug!("Setting GIF repeat: {:?}", repeat_setting);
        encoder.set_repeat(repeat_setting)?;

        info!("Encoding {} frames", self.frames.len());
        encoder.encode_frames(self.frames.clone())?;
        info!("Encoding complete");
        Ok(())
    }

    #[instrument]
    pub fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) -> Result<()> {
        info!(
            "Attempting to resize GIF (target_width: {:?}, target_height: {:?}, scale: {:?}, filter: {:?})",
            target_width, target_height, scale, filter
        );
        // Determine base dimensions before scaling
        let (base_width, base_height) = match (target_width, target_height) {
            (Some(w), Some(h)) => {
                debug!("Using target width and height as base: {}x{}", w, h);
                (w, h)
            } // Both width and height provided
            (Some(w), None) => {
                // Only width provided
                let aspect_ratio = self.height as f32 / self.width as f32;
                let h = (w as f32 * aspect_ratio).round() as u32;
                debug!(
                    "Using target width ({}) and calculated height ({}) as base",
                    w, h
                );
                (w, if h == 0 { 1 } else { h })
            }
            (None, Some(h)) => {
                // Only height provided
                let aspect_ratio = self.width as f32 / self.height as f32;
                let w = (h as f32 * aspect_ratio).round() as u32;
                debug!(
                    "Using target height ({}) and calculated width ({}) as base",
                    h, w
                );
                (if w == 0 { 1 } else { w }, h)
            }
            (None, None) => {
                debug!(
                    "No target dimensions provided, using original: {}x{}",
                    self.width, self.height
                );
                (self.width, self.height)
            }
        };

        let (final_width, final_height) = if let Some(s) = scale {
            let w = ((base_width as f32) * s).round() as u32;
            let h = ((base_height as f32) * s).round() as u32;
            debug!(
                "Applying scale ({}) to base dimensions {}x{} -> {}x{}",
                s, base_width, base_height, w, h
            );
            (if w == 0 { 1 } else { w }, if h == 0 { 1 } else { h })
        } else {
            debug!(
                "No scale provided, final dimensions are base dimensions: {}x{}",
                base_width, base_height
            );
            (base_width, base_height)
        };

        // If the final dimensions are the same as the current, skip and log once
        if final_width == self.width && final_height == self.height {
            debug!("Skipping resize: Target dimensions match original.");
            return Ok(());
        }

        // Otherwise, resize all frames
        for frame in &mut self.frames {
            let mut image = Image {
                buffer: frame.buffer().clone(),
                width: frame.buffer().width(),
                height: frame.buffer().height(),
            };
            image.resize(target_width, target_height, scale, filter)?;
            *frame = Frame::from_parts(image.buffer, frame.left(), frame.top(), frame.delay());
        }

        self.width = final_width;
        self.height = final_height;

        Ok(())
    }

    #[instrument(skip(reader))]
    fn extract_metadata<R: Read + Seek>(reader: &mut R) -> Result<(Option<Repeat>, u16)> {
        // GIF header is 6 bytes ("GIF87a" or "GIF89a")
        debug!("Extracting GIF metadata");
        let mut header = [0u8; 6];
        reader.read_exact(&mut header)?;

        if &header[0..3] != b"GIF" {
            return Err(Error::InvalidGifFile);
        }
        debug!("Valid GIF header found");

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
                                    debug!("Found NETSCAPE2.0 extension");
                                    let mut sub_block_size = [0u8; 1];
                                    reader.read_exact(&mut sub_block_size)?;

                                    if sub_block_size[0] == 3 {
                                        let mut data = [0u8; 3];
                                        reader.read_exact(&mut data)?;

                                        if data[0] == 1 {
                                            let loop_count = u16::from_le_bytes([data[1], data[2]]);
                                            debug!("Detected loop count: {}", loop_count);
                                            repeat = if loop_count == 0 {
                                                Some(Repeat::Infinite)
                                            } else {
                                                Some(Repeat::Finite(loop_count))
                                            };
                                        }
                                    }
                                }
                            } else {
                                debug!(
                                    "Skipping unknown application extension block (size: {})",
                                    block_size[0]
                                );
                                reader.seek(SeekFrom::Current(block_size[0] as i64))?;
                            }
                        }
                        0xF9 => {
                            // Graphic Control Extension - might contain speed info
                            debug!("Found Graphic Control Extension");
                            let mut block_size = [0u8; 1];
                            reader.read_exact(&mut block_size)?;

                            if block_size[0] == 4 {
                                let mut data = [0u8; 4];
                                reader.read_exact(&mut data)?;

                                // Extract delay time in 1/100 seconds
                                let delay = u16::from_le_bytes([data[1], data[2]]);
                                debug!("Detected frame delay: {} (1/100s)", delay);
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
                                    debug!("Adjusted speed based on delay: {}", speed);
                                }
                            } else {
                                debug!(
                                    "Skipping unknown graphic control extension block (size: {})",
                                    block_size[0]
                                );
                                reader.seek(SeekFrom::Current(block_size[0] as i64))?;
                            }
                        }
                        _ => {
                            debug!("Skipping unknown extension label: 0x{:02X}", ext_label[0]);
                            let mut block_size = [0u8; 1];
                            if reader.read_exact(&mut block_size).is_ok() {
                                debug!("Skipping extension block (size: {})", block_size[0]);
                                reader.seek(SeekFrom::Current(block_size[0] as i64))?;
                            } else {
                                warn!("Could not read block size for unknown extension");
                                break; // Exit loop if we can't read block size
                            }
                        }
                    }

                    // Skip sub-blocks
                    let mut sub_block_size = [0u8; 1];
                    if reader.read_exact(&mut sub_block_size).is_ok() {
                        while sub_block_size[0] != 0 {
                            let size = sub_block_size[0] as i64;
                            debug!("Skipping sub-block (size: {})", size);
                            if reader.seek(SeekFrom::Current(size)).is_err() {
                                warn!("Could not seek past sub-block");
                                break;
                            }
                            if reader.read_exact(&mut sub_block_size).is_err() {
                                warn!("Could not read next sub-block size");
                                break;
                            }
                        }
                    } else {
                        warn!("Could not read sub-block size after extension label");
                        break;
                    }
                }
                0x2C => {
                    // Image Descriptor
                    debug!("Found Image Descriptor, stopping metadata extraction");
                    break;
                }
                0x3B => {
                    // Trailer
                    debug!("Found GIF Trailer, stopping metadata extraction");
                    break;
                }
                _ => {
                    warn!(
                        "Unknown GIF block type: 0x{:02X}, stopping metadata extraction",
                        block_type[0]
                    );
                    break;
                }
            }
        }

        // Reset the reader position
        reader.seek(SeekFrom::Start(0))?;
        debug!(
            "Extracted GIF metadata: repeat={:?}, speed={}",
            repeat, speed
        );
        Ok((repeat, speed))
    }

    #[instrument(skip(config))]
    pub fn palettify(&mut self, config: &Config) -> Result<()> {
        info!("Starting GIF palettification");
        config.validate()?;

        let lab_colors = config
            .palette
            .colors
            .iter()
            .map(|rgb| rgb.to_lab())
            .collect::<Vec<_>>();
        debug!("Converted palette colors to LAB");

        let lookup = if config.quant_level > 0 {
            let avg_frame_size = self.width as usize * self.height as usize;
            processing::generate_lookup_table(config, &lab_colors, Some(avg_frame_size))
        } else {
            info!("Quantization level is 0, skipping LUT generation for GIF");
            Vec::new()
        };

        let lookup_opt = if lookup.is_empty() {
            None
        } else {
            Some(&lookup[..])
        };

        info!(
            "Processing GIF pixels ({} frames, {}x{})",
            self.frames.len(),
            self.width,
            self.height
        );
        for frame in &mut self.frames {
            processing::process_pixels(frame.buffer_mut(), config, &lab_colors, lookup_opt)?;
        }
        info!("Pixel processing complete for all frames.");

        Ok(())
    }
}
