use anyhow::{anyhow, bail, Result};
use directories::ProjectDirs;
use image::{imageops::FilterType, ImageFormat, Rgb};
use include_dir::{include_dir, Dir};
use palettum::{
    palettify_gif, palettify_image, Config as PalettumConfig, DeltaEMethod, Gif as PalettumGif,
    Image as PalettumImage, Mapping, SmoothingStyle,
};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

pub mod cli;
pub mod style;
#[cfg(feature = "tui")]
pub mod tui;

static DEFAULT_PALETTES_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/default_palettes");

#[derive(Debug, Clone, PartialEq)]
pub enum PaletteKind {
    Default,
    Custom,
}

#[derive(Debug, Clone)]
pub struct Palette {
    pub id: String,
    pub name: String,
    pub source: Option<String>,
    pub kind: PaletteKind,
    pub colors: Vec<Rgb<u8>>,
}

trait PaletteSource<'a> {
    fn list_palette_files(&'a self) -> Vec<Box<dyn PaletteFile + 'a>>;
}

trait PaletteFile {
    fn read_to_string(&self) -> Result<String>;
}

struct EmbeddedPaletteSource<'a> {
    dir: &'a Dir<'a>,
}

impl<'a> PaletteSource<'a> for EmbeddedPaletteSource<'a> {
    fn list_palette_files(&'a self) -> Vec<Box<dyn PaletteFile + 'a>> {
        self.dir
            .files()
            .filter(|f| f.path().extension().and_then(|s| s.to_str()) == Some("json"))
            .map(|f| Box::new(EmbeddedPaletteFile { file: f }) as Box<dyn PaletteFile + 'a>)
            .collect()
    }
}

struct EmbeddedPaletteFile<'a> {
    file: &'a include_dir::File<'a>,
}

impl PaletteFile for EmbeddedPaletteFile<'_> {
    fn read_to_string(&self) -> Result<String> {
        Ok(self.file.contents_utf8().unwrap().to_string())
    }
}

struct FsPaletteSource {
    dir: PathBuf,
}

impl<'a> PaletteSource<'a> for FsPaletteSource {
    fn list_palette_files(&'a self) -> Vec<Box<dyn PaletteFile + 'a>> {
        let mut files = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&self.dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    files.push(Box::new(FsPaletteFile { path }) as Box<dyn PaletteFile>);
                }
            }
        }
        files
    }
}

struct FsPaletteFile {
    path: PathBuf,
}

impl PaletteFile for FsPaletteFile {
    fn read_to_string(&self) -> Result<String> {
        Ok(std::fs::read_to_string(&self.path)?)
    }
}

fn palette_from_value(v: &Value, kind: PaletteKind) -> Option<Palette> {
    let id = v["id"].as_str()?.to_string();
    let name = v["name"].as_str()?.to_string();
    let source = v["source"].as_str().map(str::to_string);

    let arr = v["colors"].as_array()?;
    let mut colors = Vec::with_capacity(arr.len());
    for entry in arr {
        let r = entry.get("r")?.as_u64()? as u8;
        let g = entry.get("g")?.as_u64()? as u8;
        let b = entry.get("b")?.as_u64()? as u8;
        colors.push(Rgb([r, g, b]));
    }
    Some(Palette {
        id,
        name,
        source,
        kind,
        colors,
    })
}

fn load_palettes_from_source<'a>(
    source: &'a dyn PaletteSource<'a>,
    kind: PaletteKind,
) -> Result<Vec<Palette>> {
    let mut palettes = Vec::new();
    for file in source.list_palette_files() {
        let text = file.read_to_string()?;
        let v: Value = serde_json::from_str(&text)?;
        if let Some(p) = palette_from_value(&v, kind.clone()) {
            palettes.push(p);
        }
    }
    Ok(palettes)
}

pub fn find_palette_by_id(id: &str) -> Option<Palette> {
    let m = |v: &Value| v["id"].as_str() == Some(id);
    let default_source = EmbeddedPaletteSource {
        dir: &DEFAULT_PALETTES_DIR,
    };
    let custom_source = FsPaletteSource {
        dir: get_custom_palettes_dir().ok()?,
    };
    for (source, kind) in [
        (&default_source as &dyn PaletteSource, PaletteKind::Default),
        (&custom_source as &dyn PaletteSource, PaletteKind::Custom),
    ] {
        for file in source.list_palette_files() {
            let text = file.read_to_string().ok()?;
            let v: Value = serde_json::from_str(&text).ok()?;
            if m(&v) {
                return palette_from_value(&v, kind.clone());
            }
        }
    }
    None
}

pub fn find_palette_by_name(name: &str) -> Option<Palette> {
    let m = |v: &Value| v["name"].as_str() == Some(name);
    let default_source = EmbeddedPaletteSource {
        dir: &DEFAULT_PALETTES_DIR,
    };
    let custom_source = FsPaletteSource {
        dir: get_custom_palettes_dir().ok()?,
    };
    for (source, kind) in [
        (&default_source as &dyn PaletteSource, PaletteKind::Default),
        (&custom_source as &dyn PaletteSource, PaletteKind::Custom),
    ] {
        for file in source.list_palette_files() {
            let text = file.read_to_string().ok()?;
            let v: Value = serde_json::from_str(&text).ok()?;
            if m(&v) {
                return palette_from_value(&v, kind.clone());
            }
        }
    }
    None
}

pub fn find_palette_by_file<P: AsRef<Path>>(file: P) -> Option<Palette> {
    let path = file.as_ref();
    let text = fs::read_to_string(path).ok()?;
    let v: Value = serde_json::from_str(&text).ok()?;
    let kind = PaletteKind::Custom;
    palette_from_value(&v, kind)
}

pub fn find_palette(input: &str) -> Result<Palette> {
    find_palette_by_id(input)
        .or_else(|| find_palette_by_name(input))
        .or_else(|| find_palette_by_file(input))
        .ok_or_else(|| anyhow!("Palette '{}' not found", input))
}

pub fn get_custom_palettes_dir() -> Result<PathBuf> {
    let project_dirs = ProjectDirs::from("com", "palettum", "palettum")
        .ok_or_else(|| anyhow!("Could not determine user data directory"))?;
    let custom_dir = project_dirs.data_dir().join("palettes");
    if !custom_dir.exists() {
        std::fs::create_dir_all(&custom_dir)?;
    }
    Ok(custom_dir)
}

pub fn is_palette_id_valid(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

pub fn list_available_palettes() -> Result<Vec<Palette>> {
    let default_source = EmbeddedPaletteSource {
        dir: &DEFAULT_PALETTES_DIR,
    };
    let custom_source = FsPaletteSource {
        dir: get_custom_palettes_dir()?,
    };
    let mut custom = load_palettes_from_source(&custom_source, PaletteKind::Custom)?;
    let mut palettes = load_palettes_from_source(&default_source, PaletteKind::Default)?;
    palettes.append(&mut custom);

    Ok(palettes)
}

pub fn save_custom_palette(id: &str, data: &Value, force: bool) -> Result<PathBuf> {
    if !is_palette_id_valid(id) {
        bail!("Invalid palette ID: '{}'", id);
    }
    let custom_dir = get_custom_palettes_dir()?;
    let palette_path = custom_dir.join(format!("{}.json", id));
    if palette_path.exists() && !force {
        bail!("Palette already exists: {}", palette_path.display());
    }
    let mut palette_data = data.clone();
    if let Some(obj) = palette_data.as_object_mut() {
        obj.insert("id".to_string(), serde_json::json!(id));
    }
    let json_string = serde_json::to_string_pretty(&palette_data)?;
    std::fs::write(&palette_path, json_string)?;
    Ok(palette_path)
}

#[derive(Debug, Clone)]
pub struct PalettifyArgs {
    pub input_path: PathBuf,
    pub output: Option<PathBuf>,
    pub palette: String,
    pub mapping: Mapping,
    pub delta_e: DeltaEMethod,
    pub quant_level: u8,
    pub alpha_threshold: u8,
    pub threads: usize,
    pub smoothing_style: SmoothingStyle,
    pub smoothing_strength: f64,
    pub lab_scales: [f64; 3],
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub scale: Option<String>,
    pub resize_filter: FilterType,
    pub silent: bool,
}

#[derive(Debug, Clone)]
pub struct ListPalettesArgs {
    pub show_paths: bool,
}

#[derive(Debug, Clone)]
pub struct SavePaletteArgs {
    pub json_file: PathBuf,
    pub id: Option<String>,
    pub force: bool,
}

#[derive(Debug, Clone)]
pub enum Command {
    Palettify(PalettifyArgs),
    ListPalettes(ListPalettesArgs),
    SavePalette(SavePaletteArgs),
}

#[derive(Debug)]
pub enum CommandResult {
    PalettifySuccess {
        input_path: PathBuf,
        output_path: PathBuf,
        duration: Duration,
    },
    ListPalettesSuccess(Vec<Palette>),
    SavePaletteSuccess {
        id: String,
        path: PathBuf,
    },
    Error(anyhow::Error),
}

pub fn execute_command(command: Command) -> Result<CommandResult> {
    match command {
        Command::Palettify(args) => {
            let start_time = std::time::Instant::now();
            let input_path = args.input_path;
            let output_path;

            let exts = ["gif", "png", "jpg", "jpeg", "webp"];

            let palette = find_palette(&args.palette)?;
            let config = PalettumConfig {
                palette: palette.colors,
                mapping: args.mapping,
                delta_e_method: args.delta_e,
                quant_level: args.quant_level,
                transparency_threshold: args.alpha_threshold,
                smoothing_style: args.smoothing_style,
                smoothing_strength: args.smoothing_strength,
                lab_scales: args.lab_scales,
                resize_filter: args.resize_filter,
                resize_width: args.width,
                resize_height: args.height,
                resize_scale: parse_scale(args.scale.as_deref()),
                num_threads: args.threads,
            };
            config.validate()?;
            if !input_path.exists() {
                return Err(anyhow!("Input not found: {}", input_path.display()));
            }
            if input_path.is_dir() {
                use std::ffi::OsStr;
                use walkdir::WalkDir;

                output_path = if let Some(out) = &args.output {
                    out.clone()
                } else {
                    let dir_name = input_path
                        .file_name()
                        .ok_or_else(|| anyhow!("Cannot determine directory name"))?
                        .to_string_lossy();

                    let suffix = match args.mapping {
                        Mapping::Palettized => "_palettized",
                        Mapping::Smoothed => "_smoothed",
                        Mapping::SmoothedPalettized => "_smoothed_palettized",
                    };

                    let new_dir_name = format!("{}{}", dir_name, suffix);
                    let parent = input_path.parent().unwrap_or_else(|| Path::new("."));

                    parent.join(new_dir_name)
                };

                //TODO: Give users the option to override
                if output_path.exists() {
                    return Err(anyhow!(
            "Output directory already exists: {}. Please specify a different output directory or remove the existing one.",
            output_path.display()
        ));
                }

                copy_dir_all(&input_path, &output_path)?;

                let matches: Vec<_> = WalkDir::new(&output_path)
                    .into_iter()
                    .filter_map(Result::ok)
                    .map(|e| e.into_path())
                    .filter(|path| {
                        path.extension()
                            .and_then(OsStr::to_str)
                            .is_some_and(|ext| exts.contains(&ext))
                    })
                    .collect();

                let total = matches.len();
                for (i, path) in matches.into_iter().enumerate() {
                    log::debug!("Palettifying {} - {}/{}...", path.display(), i + 1, total);
                    let is_gif = ImageFormat::from_path(&path).is_ok_and(|f| f == ImageFormat::Gif);
                    if is_gif {
                        let gif = PalettumGif::from_file(&path).map_err(|e| anyhow!(e))?;
                        let processed_gif = palettify_gif(&gif, &config).map_err(|e| anyhow!(e))?;
                        processed_gif.write_to_file(&path).map_err(|e| anyhow!(e))?
                    } else {
                        let img = PalettumImage::from_file(&path).map_err(|e| anyhow!(e))?;
                        let processed_img =
                            palettify_image(&img, &config).map_err(|e| anyhow!(e))?;
                        processed_img
                            .write_to_file(&path, ImageFormat::Png)
                            .map_err(|e| anyhow!(e))?
                    };
                }
            } else {
                let is_gif =
                    ImageFormat::from_path(&input_path).is_ok_and(|f| f == ImageFormat::Gif);
                output_path =
                    determine_output_path(&input_path, args.output.as_ref(), is_gif, args.mapping)?;

                if is_gif {
                    let gif = PalettumGif::from_file(&input_path).map_err(|e| anyhow!(e))?;
                    let processed_gif = palettify_gif(&gif, &config).map_err(|e| anyhow!(e))?;
                    processed_gif
                        .write_to_file(&output_path)
                        .map_err(|e| anyhow!(e))?
                } else {
                    let img = PalettumImage::from_file(&input_path).map_err(|e| anyhow!(e))?;
                    let processed_img = palettify_image(&img, &config).map_err(|e| anyhow!(e))?;
                    processed_img
                        .write_to_file(&output_path, ImageFormat::Png)
                        .map_err(|e| anyhow!(e))?
                };
            }

            let duration = start_time.elapsed();
            Ok(CommandResult::PalettifySuccess {
                input_path,
                output_path,
                duration,
            })
        }
        Command::ListPalettes(_args) => {
            let palettes = list_available_palettes()?;
            Ok(CommandResult::ListPalettesSuccess(palettes))
        }
        Command::SavePalette(args) => {
            let json_content = std::fs::read_to_string(&args.json_file)?;
            let palette_data: Value = serde_json::from_str(&json_content)?;
            let palette_id = args.id.unwrap_or_else(|| {
                args.json_file
                    .file_stem()
                    .unwrap()
                    .to_string_lossy()
                    .to_string()
            });
            let saved_path = save_custom_palette(&palette_id, &palette_data, args.force)?;
            Ok(CommandResult::SavePaletteSuccess {
                id: palette_id,
                path: saved_path,
            })
        }
    }
}

pub fn format_duration(duration: Duration) -> String {
    let millis = duration.as_millis();
    let secs = duration.as_secs() as f64 + (duration.subsec_nanos() as f64 / 1_000_000_000.0);

    if duration.as_secs() == 0 && millis > 0 {
        format!("{}ms", millis)
    } else {
        format!("{:.3}s", secs)
    }
}

pub fn format_filesize(size: u64) -> String {
    humansize::format_size(size, humansize::BINARY)
}

pub fn format_dimensions(dimensions: (u32, u32)) -> String {
    format!("{}x{}", dimensions.0, dimensions.1)
}

pub fn parse_scale(scale_str: Option<&str>) -> Option<f32> {
    match scale_str {
        Some(s) => {
            let trimmed = s.trim();
            if let Some(factor_str) = trimmed.strip_suffix('x') {
                factor_str.parse::<f32>().ok()
            } else if let Some(percent_str) = trimmed.strip_suffix('%') {
                percent_str.parse::<f32>().ok().map(|v| v / 100.0)
            } else {
                trimmed.parse::<f32>().ok()
            }
        }
        None => None,
    }
}

fn determine_output_path(
    input: &Path,
    output: Option<&PathBuf>,
    is_gif: bool,
    mapping: Mapping,
) -> Result<PathBuf> {
    if let Some(out) = output {
        return Ok(out.clone());
    }
    let file_stem = input
        .file_stem()
        .ok_or_else(|| anyhow!("Input path has no file name"))?;
    let file_name = file_stem.to_string_lossy();
    let suffix = match mapping {
        Mapping::Palettized => "_palettized",
        Mapping::Smoothed => "_smoothed",
        Mapping::SmoothedPalettized => "_smoothed_palettized",
    };
    let extension = if is_gif { "gif" } else { "png" };
    let new_file_name = format!("{}{}.{}", file_name, suffix, extension);
    let parent = input
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    Ok(parent.join(new_file_name))
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> Result<()> {
    log::debug!(
        "Copying directory structure from {} to {}...",
        src.as_ref().display(),
        dst.as_ref().display()
    );
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}
