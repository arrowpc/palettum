use super::{palette_from_value_inner, value_from_palette, Palette, PaletteKind};
use crate::error::{Error, Result};
use anydir::{anydir, AnyDir, DirOps, FileEntry};
use env_home::env_home_dir as home_dir;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
};

static DEFAULT_PALETTES_DIR: AnyDir = anydir!(ct, "$CARGO_MANIFEST_DIR/../palettes");
static DEFAULT_PALETTES_CACHE: OnceLock<Vec<Palette>> = OnceLock::new();

static CUSTOM_PALETTES_DIR: OnceLock<AnyDir> = OnceLock::new();
pub fn custom_palettes_dir() -> &'static AnyDir {
    CUSTOM_PALETTES_DIR.get_or_init(|| {
        let default_path = home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".palettum/palettes");
        if let Err(e) = fs::create_dir_all(&default_path) {
            eprintln!(
                "Warning: Could not create custom palettes directory: {}: {}",
                default_path.display(),
                e
            );
        }
        anydir!(rt, default_path)
    })
}

pub fn create_id(path: &Path) -> Result<String> {
    let s = path.to_str().unwrap();
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

pub fn palette_from_file_entry(entry: &impl FileEntry, kind: PaletteKind) -> Result<Palette> {
    let s = entry.read_string()?;
    let v: Value = serde_json::from_str(&s)?;
    let id = create_id(entry.path())?;
    palette_from_value_inner(&v, Some(id), Some(kind))
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
    let palette = get_all_palettes().into_iter().find(|p| p.id == id);
    if palette.is_none() {
        log::debug!("Palette with id '{id}' not found.");
    }
    palette
}

pub fn save_custom_palette(palette: &Palette, force: bool) -> Result<PathBuf> {
    let custom_dir_any = custom_palettes_dir();
    let custom_dir_path = match custom_dir_any.as_rt() {
        Some(dir) => dir.path(),
        None => {
            // This case should ideally not happen if custom_palettes_dir ensures creation
            // or handles the compile-time scenario appropriately.
            // For now, let's try to make it robust for runtime.
            let fallback_path = home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".palettum/palettes");
            fs::create_dir_all(&fallback_path)?;
            &fallback_path.clone()
        }
    };

    let path = custom_dir_path.join(format!("{}.json", palette.id));

    if let Some(existing_palette) = find_palette(&palette.id) {
        if existing_palette.kind == PaletteKind::Default {
            return Err(Error::CannotOverrideDefault(palette.id.clone()));
        }
        if !force && existing_palette.kind == PaletteKind::Custom {
            return Err(Error::CustomPaletteExists(path));
        }
    }

    let parent = path.parent().ok_or(Error::InvalidSavePath)?;
    fs::create_dir_all(parent)?;

    palette_to_file(palette, &path)?;

    Ok(path)
}

pub fn delete_custom_palette(palette: &Palette) -> Result<()> {
    match palette.kind {
        PaletteKind::Default => Err(Error::DefaultPaletteDeletion(palette.id.clone())),
        PaletteKind::Custom => {
            let custom_dir_any = custom_palettes_dir();
            let custom_dir_path = custom_dir_any
                .as_rt()
                .ok_or(Error::CannotDetermineCustomDir)?
                .path();
            let path = custom_dir_path.join(format!("{}.json", palette.id));
            fs::remove_file(path)?;
            Ok(())
        }
        PaletteKind::Unset => Err(Error::UnsetPaletteDeletion(palette.id.clone())),
    }
}

pub fn palette_to_file(palette: &Palette, path: &Path) -> Result<()> {
    if matches!(path.extension(), Some(ext) if ext != "json") {
        log::debug!(
            "Output path {} has a non-json extension; replacing with .json",
            path.display()
        );
    }

    let mut path_with_ext = PathBuf::from(path);
    path_with_ext.set_extension("json");

    let json_string = serde_json::to_string_pretty(&value_from_palette(palette))?;

    Ok(fs::write(path_with_ext, json_string)?)
}
