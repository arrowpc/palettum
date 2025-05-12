use bon::Builder;
use std::fmt;

#[cfg(feature = "wasm")]
use crate::color::rgb_vec_serde;
#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

use crate::{errors::Errors, palettized, smoothed};

use image::{imageops::FilterType, Rgb};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
pub enum Mapping {
    Palettized,
    #[default]
    Smoothed,
    SmoothedPalettized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub struct Filter(pub FilterType);

impl Default for Filter {
    fn default() -> Self {
        Filter(FilterType::Lanczos3)
    }
}

impl From<Filter> for image::imageops::FilterType {
    fn from(f: Filter) -> Self {
        f.0
    }
}

#[derive(Debug, Clone, Builder)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize, Default))]
#[cfg_attr(feature = "wasm", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wasm", serde(default))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Config {
    #[cfg_attr(feature = "wasm", serde(with = "rgb_vec_serde"))]
    pub palette: Vec<Rgb<u8>>,
    #[builder(default)]
    pub mapping: Mapping,
    #[cfg_attr(feature = "wasm", tsify(type = "PalettizedFormula"))]
    #[builder(default)]
    pub palettized_formula: palettized::Formula,
    #[builder(default = 0)]
    pub quant_level: u8,
    #[builder(default = 128)]
    pub transparency_threshold: u8,
    #[builder(default = num_cpus::get())]
    #[cfg_attr(feature = "wasm", serde(skip))]
    pub num_threads: usize,
    #[cfg_attr(feature = "wasm", tsify(type = "SmoothedFormula"))]
    #[builder(default = smoothed::Formula::Idw)]
    pub smoothed_formula: smoothed::Formula,
    #[builder(default = 0.5)]
    pub smoothing_strength: f32,
    #[builder(default = [1.0, 1.0, 1.0])]
    pub lab_scales: [f32; 3],
    pub resize_width: Option<u32>,
    pub resize_height: Option<u32>,
    pub resize_scale: Option<f32>,
    #[builder(default)]
    pub resize_filter: Filter,
}

impl fmt::Display for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Config {{
    palette: [{}],
    mapping: {:?},
    palettized_formula: {:?},
    quant_level: {},
    transparency_threshold: {},
    num_threads: {},
    smoothed_formula: {:?},
    smoothing_strength: {},
    lab_scales: [{}, {}, {}],
    resize_width: {:?},
    resize_height: {:?},
    resize_scale: {:?},
    resize_filter: {:?},
}}",
            self.palette
                .iter()
                .map(|c| format!("{:?}", c))
                .collect::<Vec<_>>()
                .join(", "),
            self.mapping,
            self.palettized_formula,
            self.quant_level,
            self.transparency_threshold,
            self.num_threads,
            self.smoothed_formula,
            self.smoothing_strength,
            self.lab_scales[0],
            self.lab_scales[1],
            self.lab_scales[2],
            self.resize_width,
            self.resize_height,
            self.resize_scale,
            self.resize_filter,
        )
    }
}

impl Config {
    const MAX_QUANT_LEVEL: u8 = 5;

    pub fn validate(&self) -> Result<(), Errors> {
        if self.palette.is_empty() {
            return Err(Errors::EmptyPalette);
        }

        if self.quant_level > Self::MAX_QUANT_LEVEL {
            return Err(Errors::InvalidQuantLevel {
                value: self.quant_level,
                max: Self::MAX_QUANT_LEVEL,
            });
        }

        if self.smoothing_strength < 0.0 || self.smoothing_strength > 1.0 {
            return Err(Errors::InvalidsmoothingStrength(self.smoothing_strength));
        }

        if self.lab_scales.iter().any(|&scale| scale <= 0.0) {
            return Err(Errors::InvalidLabScales);
        }

        if let Some(width) = self.resize_width {
            if width == 0 {
                return Err(Errors::InvalidResizeDimensions);
            }
        }

        if let Some(height) = self.resize_height {
            if height == 0 {
                return Err(Errors::InvalidResizeDimensions);
            }
        }

        if let Some(scale) = self.resize_scale {
            if scale < 0.0 {
                return Err(Errors::InvalidResizeScale);
            }
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.num_threads > num_cpus::get() {
            return Err(Errors::InvalidThreadCount(num_cpus::get()));
        }

        Ok(())
    }

    pub fn validated(config: Self) -> Result<Self, Errors> {
        config.validate()?;
        Ok(config)
    }
}
