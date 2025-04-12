use crate::cache::ThreadLocalCache;
use crate::color::{ConvertToLab, Lab};
use crate::config::{Config, Mapping, WeightingKernelType};
use crate::delta_e;
use crate::error::PalettumError;
use image::{Rgb, Rgba, RgbaImage};
use rayon::prelude::*;

const WEIGHT_THRESHOLD: f64 = 1e-9;
const TOTAL_WEIGHT_THRESHOLD: f64 = 1e-9;
const ANISOTROPIC_DIST_EPSILON: f64 = 1e-9;
const MAX_Q: u8 = 5;

fn delta_e_batch(target_lab: &Lab, lab_palette: &[Lab], config: &Config) -> Vec<f32> {
    lab_palette
        .iter()
        .map(|palette_color| {
            delta_e::calculate_delta_e(config.delta_e_method, target_lab, palette_color)
        })
        .collect()
}

fn find_closest_palette_color_index(
    lab: &Lab,
    lab_palette: &[Lab],
    config: &Config,
) -> Result<usize, PalettumError> {
    if lab_palette.is_empty() {
        return Err(PalettumError::EmptyPalette);
    }
    let results = delta_e_batch(lab, lab_palette, config);
    results
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(index, _)| index)
        .ok_or(PalettumError::EmptyPalette)
}

fn find_closest_palette_color(
    lab: &Lab,
    lab_palette: &[Lab],
    config: &Config,
) -> Result<Rgb<u8>, PalettumError> {
    let index = find_closest_palette_color_index(lab, lab_palette, config)?;
    config
        .palette
        .get(index)
        .cloned()
        .ok_or(PalettumError::PaletteSizeMismatch(
            config.palette.len(),
            lab_palette.len(),
        ))
}

#[inline]
fn compute_weight(distance: f64, config: &Config) -> f64 {
    match config.anisotropic_kernel {
        WeightingKernelType::Gaussian => {
            let shape = config
                .anisotropic_shape_parameter
                .max(ANISOTROPIC_DIST_EPSILON);
            let exponent = -(shape * distance).powi(2);
            exponent.max(-700.0).exp() // exp(-700) is approx 1e-304
        }
        WeightingKernelType::InverseDistancePower => {
            let power = config.anisotropic_power_parameter.max(0.0);
            // Add epsilon to prevent division by zero if distance is exactly 0
            1.0 / (distance.powf(power) + ANISOTROPIC_DIST_EPSILON)
        }
    }
}

fn compute_anisotropic_weighted_average(
    target_lab: &Lab,
    config: &Config,
    lab_palette: &[Lab],
) -> Result<Rgb<u8>, PalettumError> {
    if config.palette.is_empty() {
        return Err(PalettumError::EmptyPalette);
    }
    if config.palette.len() != lab_palette.len() {
        return Err(PalettumError::PaletteSizeMismatch(
            config.palette.len(),
            lab_palette.len(),
        ));
    }

    let mut total_weight: f64 = 0.0;
    let mut sum_r: f64 = 0.0;
    let mut sum_g: f64 = 0.0;
    let mut sum_b: f64 = 0.0;
    let scale_l = config.anisotropic_lab_scales[0];
    let scale_a = config.anisotropic_lab_scales[1];
    let scale_b = config.anisotropic_lab_scales[2];

    for (i, palette_lab_color) in lab_palette.iter().enumerate() {
        let dl = target_lab.l as f64 - palette_lab_color.l as f64;
        let da = target_lab.a as f64 - palette_lab_color.a as f64;
        let db = target_lab.b as f64 - palette_lab_color.b as f64;
        let anisotropic_dist_sq = (scale_l * dl * dl).max(0.0)
            + (scale_a * da * da).max(0.0)
            + (scale_b * db * db).max(0.0);
        let anisotropic_dist = anisotropic_dist_sq.sqrt(); // Now safe
        let weight = compute_weight(anisotropic_dist, config);

        if weight > WEIGHT_THRESHOLD {
            total_weight += weight;
            if let Some(palette_rgb) = config.palette.get(i) {
                sum_r += weight * palette_rgb.0[0] as f64;
                sum_g += weight * palette_rgb.0[1] as f64;
                sum_b += weight * palette_rgb.0[2] as f64;
            }
        }
    }

    if total_weight > TOTAL_WEIGHT_THRESHOLD {
        let r_avg = (sum_r / total_weight).round().clamp(0.0, 255.0) as u8;
        let g_avg = (sum_g / total_weight).round().clamp(0.0, 255.0) as u8;
        let b_avg = (sum_b / total_weight).round().clamp(0.0, 255.0) as u8;
        Ok(Rgb([r_avg, g_avg, b_avg]))
    } else {
        log::warn!("Total weight near zero in weighted average for Lab {:?}, falling back to closest color.", target_lab);
        find_closest_palette_color(target_lab, lab_palette, config)
    }
}

pub(crate) fn compute_mapped_color_rgb(
    target: Rgba<u8>,
    config: &Config,
    lab_palette: &[Lab],
) -> Result<Rgb<u8>, PalettumError> {
    if config.mapping == Mapping::Untouched {
        return Ok(Rgb([target.0[0], target.0[1], target.0[2]]));
    }

    let needs_palette = matches!(
        config.mapping,
        Mapping::Palettized | Mapping::Smoothed | Mapping::SmoothedPalettized
    );
    if needs_palette && lab_palette.is_empty() {
        log::warn!(
            "compute_mapped_color_rgb called with empty Lab palette for mapping {:?}. Returning original color.",
            config.mapping
        );
        return Ok(Rgb([target.0[0], target.0[1], target.0[2]]));
    }

    let target_lab = target.to_lab();

    match config.mapping {
        Mapping::Untouched => unreachable!(),
        Mapping::Palettized => find_closest_palette_color(&target_lab, lab_palette, config),
        Mapping::Smoothed => compute_anisotropic_weighted_average(&target_lab, config, lab_palette),
        Mapping::SmoothedPalettized => {
            let smoothed_rgb =
                compute_anisotropic_weighted_average(&target_lab, config, lab_palette)?;
            let smoothed_lab = smoothed_rgb.to_lab();
            find_closest_palette_color(&smoothed_lab, lab_palette, config)
        }
    }
}

#[inline]
fn get_mapped_color_for_pixel(
    pixel: Rgba<u8>,
    config: &Config,
    lab_palette: &[Lab],
    cache: &mut ThreadLocalCache,
    lookup: Option<&[Rgb<u8>]>,
) -> Result<Rgba<u8>, PalettumError> {
    if pixel.0[3] < config.transparency_threshold {
        return Ok(Rgba([0, 0, 0, 0]));
    }

    if let Some(lut) = lookup {
        let q = config.quant_level;
        if q > 0 && q <= MAX_Q && !lut.is_empty() {
            let bins_per_channel = 256usize >> q;
            if bins_per_channel > 0 {
                let r_q = (pixel.0[0] >> q) as usize;
                let g_q = (pixel.0[1] >> q) as usize;
                let b_q = (pixel.0[2] >> q) as usize;

                let index =
                    r_q * bins_per_channel * bins_per_channel + g_q * bins_per_channel + b_q;

                if let Some(rgb_color) = lut.get(index) {
                    return Ok(Rgba([rgb_color.0[0], rgb_color.0[1], rgb_color.0[2], 255]));
                } else {
                    log::warn!("LUT index {} out of bounds (size {})", index, lut.len());
                }
            }
        }
    }

    if let Some(cached_color) = cache.get(&pixel) {
        return Ok(*cached_color);
    }

    let result_rgb = compute_mapped_color_rgb(pixel, config, lab_palette)?;
    let result_rgba = Rgba([result_rgb.0[0], result_rgb.0[1], result_rgb.0[2], 255]);

    cache.set(pixel, result_rgba);

    Ok(result_rgba)
}

pub(crate) fn process_pixels(
    image: &mut RgbaImage,
    config: &Config,
    lab_palette: &[Lab],
    lookup: Option<&[Rgb<u8>]>,
) -> Result<(), PalettumError> {
    let width = image.width();
    let height = image.height();
    log::debug!("Processing image pixels ({}x{})", width, height);

    let raw_data = image.as_mut();
    let bytes_per_pixel = 4;

    thread_local! {
        static CACHE: std::cell::RefCell<ThreadLocalCache> =
            std::cell::RefCell::new(ThreadLocalCache::new());
    }

    if config.num_threads > 1 {
        raw_data
            .par_chunks_mut(bytes_per_pixel)
            .for_each(|pixel_chunk| {
                let r = pixel_chunk[0];
                let g = pixel_chunk[1];
                let b = pixel_chunk[2];
                let a = pixel_chunk[3];
                let pixel = Rgba([r, g, b, a]);

                let result = CACHE.with(|cache_cell| {
                    let mut cache = cache_cell.borrow_mut();
                    get_mapped_color_for_pixel(pixel, config, lab_palette, &mut cache, lookup)
                });

                match result {
                    Ok(mapped_pixel) => {
                        pixel_chunk[0] = mapped_pixel.0[0];
                        pixel_chunk[1] = mapped_pixel.0[1];
                        pixel_chunk[2] = mapped_pixel.0[2];
                        pixel_chunk[3] = mapped_pixel.0[3];
                    }
                    Err(e) => {
                        log::error!("Error processing pixel: {}", e);
                    }
                }
            });
    } else {
        let mut cache = ThreadLocalCache::new();
        for pixel_chunk in raw_data.chunks_mut(bytes_per_pixel) {
            let r = pixel_chunk[0];
            let g = pixel_chunk[1];
            let b = pixel_chunk[2];
            let a = pixel_chunk[3];
            let pixel = Rgba([r, g, b, a]);

            match get_mapped_color_for_pixel(pixel, config, lab_palette, &mut cache, lookup) {
                Ok(mapped_pixel) => {
                    pixel_chunk[0] = mapped_pixel.0[0];
                    pixel_chunk[1] = mapped_pixel.0[1];
                    pixel_chunk[2] = mapped_pixel.0[2];
                    pixel_chunk[3] = mapped_pixel.0[3];
                }
                Err(e) => {
                    log::error!("Error processing pixel: {}", e);
                }
            }
        }
    }

    log::debug!("Pixel processing complete.");
    Ok(())
}
