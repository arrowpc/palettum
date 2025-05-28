use bon::Builder;
use std::fmt;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

use crate::{
    color_difference,
    error::{Error, Result},
    palettized, smoothed, Filter, Mapping, Palette,
};

// TODO: Use states to define whether or not a configuration has been validated to avoid redundant
// validations
//
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

    #[cfg_attr(feature = "wasm", tsify(type = "DiffFormula"))]
    #[builder(default)]
    pub diff_formula: color_difference::Formula,

    #[builder(default = 0)]
    pub quant_level: u8,

    #[builder(default = 128)]
    pub transparency_threshold: u8,

    #[builder(default = num_cpus::get())]
    #[cfg_attr(feature = "wasm", serde(skip))]
    pub num_threads: usize,

    #[cfg_attr(feature = "wasm", tsify(type = "SmoothFormula"))]
    #[builder(default = smoothed::Formula::Idw)]
    pub smooth_formula: smoothed::Formula,

    #[builder(default = 0.5)]
    pub smooth_strength: f32,

    #[cfg_attr(feature = "wasm", tsify(type = "DitherAlgorithm"))]
    #[builder(default)]
    pub dither_algorithm: palettized::Dithering,

    #[builder(default = 0.5)]
    pub dither_strength: f32,

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    pub resize_width: Option<u32>,

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    pub resize_height: Option<u32>,

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    pub resize_scale: Option<f32>,

    #[cfg_attr(all(feature = "serde", not(feature = "wasm")), serde(skip))]
    #[builder(default)]
    pub filter: Filter,
}

impl fmt::Display for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Config {{ palette: ..., mapping: {:?}, color_diff_formula: {:?}, quant_level: {}, transparency_threshold: {}, num_threads: {}, smoothed_formula: {:?}, smoothing_strength: {}, dithering_algorithm: {:?}, dithering_strength: {:?} }}",
            self.mapping,
            self.diff_formula,
            self.quant_level,
            self.transparency_threshold,
            self.num_threads,
            self.smooth_formula,
            self.smooth_strength,
            self.dither_algorithm,
            self.dither_strength,
        )
    }
}

impl Config {
    const MAX_QUANT_LEVEL: u8 = 5;
    const MAX_PALETTE_SIZE: usize = 255; // Actual max is 256, but 1 is reserved for transparency

    pub fn validate(&self) -> Result<()> {
        if self.palette.colors.is_empty() || self.palette.colors.len() > 256 {
            return Err(Error::InvalidPaletteSize {
                size: self.palette.colors.len(),
                max: Self::MAX_PALETTE_SIZE,
            });
        }

        if self.quant_level > Self::MAX_QUANT_LEVEL {
            return Err(Error::InvalidQuantLevel {
                value: self.quant_level,
                max: Self::MAX_QUANT_LEVEL,
            });
        }

        if self.smooth_strength < 0.0 || self.smooth_strength > 1.0 {
            return Err(Error::InvalidSmoothStrength(self.smooth_strength));
        }

        if self.dither_strength < 0.0 || self.dither_strength > 1.0 {
            return Err(Error::InvalidDitherStrength(self.dither_strength));
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
