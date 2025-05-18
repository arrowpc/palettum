mod color;
mod config;
mod gif;
mod image;
mod math;
mod processing;

pub mod error;
pub mod palettized;
pub mod smoothed;

use std::{
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
};

use ::image::{imageops::FilterType, ImageFormat, Rgb};
use bon::Builder;
pub use config::Config;
use error::{Error, Result};
pub use gif::Gif;
pub use image::Image;

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

impl From<Filter> for FilterType {
    fn from(f: Filter) -> Self {
        match f {
            Filter::Nearest => FilterType::Nearest,
            Filter::Triangle => FilterType::Triangle,
            Filter::CatmullRom => FilterType::CatmullRom,
            Filter::Gaussian => FilterType::Gaussian,
            Filter::Lanczos3 => FilterType::Lanczos3,
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

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("id{}", since_epoch)
}

pub fn palettify_io(
    input: &Path,
    output: &Path,
    config: &Config,
    width: Option<u32>,
    height: Option<u32>,
    scale: Option<f32>,
    filter: Filter,
) -> Result<()> {
    let format = ImageFormat::from_path(input)?;
    if format == ImageFormat::Gif {
        let mut gif = Gif::from_file(input)?;
        gif.resize(width, height, scale, filter)?;
        gif.palettify(config)?;
        gif.write_to_file(output)?;
    } else {
        let mut img = Image::from_file(input)?;
        img.resize(width, height, scale, filter)?;
        img.palettify(config)?;
        img.write_to_file(output)?;
    }
    Ok(())
}

use anydir::{anydir, AnyDir, DirOps, FileEntry};
use env_home::env_home_dir as home_dir;
use serde_json::{json, Map, Value};

static DEFAULT_PALETTES_DIR: AnyDir = anydir!(ct, "$CARGO_MANIFEST_DIR/../palettes");
static DEFAULT_PALETTES_CACHE: OnceLock<Vec<Palette>> = OnceLock::new();

static CUSTOM_PALETTES_DIR: OnceLock<AnyDir> = OnceLock::new();
fn custom_palettes_dir() -> &'static AnyDir {
    CUSTOM_PALETTES_DIR.get_or_init(|| {
        let default_path = home_dir().unwrap().join(".palettum/palettes");
        // Ensure the directory exists for the runtime case.
        if let Err(e) = fs::create_dir_all(&default_path) {
            // Log the error but allow the program to continue
            // as this only affects saving custom palettes.
            eprintln!(
                "Warning: Could not create custom palettes directory: {}: {}",
                default_path.display(),
                e
            );
            // TODO: Handle this in AnyDir
        }
        anydir!(rt, default_path)
    })
}

fn create_id(path: &Path) -> Result<String> {
    let s = path.to_str().ok_or(Error::InvalidPathUtf8)?;

    // Split on both '/' and '\' to handle Unix and Windows paths
    let last = s.rsplit(['/', '\\']).next().unwrap_or(s);

    let base = last.strip_suffix(".json").unwrap_or(last);

    let mut result = String::new();
    let mut prev_is_lower = false;
    for c in base.chars() {
        if c.is_ascii_alphanumeric() {
            if c.is_uppercase() {
                if prev_is_lower {
                    result.push('-');
                }
                result.push(c.to_ascii_lowercase());
                prev_is_lower = false;
            } else {
                result.push(c);
                prev_is_lower = c.is_ascii_lowercase();
            }
        } else if !result.ends_with('-') {
            result.push('-');
            prev_is_lower = false;
        }
    }
    while result.ends_with('-') {
        result.pop();
    }
    Ok(result)
}

fn palette_from_value_inner(
    v: &Value,
    id: Option<String>,
    kind: Option<PaletteKind>,
) -> Result<Palette> {
    let source = v.get("source").and_then(|s| s.as_str()).map(str::to_string);

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
        .id(id.unwrap_or_default())
        .source(source.unwrap_or_default())
        .colors(colors)
        .kind(kind.unwrap_or_default())
        .build())
}

pub fn palette_from_value(v: &Value) -> Result<Palette> {
    palette_from_value_inner(v, None, None)
}

pub fn palette_from_file_entry(entry: &impl FileEntry, kind: PaletteKind) -> Result<Palette> {
    let s = entry.read_string()?;
    let v: Value = serde_json::from_str(&s)?;
    let id = create_id(entry.path())?;
    palette_from_value_inner(&v, Some(id), Some(kind))
}

fn value_from_palette(palette: &Palette) -> Value {
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

    // Only include source if it's not empty
    if !palette.source.is_empty() {
        obj.insert("source".to_string(), json!(palette.source));
    }

    obj.insert("colors".to_string(), Value::Array(colors));

    Value::Object(obj)
}

pub fn get_default_palettes() -> &'static [Palette] {
    DEFAULT_PALETTES_CACHE.get_or_init(|| {
        let mut palettes = Vec::new();
        for entry in DEFAULT_PALETTES_DIR.file_entries() {
            if let Ok(palette) = palette_from_file_entry(&entry, PaletteKind::Default) {
                palettes.push(palette);
            } else {
                eprintln!(
                    "Warning: Could not load default palette from {:?}",
                    entry.path()
                );
            }
        }
        palettes
    })
}

// Note: This function reads the directory every time it's called.
// we probably need to at some point cache this result as well, with a mechanism
// to refresh the cache if the directory contents change.
pub fn get_custom_palettes() -> Vec<Palette> {
    let mut palettes = Vec::new();
    for entry in custom_palettes_dir().file_entries() {
        if let Ok(palette) = palette_from_file_entry(&entry, PaletteKind::Custom) {
            palettes.push(palette);
        } else {
            eprintln!(
                "Warning: Could not load custom palette from {:?}",
                entry.path(),
            );
        }
    }
    palettes
}

pub fn get_all_palettes() -> Vec<Palette> {
    let mut palettes = get_default_palettes().to_vec();
    palettes.extend(get_custom_palettes());
    palettes
}

pub fn find_palette(id: &str) -> Option<Palette> {
    get_all_palettes().into_iter().find(|p| p.id == id)
}

pub fn save_custom_palette(palette: &Palette, force: bool) -> Result<PathBuf> {
    let custom_dir = custom_palettes_dir()
        .as_rt()
        .ok_or(Error::CannotDetermineCustomDir)?;

    let path = custom_dir.path().join(format!("{}.json", palette.id));

    match find_palette(&palette.id) {
        Some(existing_palette) => {
            match existing_palette.kind {
                PaletteKind::Default => {
                    return Err(Error::CannotOverrideDefault(palette.id.clone()));
                }
                _ => {
                    if !force {
                        return Err(Error::CustomPaletteExists(path));
                    }
                    // If force is true, continue to overwrite
                }
            }
        }
        None => {
            // Palette does not exist, safe to create
        }
    }
    let path = custom_dir.path().join(format!("{}.json", palette.id));
    let parent = path.parent().ok_or(Error::InvalidSavePath)?;
    fs::create_dir_all(parent)?;

    // Write the file
    let json_string = serde_json::to_string_pretty(&value_from_palette(palette))?;
    fs::write(&path, json_string)?;

    Ok(path)
}

#[test]
fn print_palette_value() {
    let custom_dir_path = home_dir().unwrap().join(".palettum/palettes");
    fs::create_dir_all(&custom_dir_path).expect("Failed to create test custom palettes directory");

    let pal = Palette::builder()
        .id("fortnite".to_string())
        .colors(vec![
            Rgb([0, 0, 0]),       // Black
            Rgb([255, 255, 255]), // White
            Rgb([255, 0, 0]),     // Red
            Rgb([0, 255, 0]),     // Green
            Rgb([0, 0, 255]),     // Blue
        ])
        .kind(PaletteKind::Unset) // Use Unset initially, save sets to Custom
        .build();

    match save_custom_palette(&pal, false) {
        Ok(path) => println!("Saved palette to {}", path.display()),
        Err(e) => eprintln!("Error saving palette: {}", e),
    }

    // // Example of loading from a specific path
    // let test_palette_path = custom_dir_path.join("fortnite.json");
    // match load_palette_from_path(&test_palette_path) {
    //     Ok(loaded_pal) => println!("Loaded palette from path: {:?}", loaded_pal),
    //     Err(e) => eprintln!("Error loading palette from path: {}", e),
    // }

    println!("-----------");
    println!("Default Palettes: {:?}", get_default_palettes());
    println!("Custom Palettes: {:?}", get_custom_palettes()); // Should include the saved one
    println!("All Palettes: {:?}", get_all_palettes());

    // // Clean up the test file
    // if test_palette_path.exists() {
    //     fs::remove_file(&test_palette_path).expect("Failed to clean up test palette file");
    // }
}
