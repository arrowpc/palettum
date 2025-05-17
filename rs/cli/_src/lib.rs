use directories::ProjectDirs;
use image::{imageops::FilterType, ImageFormat, Rgb};
use include_dir::{include_dir, Dir};
use palettum::{
    utils::*, Config, Gif as PalettumGif, Image as PalettumImage, Mapping,
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

#[derive(Debug, Clone)]
pub enum Command {
    Palettify(Config),
    ListPalettes(Config),
    SavePalette(Config),
}

pub fn execute_command(command: Command) -> Result<()> {
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
                    palettized_formula: args.delta_e,
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
                            let mut gif = PalettumGif::from_file(&path).map_err(|e| anyhow!(e))?;
                            gif.palettify(&config).map_err(|e| anyhow!(e))?;
                            gif.write_to_file(&path).map_err(|e| anyhow!(e))?
                        } else {
                            let mut img = PalettumImage::from_file(&path).map_err(|e| anyhow!(e))?;
                            img.palettify(&config).map_err(|e| anyhow!(e))?;
                            img.write_to_file(&path).map_err(|e| anyhow!(e))?
                        };
                    }
                } else {
                    let is_gif =
                        ImageFormat::from_path(&input_path).is_ok_and(|f| f == ImageFormat::Gif);
                    output_path =
                        determine_output_path(&input_path, args.output.as_ref(), is_gif, args.mapping)?;

                    if is_gif {
                        let mut gif = PalettumGif::from_file(&input_path).map_err(|e| anyhow!(e))?;
                        gif.palettify(&config).map_err(|e| anyhow!(e))?;
                        gif.write_to_file(&output_path).map_err(|e| anyhow!(e))?
                    } else {
                        let mut img = PalettumImage::from_file(&input_path).map_err(|e| anyhow!(e))?;
                        img.palettify(&config).map_err(|e| anyhow!(e))?;
                        img.write_to_file(&output_path).map_err(|e| anyhow!(e))?
                    };
                }

                let duration = start_time.elapsed();
                Ok(CommandResult::PalettifySuccess {
                    input_path,
                    output_path,
                    duration,
                })
            todo!()
        }
        Command::ListPalettes(_) => {
            let palettes = get_all_palettes();
            Ok(())
        }
        Command::SavePalette(args) => {
            let saved_path = save_custom_palette(&args.palette, args.force)?;
            Ok(())
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

fn format_filesize(size: u64) -> String {
    humansize::format_size(size, humansize::BINARY)
}

fn parse_scale(scale_str: Option<&str>) -> Option<f32> {
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
