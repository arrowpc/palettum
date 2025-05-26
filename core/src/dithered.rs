use image::{Rgba, RgbaImage};
#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

use crate::{
    color::{ConvertToLab, Lab},
    config::Config,
    error::Result,
    palettized, smoothed, Mapping,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(
    feature = "wasm",
    derive(Tsify, Serialize, Deserialize),
    tsify(type_prefix = "Dithering")
)]
#[cfg_attr(feature = "cli", derive(clap::ValueEnum, strum_macros::Display))]
pub enum Algorithm {
    #[default]
    None,
    FloydSteinberg,
}

pub(crate) fn floyd_steinberg(
    image: &mut RgbaImage,
    config: &Config,
    lab_colors: &[Lab],
) -> Result<()> {
    log::debug!(
        "Applying Floyd-Steinberg dithering with mapping: {:?}",
        config.mapping
    );
    let width = image.width() as usize;
    let height = image.height() as usize;
    let strength = config.dithering_strength;

    // Error buffers for R, G, B channels (current and next row)
    let mut error_r_rows: [Vec<f32>; 2] = [vec![0.0; width], vec![0.0; width]];
    let mut error_g_rows: [Vec<f32>; 2] = [vec![0.0; width], vec![0.0; width]];
    let mut error_b_rows: [Vec<f32>; 2] = [vec![0.0; width], vec![0.0; width]];

    for y in 0..height {
        let current_row = y % 2;
        let next_row = (y + 1) % 2;

        // Clear next row's error buffer
        if y + 1 < height {
            error_r_rows[next_row].fill(0.0);
            error_g_rows[next_row].fill(0.0);
            error_b_rows[next_row].fill(0.0);
        }

        for x in 0..width {
            let px = image.get_pixel(x as u32, y as u32);

            // Make pixel fully transparent if below threshold
            if px.0[3] < config.transparency_threshold
                && !(config.mapping == Mapping::Smoothed
                    && config.dithering_algorithm != Algorithm::None)
            {
                image.put_pixel(x as u32, y as u32, Rgba([0, 0, 0, 0]));
                error_r_rows[current_row][x] = 0.0;
                error_g_rows[current_row][x] = 0.0;
                error_b_rows[current_row][x] = 0.0;
                continue;
            }

            // Choose the color to which error will be added
            let target_rgb: [u8; 3] = match config.mapping {
                Mapping::SmoothedPalettized => {
                    let lab = px.to_lab();
                    let smoothed_lab = smoothed::closest_rgb(&lab, lab_colors, config).to_lab();
                    smoothed_lab.to_rgb().0
                }
                Mapping::Palettized | Mapping::Smoothed => [px.0[0], px.0[1], px.0[2]],
            };

            // Add error to RGB components
            let r_mod = target_rgb[0] as f32 + error_r_rows[current_row][x];
            let g_mod = target_rgb[1] as f32 + error_g_rows[current_row][x];
            let b_mod = target_rgb[2] as f32 + error_b_rows[current_row][x];

            let r = r_mod.clamp(0.0, 255.0) as u8;
            let g = g_mod.clamp(0.0, 255.0) as u8;
            let b = b_mod.clamp(0.0, 255.0) as u8;

            // Quantize to palette
            let lab = Rgba([r, g, b, px.0[3]]).to_lab();
            let quantized = palettized::closest_rgb(&lab, lab_colors, config);

            // Set alpha
            let alpha = if config.mapping == Mapping::Smoothed {
                px.0[3]
            } else {
                255
            };

            image.put_pixel(
                x as u32,
                y as u32,
                Rgba([quantized.0[0], quantized.0[1], quantized.0[2], alpha]),
            );

            // Calculate error
            let err_r = (r_mod - quantized.0[0] as f32) * strength;
            let err_g = (g_mod - quantized.0[1] as f32) * strength;
            let err_b = (b_mod - quantized.0[2] as f32) * strength;

            // Distribute error (Floyd-Steinberg)
            if x + 1 < width {
                error_r_rows[current_row][x + 1] += err_r * 7.0 / 16.0;
                error_g_rows[current_row][x + 1] += err_g * 7.0 / 16.0;
                error_b_rows[current_row][x + 1] += err_b * 7.0 / 16.0;
            }
            if x > 0 && y + 1 < height {
                error_r_rows[next_row][x - 1] += err_r * 3.0 / 16.0;
                error_g_rows[next_row][x - 1] += err_g * 3.0 / 16.0;
                error_b_rows[next_row][x - 1] += err_b * 3.0 / 16.0;
            }
            if y + 1 < height {
                error_r_rows[next_row][x] += err_r * 5.0 / 16.0;
                error_g_rows[next_row][x] += err_g * 5.0 / 16.0;
                error_b_rows[next_row][x] += err_b * 5.0 / 16.0;
            }
            if x + 1 < width && y + 1 < height {
                error_r_rows[next_row][x + 1] += err_r * 1.0 / 16.0;
                error_g_rows[next_row][x + 1] += err_g * 1.0 / 16.0;
                error_b_rows[next_row][x + 1] += err_b * 1.0 / 16.0;
            }
        }
    }
    Ok(())
}
