use crate::color::ConvertToLab;
use crate::config::Config;
use crate::image::Image;
use crate::lut;
use crate::processing;
use crate::utils::resize_image_if_needed;
use image::{
    codecs::gif::{GifEncoder, Repeat},
    AnimationDecoder, Frame, ImageDecoder,
};
use std::fs::File;
use std::io::{BufReader, BufWriter, Cursor, Read, Seek, SeekFrom};
use std::path::Path;

pub struct Gif {
    pub frames: Vec<Frame>,
    pub width: u32,
    pub height: u32,
    pub repeat: Option<Repeat>,
    pub speed: u16,
}

impl Gif {
    pub fn from_bytes(
        gif_bytes: &[u8],
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync + 'static>> {
        let mut cursor = Cursor::new(gif_bytes);
        let (repeat, speed) = extract_gif_metadata(&mut cursor)?;
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

    pub fn from_file<P: AsRef<Path>>(
        path: P,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync + 'static>> {
        let mut file = File::open(&path)?;
        let (repeat, speed) = extract_gif_metadata(&mut file)?;
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

    pub fn write_to_file<P: AsRef<Path>>(
        &self,
        path: P,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer)
    }

    pub fn write_to_memory(
        &self,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync + 'static>> {
        let mut buffer = Vec::new();
        {
            let writer = Cursor::new(&mut buffer);
            self.write_to_writer(writer)?;
        }
        Ok(buffer)
    }

    fn write_to_writer<W: std::io::Write>(
        &self,
        writer: W,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
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
}

fn extract_gif_metadata<R: Read + Seek>(
    reader: &mut R,
) -> Result<(Option<Repeat>, u16), Box<dyn std::error::Error + Send + Sync + 'static>> {
    // GIF header is 6 bytes ("GIF87a" or "GIF89a")
    let mut header = [0u8; 6];
    reader.read_exact(&mut header)?;

    if &header[0..3] != b"GIF" {
        return Err("Not a valid GIF file".into());
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

pub fn palettify_gif(
    gif: &Gif,
    config: &Config,
) -> Result<Gif, Box<dyn std::error::Error + Send + Sync + 'static>> {
    config.validate()?;

    let target_dims = (config.resize_width, config.resize_height);

    let lab_palette = config
        .palette
        .iter()
        .map(|rgb| rgb.to_lab())
        .collect::<Vec<_>>();

    let lookup = if config.quant_level > 0 {
        let avg_frame_size = gif.width as usize * gif.height as usize;
        lut::generate_lookup_table(config, &lab_palette, Some(avg_frame_size))
    } else {
        Vec::new()
    };

    let lookup_opt = if lookup.is_empty() {
        None
    } else {
        Some(&lookup[..])
    };

    let process_frame =
        |frame: &Frame| -> Result<Frame, Box<dyn std::error::Error + Send + Sync + 'static>> {
            let delay = frame.delay();
            let left = frame.left();
            let top = frame.top();

            let image = Image {
                buffer: frame.buffer().clone(),
                width: frame.buffer().width(),
                height: frame.buffer().height(),
            };

            // Resize the image if needed
            let mut res = resize_image_if_needed(
                &image,
                target_dims.0,
                target_dims.1,
                config.resize_scale,
                config.resize_filter,
            );

            processing::process_pixels(&mut res.buffer, config, &lab_palette, lookup_opt);

            Ok(Frame::from_parts(res.buffer, left, top, delay))
        };

    let processed_frames = gif
        .frames
        .iter()
        .map(process_frame)
        .collect::<Result<Vec<_>, Box<dyn std::error::Error + Send + Sync + 'static>>>()?;

    Ok(Gif {
        frames: processed_frames,
        width: target_dims.0.unwrap_or(gif.width),
        height: target_dims.1.unwrap_or(gif.height),
        repeat: gif.repeat,
        speed: gif.speed,
    })
}
