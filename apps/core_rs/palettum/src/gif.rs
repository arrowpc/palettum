use crate::calculate_resize_dimensions;
use crate::color::ConvertToLab;
use crate::config::{Config, Mapping};
use crate::error::PalettumError;
use crate::lut;
use crate::processing;
use image::{
    codecs::gif::{GifDecoder, GifEncoder},
    AnimationDecoder, DynamicImage, Frame, ImageDecoder, RgbaImage,
};
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::Path;

pub fn palettify_gif<P: AsRef<Path>>(
    input_path: P,
    output_path: P,
    config: &Config,
) -> Result<(), PalettumError> {
    let is_palettized_mapping = matches!(
        config.mapping,
        Mapping::Palettized | Mapping::SmoothedPalettized
    );

    if is_palettized_mapping && config.palette.is_empty() {
        return Err(PalettumError::ValidationPaletteEmpty);
    }

    let file_in = BufReader::new(File::open(input_path.as_ref())?);
    let decoder = GifDecoder::new(file_in)?;

    let (orig_width, orig_height) = decoder.dimensions();
    let needs_resize = config.resize_width.is_some() || config.resize_height.is_some();
    let target_dims = if needs_resize {
        calculate_resize_dimensions(
            orig_width,
            orig_height,
            config.resize_width,
            config.resize_height,
        )
    } else {
        None
    };

    if needs_resize && target_dims.is_none() {
        log::warn!("Could not calculate valid resize dimensions for GIF, skipping resize.");
    }
    if let Some((tw, th)) = target_dims {
        log::info!(
            "GIF target resize dimensions: {}x{} using filter {:?}",
            tw,
            th,
            config.resize_filter
        );
    }

    let frames = decoder.into_frames().collect_frames()?;

    log::info!(
        "Processing GIF with {} frames, mapping={:?}, palette_size={}",
        frames.len(),
        config.mapping,
        if is_palettized_mapping {
            config.palette.len()
        } else {
            0
        }
    );

    let lab_palette = if config.mapping != Mapping::Untouched && !config.palette.is_empty() {
        config.palette.iter().map(|rgb| rgb.to_lab()).collect()
    } else {
        Vec::new()
    };

    let file_out = BufWriter::new(File::create(output_path.as_ref())?);
    let mut encoder = GifEncoder::new_with_speed(file_out, 10); 

    let lookup = if config.mapping != Mapping::Untouched
        && config.quant_level > 0
        && !lab_palette.is_empty()
    {
        let (w, h) = target_dims.unwrap_or((orig_width, orig_height));
        let avg_frame_size = if !frames.is_empty() {
            w as usize * h as usize
        } else {
            0
        };
        lut::generate_lookup_table(config, &lab_palette, Some(avg_frame_size))?
    } else {
        Vec::new()
    };
    let lookup_opt = if lookup.is_empty() {
        None
    } else {
        Some(&lookup[..])
    };

    let mut processed_frames = Vec::with_capacity(frames.len());

    for (i, frame) in frames.into_iter().enumerate() {
        log::debug!("Processing frame {}", i + 1);

        let delay = frame.delay();
        let left = frame.left();
        let top = frame.top();

        let dynamic_image: DynamicImage = frame.into_buffer().into();
        let mut rgba_buffer: RgbaImage = dynamic_image.into_rgba8();

        if let Some((new_w, new_h)) = target_dims {
            if rgba_buffer.width() != new_w || rgba_buffer.height() != new_h {
                log::trace!(
                    "Resizing frame {} from {}x{} to {}x{}",
                    i + 1,
                    rgba_buffer.width(),
                    rgba_buffer.height(),
                    new_w,
                    new_h
                );
                rgba_buffer =
                    image::imageops::resize(&rgba_buffer, new_w, new_h, config.resize_filter);
            }
        }

        if config.mapping != Mapping::Untouched {
            processing::process_pixels(&mut rgba_buffer, config, &lab_palette, lookup_opt)?;
        }

        let new_frame = Frame::from_parts(rgba_buffer, left, top, delay);
        processed_frames.push(new_frame);
    }

    encoder.encode_frames(processed_frames)?;

    log::info!("GIF processing complete and saved to output path.");
    Ok(())
}

#[cfg(feature = "wasm")]
pub(crate) fn palettify_gif_bytes(
    gif_bytes: &[u8],
    config: &Config,
) -> Result<Vec<u8>, PalettumError> {
    use image::ImageEncoder;
    use std::io::Cursor;

    let is_palettized_mapping = matches!(
        config.mapping,
        Mapping::Palettized | Mapping::SmoothedPalettized
    );
    if is_palettized_mapping && config.palette.is_empty() {
        return Err(PalettumError::ValidationPaletteEmpty);
    }

    let decoder = GifDecoder::new(Cursor::new(gif_bytes))?;
    let (orig_width, orig_height) = decoder.dimensions();
    let needs_resize = config.resize_width.is_some() || config.resize_height.is_some();
    let target_dims = if needs_resize {
        calculate_resize_dimensions(
            orig_width,
            orig_height,
            config.resize_width,
            config.resize_height,
        )
    } else {
        None
    };

    if needs_resize && target_dims.is_none() {
        log::warn!("Could not calculate valid resize dimensions for GIF bytes, skipping resize.");
    }
    if let Some((tw, th)) = target_dims {
        log::info!(
            "GIF bytes target resize dimensions: {}x{} using filter {:?}",
            tw,
            th,
            config.resize_filter
        );
    }

    let frames = decoder.into_frames().collect_frames()?;
    log::info!(
        "Processing GIF bytes ({} frames) in WASM context",
        frames.len()
    );

    let lab_palette = if config.mapping != Mapping::Untouched && !config.palette.is_empty() {
        config.palette.iter().map(|rgb| rgb.to_lab()).collect()
    } else {
        Vec::new()
    };

    let lookup = if config.mapping != Mapping::Untouched
        && config.quant_level > 0
        && !lab_palette.is_empty()
    {
        let (w, h) = target_dims.unwrap_or((orig_width, orig_height));
        let avg_frame_size = if !frames.is_empty() {
            w as usize * h as usize
        } else {
            0
        };
        lut::generate_lookup_table(config, &lab_palette, Some(avg_frame_size))?
    } else {
        Vec::new()
    };
    let lookup_opt = if lookup.is_empty() {
        None
    } else {
        Some(&lookup[..])
    };

    let mut processed_frames = Vec::with_capacity(frames.len());
    let single_core_config = Config {
        num_threads: 1,
        ..config.clone()
    };

    for frame in frames.into_iter() {
        let delay = frame.delay();
        let left = frame.left();
        let top = frame.top();
        let dynamic_image: DynamicImage = frame.into_buffer().into();
        let mut rgba_buffer: RgbaImage = dynamic_image.into_rgba8();

        if let Some((new_w, new_h)) = target_dims {
            if rgba_buffer.width() != new_w || rgba_buffer.height() != new_h {
                rgba_buffer =
                    image::imageops::resize(&rgba_buffer, new_w, new_h, config.resize_filter);
            }
        }

        if config.mapping != Mapping::Untouched {
            processing::process_pixels(
                &mut rgba_buffer,
                &single_core_config,
                &lab_palette,
                lookup_opt,
            )?;
        }
        processed_frames.push(Frame::from_parts(rgba_buffer, left, top, delay));
    }

    let mut output_bytes = Vec::new();
    {
        let writer = BufWriter::new(Cursor::new(&mut output_bytes));
        let mut encoder = GifEncoder::new_with_speed(writer, 10);
        encoder.encode_frames(processed_frames)?;
    }

    log::info!("GIF byte processing complete.");
    Ok(output_bytes)
}
