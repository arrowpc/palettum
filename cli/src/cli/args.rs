use palettum::{find_palette, palettized, smoothed, Filter, Mapping, Palette};
use std::path::PathBuf;

use clap::{ArgAction, Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    version,
    about,
    help_template = "\
{before-help}{name} {version}
{author-with-newline}{about-with-newline}
{usage-heading}
  {usage}
{all-args}{after-help}
",
    override_usage = "palettum [COMMAND] [OPTIONS] [FLAGS]",
    disable_help_flag = true,
    disable_version_flag = false,
    styles(crate::style::clap_styles()),
    rename_all_env = "screaming-snake"
)]
pub struct Cli {
    #[arg(
        short,
        long,
        action = ArgAction::Help,
        global = true,
        help = "Prints help information",
        help_heading = "FLAGS"
    )]
    pub help: Option<bool>,

    #[arg(short,
        long,
        action = ArgAction::Count,
        help_heading = Some("FLAGS"))]
    pub verbose: u8,

    /// The subcommand to run
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Palettify(PalettifyArgs),
    List,
    #[command(about = "Saves your palette locally to be used wherever.\n\
                  You can easily create and export palettes at \
                  \x1b]8;;https://palettum.com\x1b\\\
                  \x1b[4;94mpalettum.com\x1b[0m\
                  \x1b]8;;\x1b\\")]
    Save(SaveArgs),
    // TODO: Delete,
}

#[derive(Args, Debug)]
pub struct PalettifyArgs {
    /// Input files or directories (comma-separated)
    #[arg(value_name = "PATH", value_delimiter = ',', required = true)]
    pub input_paths: Vec<PathBuf>,

    #[arg(
        short,
        long,
        value_parser = parse_palette,
        value_name = "PALETTE",
        required = true,
        help= "Use the \x1b[0;91mlist-palettes\x1b[0m command to see all available palettes"
    )]
    pub palette: Palette,

    #[arg(
        short,
        long,
        value_name = "MAPPING",
        default_value = "smoothed",
        value_enum,
        // required = true,
    )]
    pub mapping: Mapping,

    #[arg(
        // short,
        long,
        value_enum,
        value_name = "FORMULA",
        default_value = "ciede2000",
        help_heading = "PALETTIZED",
    )]
    pub palettized_formula: palettized::Formula,

    /// 0 To disable transparency [range: 0 - 255]
    #[arg(
        short,
        long,
        value_name = "CHANNEL",
        default_value_t = 128,
        help_heading = "PALETTIZED"
    )]
    pub alpha_threshold: u8,

    #[arg(
        short,
        long,
        value_enum,
        value_name = "FORMULA",
        default_value = "idw",
        help_heading = "SMOOTHED"
    )]
    pub smoothed_formula: smoothed::Formula,

    /// [range: 0.1 - 1.0]
    #[arg(
        long,
        value_name = "STRENGTH",
        default_value_t = 0.5,
        help_heading = "SMOOTHED"
    )]
    pub smoothing_strength: f32,

    #[arg(
        short,
        long,
        default_value = "1.0,1.0,1.0",
        value_name = "L,A,B",
        // Will require passing a Vec, which will require parsing somewhere else so...
        // value_delimiter = ',',
        value_parser = parse_lab_scales,
        help_heading = "SMOOTHED",
    )]
    pub lab_scales: [f32; 3],

    /// Resize output to this width. If height is not set, aspect ratio is preserved
    #[arg(long, value_name = "PIXELS", help_heading = "SIZE")]
    pub width: Option<u32>,

    /// Resize output to this height. If width is not set, aspect ratio is preserved
    #[arg(long, value_name = "PIXELS", help_heading = "SIZE")]
    pub height: Option<u32>,

    ///  Resize output by a scale factor. Use 'Nx' format (e.g. '0.5x') or 'N%' format (e.g. '50%')
    #[arg(
        long,
        value_name = "FACTOR",
        value_parser = parse_scale,
        help_heading = "SIZE",
    )]
    pub scale: Option<f32>,

    #[arg(
        long,
        value_name = "FILTER",
        default_value = "nearest",
        help_heading = "SIZE"
    )]
    pub filter: Filter,

    #[arg(
        short,
        long,
        value_name = "COUNT",
        default_value_t = num_cpus::get(),
        help_heading = "PERF",
    )]
    pub threads: usize,

    /// [range: 0 - 5]
    #[arg(
        short,
        long,
        value_name = "LEVEL",
        default_value_t = 0,
        help_heading = "PERF"
    )]
    pub quantization: u8,

    /// Single output file or base output dir
    #[clap(short, long)]
    pub output_path: Option<PathBuf>,

    // TODO: fix dis
    /// Comma-separated list of output files (must match number of inputs)
    #[clap(long, value_delimiter = ',')]
    pub output_files: Option<Vec<PathBuf>>,
}

#[derive(Args, Debug)]
pub struct SaveArgs {
    /// Path to a JSON file containing at least a "colors" array with RGB values.
    /// Example:
    /// {
    ///   "colors": [ { "r": 255, "g": 0, "b": 0 } ]
    /// }
    #[arg(value_name = "JSON_PATH", required = true)]
    pub path: PathBuf,

    /// Allows you to overwrite existing custom palettes
    #[arg(
        short,
        long,
        value_name = "FORCE",
        default_value_t = false,
        help_heading = "FLAGS"
    )]
    pub force: bool,
}

#[derive(Args, Debug)]
pub struct ListArgs {
    /// Path to a JSON file containing at least a "colors" array with RGB values.
    /// Example:
    /// {
    ///   "colors": [ { "r": 255, "g": 0, "b": 0 } ]
    /// }
    #[arg(value_name = "JSON_PATH", required = true)]
    pub path: PathBuf,

    /// Allows you to overwrite existing custom palettes
    #[arg(
        short,
        long,
        value_name = "FORCE",
        default_value_t = false,
        help_heading = "FLAGS"
    )]
    pub force: bool,
}

// TODO: Support JSON file inputs
fn parse_palette(s: &str) -> Result<Palette, String> {
    if let Some(palette) = find_palette(s) {
        Ok(palette)
    } else {
        Err(format!("Unknown palette: {s}"))
    }
}

fn parse_lab_scales(s: &str) -> Result<[f32; 3], String> {
    let vals: Vec<_> = s.split(',').map(|v| v.parse::<f32>()).collect();
    if vals.len() != 3 {
        return Err("Expected three comma-separated floats".to_string());
    }
    let mut arr = [0.0; 3];
    for (i, v) in vals.into_iter().enumerate() {
        arr[i] = v.map_err(|_| "Invalid float".to_string())?;
    }
    Ok(arr)
}

fn parse_scale(s: &str) -> Result<f32, String> {
    let trimmed = s.trim();
    if let Some(factor_str) = trimmed.strip_suffix('x') {
        factor_str
            .parse::<f32>()
            .map_err(|e| format!("Invalid scale factor '{}': {}", factor_str, e))
    } else if let Some(percent_str) = trimmed.strip_suffix('%') {
        percent_str
            .parse::<f32>()
            .map(|v| v / 100.0)
            .map_err(|e| format!("Invalid percent '{}': {}", percent_str, e))
    } else {
        trimmed
            .parse::<f32>()
            .map_err(|e| format!("Invalid scale '{}': {}", trimmed, e))
    }
}
