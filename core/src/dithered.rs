use image::{Rgb, Rgba, RgbaImage};
#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

use crate::{
    color::{ConvertToLab, Lab},
    config::Config,
    error::Result,
    palettized, // For direct palette color selection
    smoothed,   // For the SmoothedPalettized case
    Mapping,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(
    feature = "wasm",
    derive(Tsify, Serialize, Deserialize),
    tsify(type_prefix = "Dithering")
)] // Keep tsify prefix for consistency if you had one
#[cfg_attr(feature = "cli", derive(clap::ValueEnum, strum_macros::Display))]
pub enum Algorithm {
    #[default]
    None,
    FloydSteinberg,
    // Future dithering algorithms can be added here
}

/// Applies the Floyd-Steinberg dithering algorithm to the image.
/// This function modifies the `image` in place.
pub(crate) fn floyd_steinberg(
    image: &mut RgbaImage,
    config: &Config,
    lab_colors: &[Lab], // These are the Lab representations of config.palette.colors
) -> Result<()> {
    log::debug!(
        "Applying Floyd-Steinberg dithering with mapping: {:?}",
        config.mapping
    );
    let width = image.width() as usize;
    let height = image.height() as usize;

    // Error buffers for R, G, B channels for the current and next row
    let mut error_r_rows: [Vec<f32>; 2] = [vec![0.0; width], vec![0.0; width]];
    let mut error_g_rows: [Vec<f32>; 2] = [vec![0.0; width], vec![0.0; width]];
    let mut error_b_rows: [Vec<f32>; 2] = [vec![0.0; width], vec![0.0; width]];

    for y in 0..height {
        let current_row_idx = y % 2;
        let next_row_idx = (y + 1) % 2;

        // Clear the next row's error buffer for the *actual* next image row
        if y + 1 < height {
            error_r_rows[next_row_idx].fill(0.0);
            error_g_rows[next_row_idx].fill(0.0);
            error_b_rows[next_row_idx].fill(0.0);
        }

        for x in 0..width {
            let original_pixel_rgba = image.get_pixel(x as u32, y as u32);

            // Handle fully transparent pixels based on threshold
            // If Mapping::Smoothed is used with dithering, alpha is preserved later,
            // so we don't make it fully transparent here unless it's already very low.
            if original_pixel_rgba.0[3] < config.transparency_threshold
                && !(config.mapping == Mapping::Smoothed
                    && config.dithering_algorithm != Algorithm::None)
            {
                image.put_pixel(x as u32, y as u32, Rgba([0, 0, 0, 0]));
                // Reset error for this pixel if it's made transparent
                error_r_rows[current_row_idx][x] = 0.0;
                error_g_rows[current_row_idx][x] = 0.0;
                error_b_rows[current_row_idx][x] = 0.0;
                continue;
            }

            // Determine the "target color" (as RGB components) to which error will be added.
            let target_rgb_components_before_error: [u8; 3];

            match config.mapping {
                Mapping::SmoothedPalettized => {
                    let original_lab = original_pixel_rgba.to_lab();
                    // Get the smoothed intermediate color
                    let smoothed_intermediate_lab =
                        smoothed::closest_rgb(&original_lab, lab_colors, config).to_lab();
                    // Convert its RGB components to be the target for error addition
                    target_rgb_components_before_error = smoothed_intermediate_lab.to_rgb().0;
                }
                Mapping::Palettized | Mapping::Smoothed => {
                    // If Smoothed + Dithering, we treat the original pixel as the target for error addition.
                    // The "smoothing" aspect (generating non-palette colors) is not directly used as input to error.
                    // The final color will be from the palette due to dithering's nature.
                    target_rgb_components_before_error = [
                        original_pixel_rgba.0[0],
                        original_pixel_rgba.0[1],
                        original_pixel_rgba.0[2],
                    ];
                }
            }

            // Add diffused error to the R, G, B components of the target_rgb_components_before_error
            let r_mod =
                target_rgb_components_before_error[0] as f32 + error_r_rows[current_row_idx][x];
            let g_mod =
                target_rgb_components_before_error[1] as f32 + error_g_rows[current_row_idx][x];
            let b_mod =
                target_rgb_components_before_error[2] as f32 + error_b_rows[current_row_idx][x];

            let r_clamped = r_mod.clamp(0.0, 255.0) as u8;
            let g_clamped = g_mod.clamp(0.0, 255.0) as u8;
            let b_clamped = b_mod.clamp(0.0, 255.0) as u8;

            // This is the color (original/smoothed-target + error) that we now need to quantize to the palette.
            // Convert it to Lab for palettized::closest_rgb.
            let lab_of_error_adjusted_color =
                Rgba([r_clamped, g_clamped, b_clamped, original_pixel_rgba.0[3]]).to_lab();

            // Quantization step: ALWAYS find the closest color from the actual palette.
            // The `config.palettized_formula` is used here.
            let quantized_rgb: Rgb<u8> =
                palettized::closest_rgb(&lab_of_error_adjusted_color, lab_colors, config);

            // Determine final alpha for the output pixel
            let final_alpha = if config.mapping == Mapping::Smoothed {
                // If Smoothed mapping (dithering on or off), preserve original alpha.
                // Color is palettized if dithering is on.
                original_pixel_rgba.0[3]
            } else {
                // Palettized or SmoothedPalettized: alpha becomes opaque (255)
                // (unless it was made fully transparent by the threshold check earlier).
                255
            };

            image.put_pixel(
                x as u32,
                y as u32,
                Rgba([
                    quantized_rgb.0[0],
                    quantized_rgb.0[1],
                    quantized_rgb.0[2],
                    final_alpha,
                ]),
            );

            // Calculate quantization error based on the (target_rgb_components + error) and the final quantized_rgb
            let err_r = r_mod - quantized_rgb.0[0] as f32;
            let err_g = g_mod - quantized_rgb.0[1] as f32;
            let err_b = b_mod - quantized_rgb.0[2] as f32;

            // Distribute error
            // Right: (x+1, y) -> current_row_idx
            if x + 1 < width {
                error_r_rows[current_row_idx][x + 1] += err_r * 7.0 / 16.0;
                error_g_rows[current_row_idx][x + 1] += err_g * 7.0 / 16.0;
                error_b_rows[current_row_idx][x + 1] += err_b * 7.0 / 16.0;
            }
            // Bottom-left: (x-1, y+1) -> next_row_idx
            if x > 0 && y + 1 < height {
                error_r_rows[next_row_idx][x - 1] += err_r * 3.0 / 16.0;
                error_g_rows[next_row_idx][x - 1] += err_g * 3.0 / 16.0;
                error_b_rows[next_row_idx][x - 1] += err_b * 3.0 / 16.0;
            }
            // Bottom: (x, y+1) -> next_row_idx
            if y + 1 < height {
                error_r_rows[next_row_idx][x] += err_r * 5.0 / 16.0;
                error_g_rows[next_row_idx][x] += err_g * 5.0 / 16.0;
                error_b_rows[next_row_idx][x] += err_b * 5.0 / 16.0;
            }
            // Bottom-right: (x+1, y+1) -> next_row_idx
            if x + 1 < width && y + 1 < height {
                error_r_rows[next_row_idx][x + 1] += err_r * 1.0 / 16.0;
                error_g_rows[next_row_idx][x + 1] += err_g * 1.0 / 16.0;
                error_b_rows[next_row_idx][x + 1] += err_b * 1.0 / 16.0;
            }
        }
    }
    Ok(())
}
