use crate::color::Lab;
use crate::config::Config;
use crate::error::PalettumError;
use crate::processing::compute_mapped_color_rgb;
use image::{Rgb, Rgba};
use rayon::prelude::*;

const MAX_Q: u8 = 5;
const LUT_SIZE_HEURISTIC_DIVISOR: usize = 4;

pub(crate) fn generate_lookup_table(
    config: &Config,
    lab_palette: &[Lab],
    image_size: Option<usize>,
) -> Result<Vec<Rgb<u8>>, PalettumError> {
    let q = config.quant_level;

    if q == 0
        || q > MAX_Q
        || lab_palette.is_empty()
        || config.mapping == crate::config::Mapping::Untouched
    {
        return Ok(Vec::new());
    }

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
            return Ok(Vec::new());
        }
    }

    log::info!(
        "Generating lookup table (quant={}, bins={}, size={})...",
        q,
        bins_per_channel,
        table_size
    );

    let mut lookup = vec![Rgb([0, 0, 0]); table_size];
    let rounding = if q > 0 { 1u16 << (q - 1) } else { 0 };

    let process_index = |index: usize| -> Result<(usize, Rgb<u8>), PalettumError> {
        let b_bin = index % bins_per_channel;
        let g_bin = (index / bins_per_channel) % bins_per_channel;
        let r_bin = index / (bins_per_channel * bins_per_channel);

        let r_val = (((r_bin as u16) << q) + rounding).min(255) as u8;
        let g_val = (((g_bin as u16) << q) + rounding).min(255) as u8;
        let b_val = (((b_bin as u16) << q) + rounding).min(255) as u8;

        let target_pixel = Rgba([r_val, g_val, b_val, 255]);

        let result_rgb = compute_mapped_color_rgb(target_pixel, config, lab_palette)?;
        Ok((index, result_rgb))
    };

    if config.num_threads > 1 {
        let results: Vec<Result<(usize, Rgb<u8>), PalettumError>> =
            (0..table_size).into_par_iter().map(process_index).collect();

        for result in results {
            match result {
                Ok((index, rgb)) => lookup[index] = rgb,
                Err(e) => {
                    log::error!("Error generating LUT entry: {}. Skipping.", e);
                }
            }
        }
    } else {
        for index in 0..table_size {
            match process_index(index) {
                Ok((_, rgb)) => lookup[index] = rgb,
                Err(e) => {
                    log::error!("Error generating LUT entry {}: {}. Skipping.", index, e);
                }
            }
        }
    }

    log::info!("Lookup table generation complete.");
    Ok(lookup)
}
