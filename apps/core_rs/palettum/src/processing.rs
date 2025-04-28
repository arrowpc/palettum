use crate::color::{ConvertToLab, Lab};
use crate::config::{Config, Mapping, SmoothingStyle};
use crate::delta_e::delta_e_batch;
use crate::utils::ThreadLocalCache;
use image::{Rgb, Rgba, RgbaImage};
use rayon::ThreadPoolBuilder;

const WEIGHT_THRESHOLD: f64 = 1e-9;
const TOTAL_WEIGHT_THRESHOLD: f64 = 1e-9;
const ANISOTROPIC_DIST_EPSILON: f64 = 1e-9;

fn find_closest_palette_color(lab: &Lab, lab_palette: &[Lab], config: &Config) -> Rgb<u8> {
    let index = delta_e_batch(config.delta_e_method, lab, lab_palette)
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(index, _)| index)
        .unwrap();

    config.palette[index]
}

#[inline]
fn compute_weight(distance: f64, config: &Config) -> f64 {
    let strength = config.smoothing_strength.clamp(0.0, 1.0);

    match config.smoothing_style {
        SmoothingStyle::Gaussian => {
            let shape = (0.18 * strength + 0.01).max(ANISOTROPIC_DIST_EPSILON);

            let exponent = -(shape * distance).powi(2);
            exponent.max(-700.0).exp()
        }
        SmoothingStyle::IDW => {
            let power = 6.0 * strength + 1.0;
            1.0 / (distance.powf(power) + ANISOTROPIC_DIST_EPSILON)
        }
    }
}

fn compute_anisotropic_weighted_average(
    target_lab: &Lab,
    config: &Config,
    lab_palette: &[Lab],
) -> Rgb<u8> {
    match config.mapping {
        Mapping::Palettized => {
            return find_closest_palette_color(target_lab, lab_palette, config);
        }
        Mapping::Smoothed | Mapping::SmoothedPalettized => {
            if config.smoothing_strength == 0.0 {
                return find_closest_palette_color(target_lab, lab_palette, config);
            }
        }
    }

    let mut total_weight: f64 = 0.0;
    let mut sum_r: f64 = 0.0;
    let mut sum_g: f64 = 0.0;
    let mut sum_b: f64 = 0.0;
    let [scale_l, scale_a, scale_b] = config.lab_scales;

    for (i, palette_lab_color) in lab_palette.iter().enumerate() {
        let dl = target_lab.l as f64 - palette_lab_color.l as f64;
        let da = target_lab.a as f64 - palette_lab_color.a as f64;
        let db = target_lab.b as f64 - palette_lab_color.b as f64;
        let anisotropic_dist_sq = (scale_l * dl * dl).max(0.0)
            + (scale_a * da * da).max(0.0)
            + (scale_b * db * db).max(0.0);
        let anisotropic_dist = anisotropic_dist_sq.sqrt();
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
        Rgb([r_avg, g_avg, b_avg])
    } else {
        log::debug!(
            "Total weight near zero in weighted average for {:?}, falling back to closest color.",
            target_lab
        );
        find_closest_palette_color(target_lab, lab_palette, config)
    }
}

pub(crate) fn compute_mapped_color_rgb(
    target: Rgba<u8>,
    config: &Config,
    lab_palette: &[Lab],
) -> Rgb<u8> {
    let target_lab = target.to_lab();

    match config.mapping {
        Mapping::Palettized => find_closest_palette_color(&target_lab, lab_palette, config),
        Mapping::Smoothed => compute_anisotropic_weighted_average(&target_lab, config, lab_palette),
        Mapping::SmoothedPalettized => {
            let smoothed_rgb =
                compute_anisotropic_weighted_average(&target_lab, config, lab_palette);
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
) -> Rgba<u8> {
    if pixel.0[3] < config.transparency_threshold && config.mapping != Mapping::Smoothed {
        return Rgba([0, 0, 0, 0]);
    }

    if let Some(lut) = lookup {
        let q = config.quant_level;
        if !lut.is_empty() {
            let bins_per_channel = 256usize >> q;
            if bins_per_channel > 0 {
                let r_q = (pixel.0[0] >> q) as usize;
                let g_q = (pixel.0[1] >> q) as usize;
                let b_q = (pixel.0[2] >> q) as usize;

                let index =
                    r_q * bins_per_channel * bins_per_channel + g_q * bins_per_channel + b_q;

                if let Some(rgb_color) = lut.get(index) {
                    return Rgba([rgb_color.0[0], rgb_color.0[1], rgb_color.0[2], 255]);
                } else {
                    log::warn!("LUT index {} out of bounds (size {})", index, lut.len());
                }
            }
        }
    }

    if let Some(cached_color) = cache.get(&pixel) {
        return *cached_color;
    }

    let result_rgb = compute_mapped_color_rgb(pixel, config, lab_palette);
    let alpha = if config.mapping == Mapping::Smoothed {
        pixel[3]
    } else {
        255
    };

    let result_rgba = Rgba([result_rgb.0[0], result_rgb.0[1], result_rgb.0[2], alpha]);
    cache.set(pixel, result_rgba);

    result_rgba
}

pub(crate) fn process_pixels(
    image: &mut RgbaImage,
    config: &Config,
    lab_palette: &[Lab],
    lookup: Option<&[Rgb<u8>]>,
) {
    let width = image.width();
    let height = image.height();
    log::debug!("Processing image pixels ({}x{})", width, height);

    let raw_data = image.as_mut();
    let bytes_per_pixel = 4;

    let num_threads = config.num_threads.max(1);

    if num_threads == 1 {
        let mut cache = ThreadLocalCache::new();
        for pixel_chunk in raw_data.chunks_mut(bytes_per_pixel) {
            let r = pixel_chunk[0];
            let g = pixel_chunk[1];
            let b = pixel_chunk[2];
            let a = pixel_chunk[3];
            let pixel = Rgba([r, g, b, a]);

            let mapped_pixel =
                get_mapped_color_for_pixel(pixel, config, lab_palette, &mut cache, lookup);

            pixel_chunk[0] = mapped_pixel.0[0];
            pixel_chunk[1] = mapped_pixel.0[1];
            pixel_chunk[2] = mapped_pixel.0[2];
            pixel_chunk[3] = mapped_pixel.0[3];
        }
    } else {
        // Multi-threaded processing using Rayon

        let chunk_size = (raw_data.len() / bytes_per_pixel).div_ceil(num_threads);
        let pixel_chunks: Vec<_> = raw_data.chunks_mut(chunk_size * bytes_per_pixel).collect();

        let pool = ThreadPoolBuilder::new()
            .num_threads(num_threads)
            .build()
            .expect("Failed to build thread pool");

        pool.scope(|scope| {
            for chunk in pixel_chunks {
                scope.spawn(|_| {
                    let mut cache = ThreadLocalCache::new();

                    for pixel_chunk in chunk.chunks_mut(bytes_per_pixel) {
                        let r = pixel_chunk[0];
                        let g = pixel_chunk[1];
                        let b = pixel_chunk[2];
                        let a = pixel_chunk[3];
                        let pixel = Rgba([r, g, b, a]);

                        let mapped_pixel = get_mapped_color_for_pixel(
                            pixel,
                            config,
                            lab_palette,
                            &mut cache,
                            lookup,
                        );

                        pixel_chunk[0] = mapped_pixel.0[0];
                        pixel_chunk[1] = mapped_pixel.0[1];
                        pixel_chunk[2] = mapped_pixel.0[2];
                        pixel_chunk[3] = mapped_pixel.0[3];
                    }
                });
            }
        });
    }

    log::debug!("Pixel processing complete.");
}
