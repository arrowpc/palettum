use image::ImageFormat;
use palettum::{error::Result, Config, Filter, Gif, Ico, Image, Mapping};
use std::result::Result as StdResult;
use wasm_bindgen::prelude::*;
use web_time::Instant;

// TODO:
// pub use wasm_bindgen_rayon::init_thread_pool;

#[wasm_bindgen(start)]
pub fn wasm_init() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_logger::init(wasm_logger::Config::default());
    log::info!("palettum WASM module initialized");
}

#[wasm_bindgen]
pub fn palettify(image_bytes: Vec<u8>, config: Config) -> StdResult<Vec<u8>, JsValue> {
    _palettify(image_bytes, config).map_err(|e| JsValue::from_str(&e.to_string()))
}

fn _palettify(image_bytes: Vec<u8>, config: Config) -> Result<Vec<u8>> {
    let start_time = Instant::now();
    log::info!("Received image bytes for processing in WASM...");

    let filter = match config.mapping {
        Mapping::Smoothed => Filter::Lanczos3,
        _ => Filter::Nearest,
    };

    let bytes = image_bytes.to_vec();
    let format = image::guess_format(&bytes)?;
    log::info!("Using config: {}", config);
    log::info!("Resize filter: {:?} ", filter);

    let output_bytes = match format {
        ImageFormat::Gif => {
            log::info!("Detected GIF format, processing animation...");
            let mut gif = Gif::from_memory(&bytes)?;
            gif.resize(
                config.resize_width,
                config.resize_height,
                config.resize_scale,
                filter,
            )?;
            gif.palettify(&config)?;
            gif.write_to_memory()?
        }
        ImageFormat::Ico => {
            log::info!("Detected Ico format, processing icons...");
            let mut ico = Ico::from_memory(&bytes)?;
            ico.resize(
                config.resize_width,
                config.resize_height,
                config.resize_scale,
                filter,
            )?;
            ico.palettify(&config)?;
            ico.write_to_memory()?
        }
        _ => {
            log::info!("Detected static image format ({:?}), processing...", format);
            let mut img = Image::from_memory(&bytes)?;
            img.resize(
                config.resize_width,
                config.resize_height,
                config.resize_scale,
                filter,
            )?;
            img.palettify(&config)?;
            img.write_to_memory()?
        }
    };

    let duration = start_time.elapsed();
    log::info!("Palettification completed in {:?}", duration);
    Ok(output_bytes)
}
