mod cache;
mod color;
mod config;
mod delta_e;
mod error;
mod gif;
mod lut;
mod processing;
mod validation;

#[cfg(feature = "wasm")]
mod wasm_api;

pub use config::{Config, DeltaEMethod, Mapping, WeightingKernelType};
pub use error::PalettumError;
pub use image::{imageops::FilterType, Rgb, Rgba, RgbaImage};

use crate::color::ConvertToLab;
use rayon::ThreadPoolBuilder;

fn calculate_resize_dimensions(
    orig_width: u32,
    orig_height: u32,
    target_width: Option<u32>,
    target_height: Option<u32>,
) -> Option<(u32, u32)> {
    match (target_width, target_height) {
        (Some(w), Some(h)) => Some((w, h)),
        (Some(w), None) => {
            if orig_width == 0 {
                return None;
            }
            let ratio = w as f64 / orig_width as f64;
            let h = (orig_height as f64 * ratio).round() as u32;
            Some((w, h.max(1)))
        }
        (None, Some(h)) => {
            if orig_height == 0 {
                return None;
            }
            let ratio = h as f64 / orig_height as f64;
            let w = (orig_width as f64 * ratio).round() as u32;
            Some((w.max(1), h))
        }
        (None, None) => None,
    }
}

pub fn palettify_image(image: &mut RgbaImage, config: &Config) -> Result<(), PalettumError> {
    log::debug!(
        "Starting image palettification: mapping={:?}, delta_e={:?}, quant={}, palette_size={}, threads={}",
        config.mapping,
        config.delta_e_method,
        config.quant_level,
        config.palette.len(),
        if config.num_threads <= 1 { "Sequential".to_string() } else { config.num_threads.to_string() },
    );

    let mut owned_image: Option<RgbaImage> = None;
    let _image_ref = if let Some((new_w, new_h)) = calculate_resize_dimensions(
        image.width(),
        image.height(),
        config.resize_width,
        config.resize_height,
    ) {
        if new_w == 0 || new_h == 0 {
            log::warn!(
                "Skipping resize: Calculated dimensions are zero ({}, {}).",
                new_w,
                new_h
            );
            &*image
        } else if new_w == image.width() && new_h == image.height() {
            log::debug!("Skipping resize: Target dimensions match original.");
            &*image
        } else {
            log::info!(
                "Resizing image from {}x{} to {}x{} using filter {:?}",
                image.width(),
                image.height(),
                new_w,
                new_h,
                config.resize_filter
            );
            let resized = image::imageops::resize(image, new_w, new_h, config.resize_filter);
            owned_image = Some(resized);
            owned_image.as_ref().unwrap()
        }
    } else {
        &*image
    };

    if let Some(resized_img) = owned_image {
        *image = resized_img;
    }

    let process = |img: &mut RgbaImage, cfg: &Config| -> Result<(), PalettumError> {
        let lab_palette = if cfg.mapping != config::Mapping::Untouched {
            if cfg.palette.is_empty() && cfg.mapping != Mapping::Smoothed {
                return Err(PalettumError::EmptyPalette);
            }
            log::debug!("Precomputing Lab palette...");
            cfg.palette.iter().map(|rgb| rgb.to_lab()).collect()
        } else {
            Vec::new()
        };

        let image_size = img.width() as usize * img.height() as usize;
        let lookup = lut::generate_lookup_table(cfg, &lab_palette, Some(image_size))?;

        processing::process_pixels(
            img,
            cfg,
            &lab_palette,
            if lookup.is_empty() {
                None
            } else {
                Some(&lookup)
            },
        )?;

        Ok(())
    };

    if config.num_threads > 1 {
        log::debug!(
            "Using Rayon thread pool with {} threads.",
            config.num_threads
        );
        let pool = ThreadPoolBuilder::new()
            .num_threads(config.num_threads)
            .build()
            .map_err(|e| PalettumError::ThreadPoolBuildError(e.to_string()))?;

        pool.install(|| process(image, config))
    } else {
        log::debug!("Running sequentially (num_threads <= 1).");
        process(image, config)
    }
}

pub use gif::palettify_gif;
pub use validation::validate;
