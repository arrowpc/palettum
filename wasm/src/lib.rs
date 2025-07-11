use once_cell::sync::Lazy;
use palettum::{
    error::Result,
    gpu::{self},
    media::load_media_from_memory,
    Config, Media, Palette,
};
use std::{result::Result as StdResult, sync::Mutex};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::js_sys::Uint8Array;
use web_time::Instant;

#[wasm_bindgen(start)]
pub fn wasm_init() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    wasm_logger::init(wasm_logger::Config::default());
    log::info!("palettum WASM module initialized");
}

#[wasm_bindgen]
pub async fn palettify(image_bytes: Vec<u8>, config: Config) -> Result<Vec<u8>> {
    let start_time = Instant::now();
    log::info!("Received image bytes for processing in WASM...");

    log::info!("Using config: {}", config);
    log::info!("Resize filter: {:?} ", config.filter);

    let bytes = image_bytes.to_vec();
    let mut media = load_media_from_memory(&bytes)?;
    media.resize(
        config.resize_width,
        config.resize_height,
        config.resize_scale,
        config.filter,
    )?;
    media.palettify(&config).await?;

    let duration = start_time.elapsed();
    log::info!("Palettification completed in {:?}", duration);

    media.write_to_memory()
}

#[wasm_bindgen]
pub fn palette_from_media(media_bytes: Vec<u8>, k_colors: usize) -> StdResult<Palette, JsValue> {
    let bytes = media_bytes.to_vec();
    let media = load_media_from_memory(&bytes)?;
    Ok(Palette::from_media(&media, k_colors)?)
}
