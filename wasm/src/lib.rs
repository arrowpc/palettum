use image::EncodableLayout;
use palettum::{
    error::Result,
    gpu::utils::get_gpu_instance,
    media::{load_media_from_memory, Gif as CoreGif, Image},
    process_pixels, Config, Filter, Palette,
};
use std::result::Result as StdResult;
use wasm_bindgen::prelude::*;
use wasm_bindgen::Clamped;
use wasm_bindgen_futures::js_sys::Uint8Array;
use web_time::Instant;

#[wasm_bindgen(start)]
pub fn wasm_init() {
    console_error_panic_hook::set_once();
    wasm_logger::init(wasm_logger::Config::new(log::Level::Info));
    log::info!("palettum WASM module initialized");
}

#[wasm_bindgen]
pub async fn palettify(bytes: Vec<u8>) -> Result<Vec<u8>> {
    let start_time = Instant::now();
    log::info!("Received image bytes for processing in WASM...");

    let bytes = bytes.to_vec();
    let mut media = load_media_from_memory(&bytes)?;
    let instance = get_gpu_instance().await?;
    let config = instance.config.read();
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
pub async fn palettify_frame(bytes: &mut [u8], width: u32, height: u32) -> Result<()> {
    let instance = get_gpu_instance().await?;
    let config = instance.config.read();
    process_pixels(bytes, width, height, &config).await
}

#[wasm_bindgen]
#[wasm_bindgen]
pub struct ResizedFrame {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl ResizedFrame {
    #[wasm_bindgen(getter)]
    pub fn bytes(&self) -> Vec<u8> {
        self.bytes.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }
}

#[wasm_bindgen]
pub async fn resize_frame(bytes: Vec<u8>, width: u32, height: u32) -> Result<ResizedFrame> {
    let instance = get_gpu_instance().await?;
    let config = instance.config.read();
    let mut image = Image {
        buffer: image::RgbaImage::from_raw(width, height, bytes).ok_or(
            palettum::error::Error::Internal(
                "Failed to create RgbaImage from raw bytes".to_string(),
            ),
        )?,
        width,
        height,
        palette: None,
    };

    image.resize(
        config.resize_width,
        config.resize_height,
        config.resize_scale,
        config.filter,
    )?;

    Ok(ResizedFrame {
        bytes: image.as_bytes(),
        width: image.width(),
        height: image.height(),
    })
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

    pub async fn palettify(&mut self) -> Result<()> {
        let instance = get_gpu_instance().await?;
        let config = instance.config.read();
        self.gif.palettify(&config).await?;
        Ok(())
    }

    pub async fn resize(&mut self) -> Result<()> {
        let instance = get_gpu_instance().await?;
        let config = instance.config.read();
        self.gif.resize(
            config.resize_width,
            config.resize_height,
            config.resize_scale,
            config.filter,
        )?;
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
