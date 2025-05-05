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
use std::io::{BufReader, BufWriter, Cursor};
use std::path::Path;

pub struct Gif {
    pub frames: Vec<Frame>,
    pub width: u32,
    pub height: u32,
}

impl Gif {
    pub fn from_bytes(
        gif_bytes: &[u8],
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync + 'static>> {
        let decoder = image::codecs::gif::GifDecoder::new(Cursor::new(gif_bytes))?;
        let (width, height) = decoder.dimensions();
        let frames = decoder.into_frames().collect_frames()?;
        Ok(Self {
            frames,
            width,
            height,
        })
    }

    pub fn from_file<P: AsRef<Path>>(
        path: P,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync + 'static>> {
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
        let mut encoder = GifEncoder::new_with_speed(writer, 10);

        //TODO: Derive this information from the original GIF (if exists)
        encoder.set_repeat(Repeat::Infinite)?;

        encoder.encode_frames(self.frames.clone())?;
        Ok(())
    }
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
    })
}
