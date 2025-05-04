use crate::color::Lab;
use crate::config::Config;
use crate::processing::compute_mapped_color_rgb;
use image::{Rgb, Rgba};
use rayon::prelude::*;

const LUT_SIZE_HEURISTIC_DIVISOR: usize = 4;

pub(crate) fn generate_lookup_table(
    config: &Config,
    lab_palette: &[Lab],
    image_size: Option<usize>,
) -> Vec<Rgb<u8>> {
    let q = config.quant_level;

    let bins_per_channel = 256usize >> q;
    let table_size = bins_per_channel.pow(3);

    if let Some(size) = image_size {
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
    let rounding = if q > 0 { 1u16 << (q - 1) } else { 0 };

    let process_index = |index: usize| -> Option<(usize, Rgb<u8>)> {
        let b_bin = index % bins_per_channel;
        let g_bin = (index / bins_per_channel) % bins_per_channel;
        let r_bin = index / (bins_per_channel * bins_per_channel);

        let r_val = (((r_bin as u16) << q) + rounding).min(255) as u8;
        let g_val = (((g_bin as u16) << q) + rounding).min(255) as u8;
        let b_val = (((b_bin as u16) << q) + rounding).min(255) as u8;

        let target_pixel = Rgba([r_val, g_val, b_val, 255]);

        match compute_mapped_color_rgb(target_pixel, config, lab_palette) {
            result_rgb => Some((index, result_rgb)),
        }
    };

    if config.num_threads > 1 {
        let results: Vec<Option<(usize, Rgb<u8>)>> =
            (0..table_size).into_par_iter().map(process_index).collect();

        for result in results.into_iter().flatten() {
            let (index, rgb) = result;
            lookup[index] = rgb;
        }
    } else {
        for index in 0..table_size {
            if let Some((_, rgb)) = process_index(index) {
                lookup[index] = rgb;
            }
        }
    }

    log::debug!("Lookup table generation complete.");
    lookup
}
