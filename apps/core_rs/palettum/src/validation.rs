use crate::config::{Config, Mapping};
use crate::error::PalettumError;
use image::{Rgb, RgbaImage};
use std::collections::HashSet;

pub fn validate(image: &RgbaImage, config: &Config) -> Result<(), PalettumError> {
    let should_be_palettized = matches!(
        config.mapping,
        Mapping::Palettized | Mapping::SmoothedPalettized
    );
    if !should_be_palettized {
        return Err(PalettumError::ValidationInvalidMapping);
    }
    if config.palette.is_empty() {
        return Err(PalettumError::ValidationPaletteEmpty);
    }

    log::info!("Validating image against palette...");
    let palette_lookup: HashSet<Rgb<u8>> = config.palette.iter().cloned().collect();
    let height = image.height();
    let width = image.width();

    for y in 0..height {
        for x in 0..width {
            let current_pixel = image.get_pixel(x, y);

            if current_pixel.0[3] >= config.transparency_threshold {
                let pixel_rgb = Rgb([current_pixel.0[0], current_pixel.0[1], current_pixel.0[2]]);
                if !palette_lookup.contains(&pixel_rgb) {
                    log::error!(
                        "Validation failed: Pixel {:?} at ({}, {}) not in palette.",
                        pixel_rgb,
                        x,
                        y
                    );
                    return Err(PalettumError::ValidationPixelNotInPalette(pixel_rgb, x, y));
                }
            }
        }
    }
    log::info!("Image validation successful.");
    Ok(())
}
