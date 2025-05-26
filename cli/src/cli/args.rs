use palettum::{dithered, find_palette, palettized, smoothed, Filter, Mapping, Palette};
use std::path::PathBuf;

use clap::{ArgAction, Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "palettum",
    version,
    about = "Tool for recoloring images and GIFs with any palette of your choice",
    help_template = "\
{before-help}{name} {version}
{author-with-newline}{about-with-newline}
{usage-heading}
  {usage}

{all-args}{after-help}
",
    override_usage = "palettum \x1b[3m\x1b[38;5;65m[COMMAND] [OPTIONS] [FLAGS]\x1b[0m",
    disable_help_flag = true,
    disable_version_flag = true,
    styles(crate::style::clap_styles()),
    rename_all_env = "screaming-snake",
    subcommand_help_heading = "COMMANDS"
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

    #[arg(
		short = 'V',
		long,
		action = ArgAction::Version,
		help = "Prints version information",
		help_heading = "FLAGS"
	)]
    pub version: Option<bool>,

    #[arg(
        short,
        long,
        action = ArgAction::Count,
        global = true,
        help = "Increases logging verbosity (repeatable)",
        help_heading = "FLAGS"
    )]
    pub verbose: u8,

    /// The subcommand to run
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Recolor images using a palette
    #[command(
        override_usage = "palettum palettify \x1b[3m\x1b[38;5;65m<PATH>...\x1b[0m --palette \x1b[3m\x1b[38;5;65m<PALETTE> [OPTIONS]\x1b[0m",
        help_template = "\
{before-help}
{about-with-newline}
{usage-heading}
  {usage}

{all-args}{after-help}
"
    )]
    Palettify(PalettifyArgs),

    /// List all available palettes
    #[command(override_usage = "palettum list")]
    List,

    #[command(
        override_usage = "palettum save \x1b[3m\x1b[38;5;65m<JSON_PATH> [--FORCE]\x1b",
        about = "Saves your palette locally to be used wherever.\n\
                  You can easily create and export palettes at \
                  \x1b]8;;https://palettum.com\x1b\\\
                  \x1b[4;94mpalettum.com\x1b[0m\
                  \x1b]8;;\x1b\\",
        help_template = "\
{before-help}
{about-with-newline}
{usage-heading}
  {usage}

{all-args}{after-help}
"
    )]
    Save(SaveArgs),

    /// Delete a custom palette
    #[command(override_usage = "palettum delete \x1b[3m\x1b[38;5;65m<PALETTE>\x1b")]
    Delete(DeleteArgs),

    /// Extract palette from media
    Extract(ExtractArgs),
}

#[derive(Args, Debug)]
pub struct PalettifyArgs {
    /// Input files and/or directories (comma-separated)
    #[arg(
        value_name = "PATH",
        value_delimiter = ',',
        required = true,
        help_heading = "REQUIRED OPTIONS"
    )]
    pub input_paths: Vec<PathBuf>,

    #[arg(
        short,
        long,
        value_parser = parse_palette,
        value_name = "PALETTE",
        required = true,
        help = "Use the \x1b[38;5;130mlist\x1b[0m command to see all available palettes",
        help_heading = "REQUIRED OPTIONS",
    )]
    pub palette: Palette,

    /// Color mapping method
    #[arg(
        short,
        long,
        value_name = "MAPPING",
        default_value = "smoothed",
        value_enum,
        help_heading = "MISC OPTIONS"
    )]
    pub mapping: Mapping,

    /// Output directory or single file
    #[arg(short, long, help_heading = "MISC OPTIONS")]
    pub output_path: Option<PathBuf>,

    /// Comma-separated list of output files (must match input count)
    #[arg(long, value_delimiter = ',', help_heading = "MISC OPTIONS")]
    pub output_files: Option<Vec<PathBuf>>,

    // PALETTIZED OPTIONS
    /// Color matching formula
    #[arg(
        long,
        value_enum,
        value_name = "FORMULA",
        default_value = "ciede2000",
        help_heading = "PALETTIZED OPTIONS"
    )]
    pub palettized_formula: palettized::Formula,

    /// Dithering algorithm to apply (useful with limited palettes)
    #[arg(
        short,
        long,
        value_enum,
        value_name = "ALGORITHM",
        default_value = "none",
        help_heading = "PALETTIZED OPTIONS"
    )]
    pub dithering_algorithm: dithered::Algorithm,

    /// Alpha threshold (0-255, 0 disables transparency)
    #[arg(
        short,
        long,
        value_name = "CHANNEL",
        default_value_t = 128,
        help_heading = "PALETTIZED OPTIONS"
    )]
    pub alpha_threshold: u8,

    // SMOOTHED OPTIONS
    /// Interpolation formula
    #[arg(
        short,
        long,
        value_enum,
        value_name = "FORMULA",
        default_value = "idw",
        help_heading = "SMOOTHED OPTIONS"
    )]
    pub smoothed_formula: smoothed::Formula,

    /// Smoothing strength (0.1-1.0)
    #[arg(
        long,
        value_name = "STRENGTH",
        default_value_t = 0.5,
        help_heading = "SMOOTHED OPTIONS"
    )]
    pub smoothing_strength: f32,

    /// LAB color space scaling factors
    #[arg(
        short,
        long,
        default_value = "1.0,1.0,1.0",
        value_name = "L,A,B",
        value_parser = parse_lab_scales,
        help_heading = "SMOOTHED OPTIONS",
    )]
    pub lab_scales: [f32; 3],

    // SIZE OPTIONS
    /// Resize output to this width (preserves aspect ratio with height)
    #[arg(long, value_name = "PIXELS", help_heading = "SIZE OPTIONS")]
    pub width: Option<u32>,

    /// Resize output to this height (preserves aspect ratio with width)
    #[arg(long, value_name = "PIXELS", help_heading = "SIZE OPTIONS")]
    pub height: Option<u32>,

    /// Resize scale factor (e.g. '0.5x' or '50%')
    #[arg(
        long,
        value_name = "FACTOR",
        value_parser = parse_scale,
        help_heading = "SIZE OPTIONS",
    )]
    pub scale: Option<f32>,

    /// Resize filter algorithm
    #[arg(
        long,
        value_name = "FILTER",
        default_value = "nearest",
        help_heading = "SIZE OPTIONS"
    )]
    pub filter: Filter,

    // PERFORMANCE OPTIONS
    /// Number of processing threads
    #[arg(
        short,
        long,
        value_name = "COUNT",
        default_value_t = num_cpus::get(),
        help_heading = "PERFORMANCE OPTIONS",
    )]
    pub threads: usize,

    /// Color quantization level (0-5)
    #[arg(
        short,
        long,
        value_name = "LEVEL",
        default_value_t = 0,
        help_heading = "PERFORMANCE OPTIONS"
    )]
    pub quantization: u8,
}

#[derive(Args, Debug)]
pub struct SaveArgs {
    /// Path to a JSON file containing at least a "colors" array with RGB values
    #[arg(
        value_name = "JSON_PATH",
        required = true,
        help_heading = "REQUIRED OPTIONS"
    )]
    pub path: PathBuf,

    /// Allows you to overwrite existing custom palettes
    #[arg(short, long, default_value_t = false, help_heading = "FLAGS")]
    pub force: bool,
}

#[derive(Args, Debug)]
pub struct DeleteArgs {
    #[arg(
        value_parser = parse_palette,
        value_name = "PALETTE",
        required = true,
        help = "Use the \x1b[38;5;130mlist\x1b[0m command to see all available palettes",
    )]
    pub palette: Palette,
}

#[derive(Args, Debug)]
pub struct ExtractArgs {
    /// Input image file
    #[arg(value_name = "IMAGE", required = true)]
    pub input: PathBuf,

    /// Number of colors to extract
    #[arg(short, long, value_name = "NUM", default_value_t = 8)]
    pub colors: usize,

    /// Output file for the palette
    #[arg(short, long, value_name = "FILE")]
    pub output: Option<PathBuf>,
}

// Parsers

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
