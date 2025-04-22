use crate::config::Config;
use crate::image::Image;
use image::Rgba;
use image::{Rgb, RgbaImage};
use std::collections::HashMap;
use std::collections::HashSet;

// This function should probably be moved to tests, as I don't see much of a usecase outside of
// testing.
// Also should use local Image instead of RgbaImage
pub fn validate_image(image: &RgbaImage, config: &Config) -> bool {
    log::debug!("Validating image against palette...");
    let palette_lookup: HashSet<Rgb<u8>> = config.palette.iter().cloned().collect();
    let height = image.height();
    let width = image.width();

    for y in 0..height {
        for x in 0..width {
            let current_pixel = image.get_pixel(x, y);

            if current_pixel.0[3] >= config.transparency_threshold {
                let pixel_rgb = Rgb([current_pixel.0[0], current_pixel.0[1], current_pixel.0[2]]);
                if !palette_lookup.contains(&pixel_rgb) {
                    log::debug!(
                        "Validation failed: Pixel {:?} at ({}, {}) not in palette.",
                        pixel_rgb,
                        x,
                        y
                    );
                    return false;
                }
            }
        }
    }
    log::debug!("Image validation successful.");
    return true;
}

pub fn resize_image_if_needed(
    image: &Image,
    target_width: Option<u32>,
    target_height: Option<u32>,
    filter: image::imageops::FilterType,
) -> Image {
    match (target_width, target_height) {
        (Some(new_w), Some(new_h)) if new_w > 0 && new_h > 0 => {
            if new_w != image.width || new_h != image.height {
                log::debug!(
                    "Resizing image from {}x{} to {}x{} using filter {:?}",
                    image.width,
                    image.height,
                    new_w,
                    new_h,
                    filter
                );
                Image {
                    buffer: image::imageops::resize(&image.buffer, new_w, new_h, filter),
                    width: new_h,
                    height: new_h,
                }
            } else {
                log::debug!("Skipping resize: Target dimensions match original.");
                image.clone()
            }
        }
        _ => {
            log::debug!("Skipping resize: No valid dimensions provided.");
            image.clone()
        }
    }
}

#[derive(Debug)]
pub(crate) struct ThreadLocalCache {
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
