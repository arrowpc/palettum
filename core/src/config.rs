use bon::Builder;
use std::fmt;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

use crate::{
    error::{Error, Result},
    palettized, smoothed, Mapping, Palette,
};

// TODO: Remove WASM hacks
#[derive(Debug, Clone, Builder)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize, Default))]
#[cfg_attr(feature = "wasm", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "wasm", serde(default))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Config {
    pub palette: Palette,

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

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    pub resize_width: Option<u32>,

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    pub resize_height: Option<u32>,

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    pub resize_scale: Option<f32>,
}

impl fmt::Display for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Config {{ palette: ..., mapping: {:?}, palettized_formula: {:?}, quant_level: {}, transparency_threshold: {}, num_threads: {}, smoothed_formula: {:?}, smoothing_strength: {}, lab_scales: {:?} }}",
            self.mapping,
            self.palettized_formula,
            self.quant_level,
            self.transparency_threshold,
            self.num_threads,
            self.smoothed_formula,
            self.smoothing_strength,
            self.lab_scales,
        )
    }
}

impl Config {
    const MAX_QUANT_LEVEL: u8 = 5;

    pub fn validate(&self) -> Result<()> {
        if self.palette.colors.is_empty() {
            return Err(Error::EmptyPalette);
        }

        if self.quant_level > Self::MAX_QUANT_LEVEL {
            return Err(Error::InvalidQuantLevel {
                value: self.quant_level,
                max: Self::MAX_QUANT_LEVEL,
            });
        }

        if self.smoothing_strength < 0.0 || self.smoothing_strength > 1.0 {
            return Err(Error::InvalidsmoothingStrength(self.smoothing_strength));
        }

        if self.lab_scales.iter().any(|&scale| scale <= 0.0) {
            return Err(Error::InvalidLabScales);
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.num_threads > num_cpus::get() {
            return Err(Error::InvalidThreadCount(num_cpus::get()));
        }

        Ok(())
    }

    pub fn validated(config: Self) -> Result<Self> {
        config.validate()?;
        Ok(config)
    }
}
