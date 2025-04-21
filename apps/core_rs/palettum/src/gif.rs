use crate::color::ConvertToLab;
use crate::config::Config;
use crate::error::PalettumError;
use crate::image::Image;
use crate::lut;
use crate::processing;
use crate::utils::resize_image_if_needed;
use image::{codecs::gif::GifEncoder, AnimationDecoder, Frame, ImageDecoder};
use std::fs::File;
use std::io::{BufReader, BufWriter, Cursor};
use std::path::Path;

pub struct Gif {
    pub frames: Vec<Frame>,
    pub width: u32,
    pub height: u32,
}

impl Gif {
    pub fn from_bytes(gif_bytes: &[u8]) -> Result<Self, PalettumError> {
        let decoder = image::codecs::gif::GifDecoder::new(Cursor::new(gif_bytes))?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;
        Ok(Self {
            frames,
            width,
            height,
        })
    }

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, PalettumError> {
        let file = File::open(path)?;
        let decoder = image::codecs::gif::GifDecoder::new(BufReader::new(file))?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;
        Ok(Self {
            frames,
            width,
            height,
        })
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<(), PalettumError> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer)
    }

    pub fn write_to_memory(&self) -> Result<Vec<u8>, PalettumError> {
        let mut buffer = Vec::new();
        {
            let writer = Cursor::new(&mut buffer);
            self.write_to_writer(writer)?;
        }
        Ok(buffer)
    }

    fn write_to_writer<W: std::io::Write>(&self, writer: W) -> Result<(), PalettumError> {
        let mut encoder = GifEncoder::new_with_speed(writer, 10);
        encoder.encode_frames(self.frames.clone())?;
        Ok(())
    }
}

pub fn palettify_gif(gif: &Gif, config: &Config) -> Result<Gif, PalettumError> {
    let target_dims = (config.resize_width, config.resize_height);

    let lab_palette = config
        .palette
        .iter()
        .map(|rgb| rgb.to_lab())
        .collect::<Vec<_>>();

    let lookup = if config.quant_level > 0 {
        let avg_frame_size = gif.width as usize * gif.height as usize;
        lut::generate_lookup_table(config, &lab_palette, Some(avg_frame_size))?
    } else {
        Vec::new()
    };

    let lookup_opt = if lookup.is_empty() {
        None
    } else {
        Some(&lookup[..])
    };

    let process_frame = |frame: &Frame| -> Result<Frame, PalettumError> {
        let delay = frame.delay();
        let left = frame.left();
        let top = frame.top();

        let mut image = Image {
            buffer: frame.buffer().clone(),
            width: frame.buffer().width(),
            height: frame.buffer().height(),
        };

        // Resize the image if needed
        let mut res =
            resize_image_if_needed(&image, target_dims.0, target_dims.1, config.resize_filter);

        processing::process_pixels(&mut res.buffer, config, &lab_palette, lookup_opt)?;

        Ok(Frame::from_parts(res.buffer, left, top, delay))
    };

    let processed_frames = gif
        .frames
        .iter()
        .map(process_frame)
        .collect::<Result<Vec<_>, PalettumError>>()?;

    Ok(Gif {
        frames: processed_frames,
        width: target_dims.0.unwrap_or(gif.width),
        height: target_dims.1.unwrap_or(gif.height),
    })
}
