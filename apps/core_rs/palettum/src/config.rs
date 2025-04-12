use image::{imageops::FilterType, Rgb};
#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum WeightingKernelType {
    Gaussian,
    InverseDistancePower,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum Mapping {
    Untouched,
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
    pub anisotropic_kernel: WeightingKernelType,
    pub anisotropic_shape_parameter: f64, // Gaussian
    pub anisotropic_power_parameter: f64, // Inverse Distance
    pub anisotropic_lab_scales: [f64; 3], // [L, A, B] scaling
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
            mapping: Mapping::Smoothed,
            delta_e_method: DeltaEMethod::CIEDE2000,
            quant_level: 0,
            transparency_threshold: 128,
            num_threads,
            anisotropic_kernel: WeightingKernelType::InverseDistancePower,
            anisotropic_shape_parameter: 0.08,
            anisotropic_power_parameter: 3.5,
            anisotropic_lab_scales: [1.0, 1.0, 1.0],
            resize_width: None,
            resize_height: None,
            resize_filter: FilterType::Lanczos3,
        }
    }
}

// --- Helper module for Vec<Rgb<u8>> serialization ---
#[cfg(feature = "serde")]
mod rgb_vec_serde {
    use image::Rgb;
    use serde::{
        de::{SeqAccess, Visitor},
        ser::SerializeSeq,
        Deserialize, Deserializer, Serialize, Serializer,
    };
    use std::fmt;

    // Intermediate struct that can derive Serialize/Deserialize
    #[derive(Serialize, Deserialize)]
    struct RgbHelper {
        r: u8,
        g: u8,
        b: u8,
    }

    pub fn serialize<S>(vec: &Vec<Rgb<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(Some(vec.len()))?;
        for rgb in vec {
            let helper = RgbHelper {
                r: rgb.0[0],
                g: rgb.0[1],
                b: rgb.0[2],
            };
            seq.serialize_element(&helper)?;
        }
        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<Rgb<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Deserialize into the helper struct first
        let helpers = Vec::<RgbHelper>::deserialize(deserializer)?;
        // Convert helper structs back to Rgb<u8>
        let result = helpers
            .into_iter()
            .map(|helper| Rgb([helper.r, helper.g, helper.b]))
            .collect();
        Ok(result)
    }
}
