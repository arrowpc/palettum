use crate::image::Image;

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
