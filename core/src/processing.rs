use crate::{
    color::{ConvertToLab, Lab},
    config::Config,
    error::{Error, Result},
    palettized::{self, Dithering},
    smoothed, Mapping,
};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use image::{Rgb, Rgba, RgbaImage};

use rayon::{prelude::*, ThreadPoolBuilder};

use std::collections::HashMap;

#[derive(Debug)]
pub struct ThreadLocalCache {
    cache: HashMap<Rgba<u8>, Rgba<u8>>,
}

impl ThreadLocalCache {
    pub(crate) fn new() -> Self {
        ThreadLocalCache {
            cache: HashMap::with_capacity(4096),
        }
    }

    #[inline]
    pub(crate) fn get(&self, key: &Rgba<u8>) -> Option<&Rgba<u8>> {
        self.cache.get(key)
    }

    #[inline]
    pub(crate) fn set(&mut self, key: Rgba<u8>, value: Rgba<u8>) {
        self.cache.insert(key, value);
    }
}

pub fn generate_lookup_table(
    config: &Config,
    lab_colors: &[Lab],
    image_size: Option<usize>,
) -> Vec<Rgb<u8>> {
    // Dithering operates pixel by pixel with error diffusion; LUT is not used
    if config.dither_algorithm != Dithering::None {
        log::debug!("Skipping LUT generation: Dithering algorithm is active.");
        return Vec::new();
    }

    let q = config.quant_level;
    if q == 0 {
        log::debug!("Skipping LUT generation: Quantization level is 0.");
        return Vec::new();
    }

    let bins_per_channel = 256usize >> q;
    let table_size = bins_per_channel.pow(3);

    if let Some(size) = image_size {
        const LUT_SIZE_HEURISTIC_DIVISOR: usize = 4;
        if size > 0 && table_size > size / LUT_SIZE_HEURISTIC_DIVISOR {
            log::debug!(
                "Skipping LUT generation: LUT size ({}) > image size ({}) / {}",
                table_size,
                size,
                LUT_SIZE_HEURISTIC_DIVISOR
            );
            return Vec::new();
        }
    }

    log::debug!(
        "Generating lookup table (quant={}, bins={}, size={})...",
        q,
        bins_per_channel,
        table_size
    );

    let mut lookup = vec![Rgb([0, 0, 0]); table_size];
    let rounding = 1u16 << (q - 1); // q > 0 is guaranteed here

    let process_index = |index: usize| -> Option<(usize, Rgb<u8>)> {
        let b_bin = index % bins_per_channel;
        let g_bin = (index / bins_per_channel) % bins_per_channel;
        let r_bin = index / (bins_per_channel * bins_per_channel);

        let r_val = (((r_bin as u16) << q) + rounding).min(255) as u8;
        let g_val = (((g_bin as u16) << q) + rounding).min(255) as u8;
        let b_val = (((b_bin as u16) << q) + rounding).min(255) as u8;

        let target_pixel = Rgba([r_val, g_val, b_val, 255]);

        // For LUT generation, we always use the direct mapping result
        let result_rgb = compute_mapped_color_rgb(target_pixel, config, lab_colors);
        Some((index, result_rgb))
    };

    if config.num_threads > 1 && table_size > 0 {
        let results: Vec<Option<(usize, Rgb<u8>)>> =
            (0..table_size).into_par_iter().map(process_index).collect();

        for result in results.into_iter().flatten() {
            let (index, rgb) = result;
            if index < lookup.len() {
                // Basic bounds check
                lookup[index] = rgb;
            }
        }
    } else if table_size > 0 {
        // Single-threaded LUT generation
        for (index, item) in lookup.iter_mut().enumerate().take(table_size) {
            if let Some((_, rgb)) = process_index(index) {
                *item = rgb;
            }
        }
    }

    log::debug!("Lookup table generation complete.");
    lookup
}

/// Computes the mapped RGB color for a single target RGBA pixel based on the configuration's mapping strategy.
/// This function does NOT consider dithering, LUTs, or caching. It's the core color mapping logic.
pub(crate) fn compute_mapped_color_rgb(
    target: Rgba<u8>,
    config: &Config,
    lab_colors: &[Lab],
) -> Rgb<u8> {
    let reference = target.to_lab();

    match config.mapping {
        Mapping::Palettized => palettized::closest_rgb(&reference, lab_colors, config),
        Mapping::Smoothed => smoothed::closest_rgb(&reference, lab_colors, config),
    }
}

/// Gets the mapped RGBA color for a single pixel, specifically for the non-dithering path.
/// It utilises LUTs and caching if applicable.
fn get_mapped_color_for_pixel(
    pixel: Rgba<u8>,
    config: &Config,
    lab_colors: &[Lab],
    cache: &mut ThreadLocalCache,
    lookup: Option<&[Rgb<u8>]>,
) -> Result<Rgba<u8>> {
    // Transparency check for non-smoothed mappings
    if pixel.0[3] < config.transparency_threshold && config.mapping != Mapping::Smoothed {
        return Ok(Rgba([0, 0, 0, 0]));
    }

    // LUT lookup if available and quant_level > 0
    // `lookup` itself will be None or empty if dithering is on or quant_level is 0.
    if let Some(lut) = lookup {
        if !lut.is_empty() {
            let q = config.quant_level;
            let bins_per_channel = 256usize >> q;

            // This check should be redundant if lut is non-empty, but good for safety.
            if bins_per_channel > 0 {
                let r_q = (pixel.0[0] >> q) as usize;
                let g_q = (pixel.0[1] >> q) as usize;
                let b_q = (pixel.0[2] >> q) as usize;

                let index =
                    r_q * bins_per_channel * bins_per_channel + g_q * bins_per_channel + b_q;

                if let Some(rgb_color) = lut.get(index) {
                    let alpha = if config.mapping == Mapping::Smoothed {
                        pixel.0[3]
                    } else {
                        255
                    };
                    return Ok(Rgba([
                        rgb_color.0[0],
                        rgb_color.0[1],
                        rgb_color.0[2],
                        alpha,
                    ]));
                } else {
                    log::error!(
                        "LUT index {} out of bounds (size {}). Pixel: {:?}, Q: {}",
                        index,
                        lut.len(),
                        pixel,
                        q
                    );
                }
            }
        }
    }

    // Cache lookup
    if let Some(cached_color) = cache.get(&pixel) {
        return Ok(*cached_color);
    }

    // Direct computation if no LUT/cache hit
    let result_rgb = compute_mapped_color_rgb(pixel, config, lab_colors);
    let alpha = if config.mapping == Mapping::Smoothed {
        pixel.0[3]
    } else {
        255
    };

    let result_rgba = Rgba([result_rgb.0[0], result_rgb.0[1], result_rgb.0[2], alpha]);
    cache.set(pixel, result_rgba);

    Ok(result_rgba)
}

/// Helper function to process pixels in parallel for non-dithered mappings.
fn process_non_dithered_pixels(
    image_data: &mut [u8],
    width: u32,
    height: u32,
    config: &Config,
    lab_colors: &[Lab],
    lookup: Option<&[Rgb<u8>]>,
) -> Result<()> {
    let bytes_per_pixel = 4; // RGBA
    let num_threads = config.num_threads.max(1);

    if num_threads == 1 {
        let mut cache = ThreadLocalCache::new();
        for pixel_chunk in image_data.chunks_mut(bytes_per_pixel) {
            let current_pixel = Rgba([
                pixel_chunk[0],
                pixel_chunk[1],
                pixel_chunk[2],
                pixel_chunk[3],
            ]);
            let mapped_pixel =
                get_mapped_color_for_pixel(current_pixel, config, lab_colors, &mut cache, lookup)?;
            pixel_chunk.copy_from_slice(&mapped_pixel.0);
        }
    } else {
        // Multi-threaded
        let num_pixels = width as usize * height as usize;
        let chunk_size = num_pixels.div_ceil(num_threads);
        let pixel_chunks: Vec<_> = image_data
            .chunks_mut(chunk_size * bytes_per_pixel)
            .collect();

        let pool = ThreadPoolBuilder::new().num_threads(num_threads).build()?;

        pool.scope(|scope| {
            for chunk in pixel_chunks {
                scope.spawn(|_| {
                    let mut cache = ThreadLocalCache::new();
                    for pixel_chunk in chunk.chunks_mut(bytes_per_pixel) {
                        let current_pixel = Rgba([
                            pixel_chunk[0],
                            pixel_chunk[1],
                            pixel_chunk[2],
                            pixel_chunk[3],
                        ]);
                        match get_mapped_color_for_pixel(
                            current_pixel,
                            config,
                            lab_colors,
                            &mut cache,
                            lookup,
                        ) {
                            Ok(mapped_pixel) => {
                                pixel_chunk.copy_from_slice(&mapped_pixel.0);
                            }
                            Err(e) => {
                                log::error!("Error processing pixel in thread: {:?}", e);
                            }
                        }
                    }
                });
            }
        });
    }
    Ok(())
}

pub(crate) fn process_pixels_cpu(
    image_data: &mut [u8],
    width: u32,
    height: u32,
    config: &Config,
    lab_colors: &[Lab],
    lookup: Option<&[Rgb<u8>]>,
) -> Result<()> {
    if config.mapping == Mapping::Smoothed {
        return process_non_dithered_pixels(image_data, width, height, config, lab_colors, lookup);
    }

    match config.dither_algorithm {
        Dithering::None => {
            process_non_dithered_pixels(image_data, width, height, config, lab_colors, lookup)
        }
        Dithering::Fs => {
            let mut image =
                RgbaImage::from_raw(width, height, image_data.to_vec()).ok_or_else(|| {
                    Error::Internal(
                        "Failed to create image view from buffer for dithering".to_string(),
                    )
                })?;
            palettized::floyd_steinberg(&mut image, config, lab_colors)
        }
        Dithering::Bn => {
            let mut image =
                RgbaImage::from_raw(width, height, image_data.to_vec()).ok_or_else(|| {
                    Error::Internal(
                        "Failed to create image view from buffer for dithering".to_string(),
                    )
                })?;
            palettized::blue_noise(&mut image, config, lab_colors)
        }
    }
}

use crate::gpu::GpuImageProcessor;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub async fn process_pixels(
    image_data: &mut [u8],
    width: u32,
    height: u32,
    config: Config,
) -> Result<()> {
    let lab_colors = config
        .palette
        .colors
        .iter()
        .map(|rgb| rgb.to_lab())
        .collect::<Vec<Lab>>();

    if let Some(gpu_processor_arc) = super::gpu::get_gpu_processor().await? {
        let gpu_processor_ref: &GpuImageProcessor = &gpu_processor_arc;

        log::debug!("Using GPU for image processing");
        let result = gpu_processor_ref
            .process_image(image_data, width, height, &config)
            .await?;

        if image_data.len() == result.len() {
            image_data.copy_from_slice(&result);
        } else {
            log::error!("GPU output buffer size mismatch.");
            return Err(Error::Internal(
                "GPU output buffer size mismatch".to_string(),
            ));
        }
        return Ok(());
    }

    log::debug!("Using CPU for image processing (GPU not available or failed to init)");

    let lookup_table = if config.quant_level > 0 {
        let img_size = width as usize * height as usize;
        Some(generate_lookup_table(&config, &lab_colors, Some(img_size)))
    } else {
        None
    };

    process_pixels_cpu(
        image_data,
        width,
        height,
        &config,
        &lab_colors,
        lookup_table.as_deref(),
    )
}
