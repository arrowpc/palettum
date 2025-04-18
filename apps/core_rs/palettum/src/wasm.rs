#![cfg(feature = "wasm")]
use crate::{
    config::{Config, DeltaEMethod, Mapping, WeightingKernelType},
    error::PalettumError,
    gif::{palettify_gif, Gif},
    image::{palettify_image, Image},
};
use image::{ImageBuffer, ImageFormat, RgbaImage};
use js_sys::Uint8Array;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use wasm_bindgen::prelude::*;

// TODO:
// pub use wasm_bindgen_rayon::init_thread_pool;

#[wasm_bindgen(start)]
pub fn wasm_init() {
    #[cfg(feature = "console_error_panic_hook")]
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    #[cfg(feature = "wasm-logger")]
    wasm_logger::init(wasm_logger::Config::default());
    log::info!("palettum WASM module initialized");
}

fn to_js_error(err: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&err.to_string())
}

#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONFIG: &'static str = r#"
/** Configuration options for palettum processing in WASM. */
export interface PalettumWasmConfig {
    /** Array of palette colors, each with r, g, b properties (0-255). */
    palette: Array<{ r: number; g: number; b: number }>;
    /** The mapping algorithm to use. Defaults to 'SMOOTHED'. */
    mapping?: 'PALETTIZED' | 'SMOOTHED' | 'SMOOTHED-PALETTIZED';
    /** The Delta E method for color difference calculation. Defaults to 'CIEDE2000'. */
    deltaEMethod?: 'CIE76' | 'CIE94' | 'CIEDE2000';
    /** Quantization level for LUT optimization (0=disabled, 1-5). Defaults to 0. */
    quantLevel?: number;
    /** Alpha threshold below which pixels are treated as fully transparent (0-255). Defaults to 128. */
    transparencyThreshold?: number;
    /** Weighting kernel for 'SMOOTHED' and 'SMOOTHED-PALETTIZED' mappings. Defaults to 'INVERSE_DISTANCE_POWER'. */
    anisotropicKernel?: 'GAUSSIAN' | 'INVERSE_DISTANCE_POWER';
    /** Shape parameter for the Gaussian kernel. Defaults to 0.08. */
    anisotropicShapeParameter?: number;
    /** Power parameter for the Inverse Distance Power kernel. Defaults to 3.5. */
    anisotropicPowerParameter?: number;
    /** Scaling factors [L, A, B] for Lab color space distance in smoothing. Defaults to [1.0, 1.0, 1.0]. */
    anisotropicLabScales?: [number, number, number];
    /** Target width for resizing (pixels). If omitted/null, aspect ratio is preserved based on height. */
    resizeWidth?: number | null;
    /** Target height for resizing (pixels). If omitted/null, aspect ratio is preserved based on width. */
    resizeHeight?: number | null;
}
"#;

#[wasm_bindgen]
pub fn processImageBytes(
    image_bytes: Uint8Array,
    config_js: JsValue,
) -> Result<Uint8Array, JsValue> {
    log::info!("Received image bytes for processing in WASM...");

    let config: Config = serde_wasm_bindgen::from_value(config_js)
        .map_err(|e| to_js_error(format!("Invalid config: {}", e)))?;

    if config.palette.is_empty() {
        return Err(to_js_error("Palette cannot be empty."));
    }

    if config.resize_width == Some(0) || config.resize_height == Some(0) {
        return Err(to_js_error(
            "Resize width and height must be greater than 0 if specified.",
        ));
    }

    let bytes = image_bytes.to_vec();
    let format = image::guess_format(&bytes).map_err(to_js_error)?;

    let output_bytes = match format {
        ImageFormat::Gif => {
            log::info!("Detected GIF format, processing animation...");
            // let gif = Gif::from_bytes(&bytes).map_err(to_js_error)?;
            // let palettified_gif = palettify_gif(&gif, &config).map_err(to_js_error)?;
            // palettified_gif.write_to_memory().map_err(to_js_error)?
            let gif = Gif::from_bytes(&bytes).map_err(to_js_error)?;
            let res = palettify_gif(&gif, &config).map_err(to_js_error)?;
            res.write_to_memory().map_err(to_js_error)?
        }
        ImageFormat::Png
        | ImageFormat::Jpeg
        | ImageFormat::WebP
        | ImageFormat::Bmp
        | ImageFormat::Tiff
        | _ => {
            log::info!("Detected static image format ({:?}), processing...", format);
            // let img = image::load_from_memory(&bytes).map_err(to_js_error)?;
            let img = Image::from_bytes(&bytes).map_err(to_js_error)?;
            let res = palettify_image(&img, &config).map_err(to_js_error)?;
            res.write_to_memory(ImageFormat::Png).map_err(to_js_error)?
        }
    };

    log::info!("Image processing complete, returning output bytes.");
    Ok(Uint8Array::from(&output_bytes[..]))
}
