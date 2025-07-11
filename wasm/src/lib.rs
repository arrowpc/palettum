use image::EncodableLayout;
use once_cell::sync::Lazy;
use palettum::{
    error::Result,
    gpu::{self},
    media::{load_media_from_memory, Gif as CoreGif},
    Config, Filter, Media, Palette,
};
use std::{result::Result as StdResult, sync::Mutex};
use wasm_bindgen::prelude::*;
use wasm_bindgen::Clamped;
use wasm_bindgen_futures::js_sys::Uint8Array;
use web_time::Instant;

#[wasm_bindgen(start)]
pub fn wasm_init() {
    console_error_panic_hook::set_once();
    wasm_logger::init(wasm_logger::Config::default());
    log::info!("palettum WASM module initialized");
}

#[wasm_bindgen]
pub async fn palettify(image_bytes: Vec<u8>, config: Config) -> Result<Vec<u8>> {
    let start_time = Instant::now();
    log::info!("Received image bytes for processing in WASM...");

    log::info!("Using config: {}", config);

    let bytes = image_bytes.to_vec();
    let mut media = load_media_from_memory(&bytes)?;
    // media.resize(
    //     config.resize_width,
    //     config.resize_height,
    //     config.filter,
    // )?;
    media.palettify(&config).await?;

    let duration = start_time.elapsed();
    log::info!("Palettification completed in {:?}", duration);

    media.write_to_memory()
}

#[wasm_bindgen]
pub struct Gif {
    gif: CoreGif,
}

#[wasm_bindgen]
impl Gif {
    #[wasm_bindgen(constructor)]
    pub fn from_bytes(gif_bytes: &[u8]) -> Result<Gif> {
        let gif = CoreGif::from_memory(gif_bytes)?;
        Ok(Gif { gif })
    }

    #[wasm_bindgen(getter)]
    pub fn num_frames(&self) -> usize {
        self.gif.frames.len()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.gif.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.gif.height
    }

    pub fn get_frame_data(&self, frame_idx: usize) -> Result<Clamped<Uint8Array>> {
        if frame_idx >= self.gif.frames.len() {
            return Err(
                palettum::error::Error::Internal("Frame index out of bounds".to_string()).into(),
            );
        }
        let frame = &self.gif.frames[frame_idx];

        let buffer = frame.buffer().as_bytes();
        Ok(Clamped(Uint8Array::from(buffer)))
    }

    pub fn get_frame_delay(&self, frame_idx: usize) -> u16 {
        self.gif.get_frame_delay(frame_idx)
    }

    pub async fn palettify(&mut self, config: Config) -> Result<()> {
        self.gif.palettify(&config).await?;
        Ok(())
    }

    pub async fn resize(
        &mut self,
        target_width: Option<u32>,
        target_height: Option<u32>,
        scale: Option<f32>,
        filter: Filter,
    ) -> Result<()> {
        self.gif
            .resize(target_width, target_height, scale, filter.into())?;
        Ok(())
    }

    pub fn to_bytes(&self) -> Result<Uint8Array> {
        let bytes = self.gif.write_to_memory()?;
        Ok(Uint8Array::from(bytes.as_slice()))
    }
}

#[wasm_bindgen]
pub fn palette_from_media(media_bytes: Vec<u8>, k_colors: usize) -> StdResult<Palette, JsValue> {
    let bytes = media_bytes.to_vec();
    let media = load_media_from_memory(&bytes)?;
    Ok(Palette::from_media(&media, k_colors)?)
}
