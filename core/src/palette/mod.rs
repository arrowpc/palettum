use crate::error::{Error, Result};
use bon::Builder;
use image::Rgb;
use serde_json::Value;
use strum_macros::Display;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "cli")]
use tabled::Tabled;
#[cfg(feature = "wasm")]
use tsify::Tsify;

#[cfg(feature = "wasm")]
use crate::color::rgb_vec_serde;

pub use self::io::*;

pub mod extraction;
pub mod io;

#[derive(Debug, Clone, Default, Eq, PartialEq, Display)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
pub enum PaletteKind {
    Default,
    Custom,
    #[default]
    Unset,
}

#[derive(Debug, Clone, Builder, Default)]
#[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi))]
#[cfg_attr(feature = "cli", derive(Tabled))]
pub struct Palette {
    #[builder(default = generate_id())]
    pub id: String,

    #[cfg_attr(feature = "wasm", serde(default))]
    #[builder(default = "n/a".to_string())]
    pub source: String,

    #[cfg_attr(feature = "wasm", serde(default))]
    #[builder(default)]
    pub kind: PaletteKind,

    #[cfg_attr(feature = "cli", tabled(skip))]
    #[cfg_attr(feature = "wasm", serde(with = "rgb_vec_serde"))]
    pub colors: Vec<Rgb<u8>>,
}

pub fn generate_id() -> String {
    format!("id{}", "test")
}

fn palette_from_value_inner(
    v: &Value,
    id: Option<String>,
    kind: Option<PaletteKind>,
) -> Result<Palette> {
    let source_opt_str = v.get("source").and_then(|s| s.as_str());
    let source = source_opt_str
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "n/a".to_string());

    let arr = v
        .get("colors")
        .and_then(|c| c.as_array())
        .ok_or(Error::MissingField("colors"))?;

    let colors = arr
        .iter()
        .map(|entry| {
            let r = entry
                .get("r")
                .and_then(|v| v.as_u64())
                .ok_or(Error::MissingField("r"))? as u8;
            let g = entry
                .get("g")
                .and_then(|v| v.as_u64())
                .ok_or(Error::MissingField("g"))? as u8;
            let b = entry
                .get("b")
                .and_then(|v| v.as_u64())
                .ok_or(Error::MissingField("b"))? as u8;
            Ok(Rgb([r, g, b]))
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(Palette::builder()
        .id(id.unwrap_or_else(generate_id))
        .source(source)
        .colors(colors)
        .kind(kind.unwrap_or_default())
        .build())
}

pub fn value_from_palette(palette: &Palette) -> Value {
    use serde_json::{json, Map};
    let mut obj = Map::new();

    let colors = palette
        .colors
        .iter()
        .map(|rgb| {
            let [r, g, b] = rgb.0;
            json!({
                "r": r,
                "g": g,
                "b": b
            })
        })
        .collect::<Vec<_>>();

    if !palette.source.is_empty() && palette.source != "n/a" {
        obj.insert("source".to_string(), json!(palette.source));
    }

    obj.insert("colors".to_string(), Value::Array(colors));

    Value::Object(obj)
}
