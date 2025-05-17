use bon::Builder;
use image::Rgb;
use std::fmt;

#[cfg(feature = "wasm")]
use crate::color::rgb_vec_serde;
#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

#[cfg(feature = "cli")]
use clap::ValueEnum;

use strum_macros::Display;
use tabled::Tabled;

use crate::{
    error::{Error, Result},
    palettized, smoothed,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "cli", derive(ValueEnum, Display))]
pub enum Mapping {
    Palettized,
    #[default]
    Smoothed,
    SmoothedPalettized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "cli", derive(ValueEnum, Display))]
pub enum Filter {
    Nearest,
    Triangle,
    CatmullRom,
    Gaussian,
    #[default]
    Lanczos3,
}

impl From<Filter> for image::imageops::FilterType {
    fn from(f: Filter) -> Self {
        match f {
            Filter::Nearest => image::imageops::FilterType::Nearest,
            Filter::Triangle => image::imageops::FilterType::Triangle,
            Filter::CatmullRom => image::imageops::FilterType::CatmullRom,
            Filter::Gaussian => image::imageops::FilterType::Gaussian,
            Filter::Lanczos3 => image::imageops::FilterType::Lanczos3,
        }
    }
}

#[derive(Debug, Clone, Default, Eq, PartialEq, Display)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
pub enum PaletteKind {
    Default,
    Custom,
    #[default]
    Unset,
}

#[derive(Debug, Clone, Builder, Tabled)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize, Default))]
#[cfg_attr(feature = "wasm", serde(default))]
pub struct Palette {
    #[builder(default = generate_id())]
    pub id: String,

    #[builder(default = "none".to_string())]
    pub source: String,

    #[builder(default)]
    pub kind: PaletteKind,

    #[tabled(skip)]
    #[cfg_attr(feature = "wasm", serde(with = "rgb_vec_serde"))]
    pub colors: Vec<Rgb<u8>>,
}

impl fmt::Display for Palette {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Palette {{ id: {}, source: {}, kind: {}, colors: [",
            self.id, self.source, self.kind
        )?;
        for (i, color) in self.colors.iter().enumerate() {
            if i > 0 {
                write!(f, ", ")?;
            }
            write!(f, "#{:02X}{:02X}{:02X}", color.0[0], color.0[1], color.0[2])?;
        }
        write!(f, "] }}")
    }
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("id{}", since_epoch)
}

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
