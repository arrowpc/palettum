use image::ImageFormat;
use palettum::{error::Result, Config, Gif, Image};
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
pub fn palettify(image_bytes: Vec<u8>, config: Config) -> Result<Vec<u8>, JsValue> {
    _palettify(image_bytes, config).map_err(|e| JsValue::from_str(&e.to_string()))
}

fn _palettify(image_bytes: Vec<u8>, config: Config) -> Result<Vec<u8>> {
    let start_time = Instant::now();
    log::info!("Received image bytes for processing in WASM...");

    let bytes = image_bytes.to_vec();
    let format = image::guess_format(&bytes)?;
    log::info!("Using config: {}", config);

    let output_bytes = match format {
        ImageFormat::Gif => {
            log::info!("Detected GIF format, processing animation...");
            let mut gif = Gif::from_memory(&bytes)?;
            gif.palettify(&config)?;
            gif.write_to_memory()?
        }
        _ => {
            log::info!("Detected static image format ({:?}), processing...", format);
            let mut img = Image::from_memory(&bytes)?;
            img.palettify(&config)?;
            img.write_to_memory()?
        }
    };

    let duration = start_time.elapsed();
    log::info!("Palettification completed in {:?}", duration);
    Ok(output_bytes)
}
