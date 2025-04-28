#[cfg(feature = "serde")]
use crate::color::rgb_vec_serde;
use image::{imageops::FilterType, Rgb};
#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum Mapping {
    Palettized,
    Smoothed,
    SmoothedPalettized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum DeltaEMethod {
    CIE76,
    CIE94,
    CIEDE2000,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum SmoothingStyle {
    IDW,
    Gaussian,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
#[cfg_attr(feature = "serde", serde(default))]
pub struct Config {
    #[cfg_attr(feature = "serde", serde(with = "rgb_vec_serde"))]
    pub palette: Vec<Rgb<u8>>,
    pub mapping: Mapping,
    pub delta_e_method: DeltaEMethod,
    pub quant_level: u8,
    pub transparency_threshold: u8,
    #[cfg_attr(feature = "serde", serde(skip))]
    pub num_threads: usize,
    pub smoothing_style: SmoothingStyle,
    pub smoothing_strength: f64,
    pub lab_scales: [f64; 3],
    pub resize_width: Option<u32>,
    pub resize_height: Option<u32>,
    #[cfg_attr(feature = "serde", serde(skip))]
    pub resize_filter: FilterType,
}

impl Default for Config {
    fn default() -> Self {
        #[cfg(not(target_arch = "wasm32"))]
        let num_threads = num_cpus::get();
        #[cfg(target_arch = "wasm32")]
        let num_threads = 1;

        Config {
            palette: Vec::new(),
            mapping: Mapping::Palettized,
            delta_e_method: DeltaEMethod::CIEDE2000,
            quant_level: 2,
            transparency_threshold: 128,
            num_threads,
            smoothing_style: SmoothingStyle::IDW,
            smoothing_strength: 0.5,
            lab_scales: [1.0, 1.0, 1.0],
            resize_width: None,
            resize_height: None,
            resize_filter: FilterType::Nearest,
        }
    }
}

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Empty palette: at least one color is required")]
    EmptyPalette,

    #[error("Invalid quant_level: must be between 0 (to disable) and {max}, got {value}")]
    InvalidQuantLevel { value: u8, max: u8 },

    #[error("Invalid smoothing_strength: must be between 0.0 and 1.0, got {0}")]
    InvalidsmoothingStrength(f64),

    #[error("Invalid lab_scales: scale values must be positive")]
    InvalidLabScales,

    #[error("Invalid resize dimensions: width and height must be positive")]
    InvalidResizeDimensions,

    #[error(
        "Invalid thread count: Specifying more threads than available CPU cores ({0}) is redundant"
    )]
    InvalidThreadCount(usize),
}

impl Config {
    const MAX_QUANT_LEVEL: u8 = 5;

    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.palette.is_empty() {
            return Err(ConfigError::EmptyPalette);
        }

        if self.quant_level > Self::MAX_QUANT_LEVEL {
            return Err(ConfigError::InvalidQuantLevel {
                value: self.quant_level,
                max: Self::MAX_QUANT_LEVEL,
            });
        }

        if self.smoothing_strength < 0.0 || self.smoothing_strength > 1.0 {
            return Err(ConfigError::InvalidsmoothingStrength(
                self.smoothing_strength,
            ));
        }

        if self.lab_scales.iter().any(|&scale| scale <= 0.0) {
            return Err(ConfigError::InvalidLabScales);
        }

        if let Some(width) = self.resize_width {
            if width == 0 {
                return Err(ConfigError::InvalidResizeDimensions);
            }
        }

        if let Some(height) = self.resize_height {
            if height == 0 {
                return Err(ConfigError::InvalidResizeDimensions);
            }
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.num_threads > num_cpus::get() {
            return Err(ConfigError::InvalidThreadCount(num_cpus::get()));
        }

        Ok(())
    }

    pub fn validated(config: Self) -> Result<Self, ConfigError> {
        config.validate()?;
        Ok(config)
    }
}
