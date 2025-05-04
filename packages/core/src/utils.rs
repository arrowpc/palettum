use crate::image::Image;
use image::Rgba;
use std::collections::HashMap;

pub fn resize_image_if_needed(
    image: &Image,
    target_width: Option<u32>,
    target_height: Option<u32>,
    scale: Option<f32>,
    filter: image::imageops::FilterType,
) -> Image {
    fn apply_scale(dim: u32, scale: Option<f32>) -> u32 {
        match scale {
            Some(s) if s > 0.0 => ((dim as f32) * s).round() as u32,
            _ => dim,
        }
    }

    match (target_width, target_height, scale) {
        // Both width and height specified
        (Some(new_w), Some(new_h), scale) if new_w > 0 && new_h > 0 => {
            let scaled_w = apply_scale(new_w, scale);
            let scaled_h = apply_scale(new_h, scale);

            if scaled_w != image.width || scaled_h != image.height {
                log::debug!(
                    "Resizing image from {}x{} to {}x{} using filter {:?}",
                    image.width,
                    image.height,
                    scaled_w,
                    scaled_h,
                    filter
                );
                Image {
                    buffer: image::imageops::resize(&image.buffer, scaled_w, scaled_h, filter),
                    width: scaled_w,
                    height: scaled_h,
                }
            } else {
                log::debug!("Skipping resize: Target dimensions match original.");
                image.clone()
            }
        }
        // Only width specified, preserve aspect ratio
        (Some(new_w), None, scale) if new_w > 0 => {
            let aspect_ratio = image.height as f32 / image.width as f32;
            let new_h = (new_w as f32 * aspect_ratio).round() as u32;

            let scaled_w = apply_scale(new_w, scale);
            let scaled_h = apply_scale(new_h, scale);

            if scaled_w != image.width || scaled_h != image.height {
                log::debug!(
                    "Resizing image from {}x{} to {}x{} (preserved aspect ratio) using filter {:?}",
                    image.width,
                    image.height,
                    scaled_w,
                    scaled_h,
                    filter
                );
                Image {
                    buffer: image::imageops::resize(&image.buffer, scaled_w, scaled_h, filter),
                    width: scaled_w,
                    height: scaled_h,
                }
            } else {
                log::debug!("Skipping resize: Target dimensions match original.");
                image.clone()
            }
        }
        // Only height specified, preserve aspect ratio
        (None, Some(new_h), scale) if new_h > 0 => {
            let aspect_ratio = image.width as f32 / image.height as f32;
            let new_w = (new_h as f32 * aspect_ratio).round() as u32;

            let scaled_w = apply_scale(new_w, scale);
            let scaled_h = apply_scale(new_h, scale);

            if scaled_w != image.width || scaled_h != image.height {
                log::debug!(
                    "Resizing image from {}x{} to {}x{} (preserved aspect ratio) using filter {:?}",
                    image.width,
                    image.height,
                    scaled_w,
                    scaled_h,
                    filter
                );
                Image {
                    buffer: image::imageops::resize(&image.buffer, scaled_w, scaled_h, filter),
                    width: scaled_w,
                    height: scaled_h,
                }
            } else {
                log::debug!("Skipping resize: Target dimensions match original.");
                image.clone()
            }
        }
        // Only scale specified
        (None, None, Some(s)) if s > 0.0 && (image.width > 0 && image.height > 0) => {
            let scaled_w = apply_scale(image.width, Some(s));
            let scaled_h = apply_scale(image.height, Some(s));

            if scaled_w != image.width || scaled_h != image.height {
                log::debug!(
                    "Resizing image from {}x{} to {}x{} (scale only) using filter {:?}",
                    image.width,
                    image.height,
                    scaled_w,
                    scaled_h,
                    filter
                );
                Image {
                    buffer: image::imageops::resize(&image.buffer, scaled_w, scaled_h, filter),
                    width: scaled_w,
                    height: scaled_h,
                }
            } else {
                log::debug!("Skipping resize: Target dimensions match original.");
                image.clone()
            }
        }
        // No valid dimensions or scale provided
        _ => {
            log::debug!("Skipping resize: No valid dimensions or scale provided.");
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
