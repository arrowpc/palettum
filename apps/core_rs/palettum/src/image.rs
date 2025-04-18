use crate::color::ConvertToLab;
use crate::color::Lab;
use crate::config::Config;
use crate::error::PalettumError;
use crate::lut;
use crate::processing;
use crate::utils;

use image::{ImageFormat, RgbaImage};

use std::fs::File;
use std::io::{BufReader, BufWriter, Cursor};
use std::path::Path;

#[derive(Clone, Debug)]
pub struct Image {
    pub buffer: RgbaImage,
    pub width: u32,
    pub height: u32,
}

impl Image {
    pub fn from_bytes(image_bytes: &[u8]) -> Result<Self, PalettumError> {
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

    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, PalettumError> {
        let file = File::open(path)?;
        let dynamic_image = image::load(BufReader::new(file), ImageFormat::Png)?;
        let buffer = dynamic_image.into_rgba8();
        let width = buffer.width();
        let height = buffer.height();
        Ok(Self {
            buffer,
            width,
            height,
        })
    }

    pub fn write_to_file<P: AsRef<Path>>(
        &self,
        path: P,
        format: ImageFormat,
    ) -> Result<(), PalettumError> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        self.write_to_writer(writer, format)
    }

    pub fn write_to_memory(&self, format: ImageFormat) -> Result<Vec<u8>, PalettumError> {
        let mut buffer = Vec::new();
        {
            let writer = Cursor::new(&mut buffer);
            self.write_to_writer(writer, format)?;
        }
        Ok(buffer)
    }

    //TODO: encode with https://docs.rs/mtpng/latest/mtpng/ as it supports indexed PNGs
    fn write_to_writer<W: std::io::Write + std::io::Seek>(
        &self,
        mut writer: W,
        format: ImageFormat,
    ) -> Result<(), PalettumError> {
        self.buffer.write_to(&mut writer, format)?;
        Ok(())
    }
}

pub fn palettify_image(image: &Image, config: &Config) -> Result<Image, PalettumError> {
    let mut res = utils::resize_image_if_needed(
        image,
        config.resize_width,
        config.resize_height,
        config.resize_filter,
    );

    let lab_palette = config
        .palette
        .iter()
        .map(|rgb| rgb.to_lab())
        .collect::<Vec<Lab>>();

    let lookup = if config.quant_level > 0 {
        let img_size = res.width as usize * res.height as usize;
        lut::generate_lookup_table(config, &lab_palette, Some(img_size))?
    } else {
        Vec::new()
    };

    processing::process_pixels(
        &mut res.buffer,
        config,
        &lab_palette,
        if lookup.is_empty() {
            None
        } else {
            Some(&lookup)
        },
    )?;

    Ok(res)
}
