use clap::{Parser, Subcommand};
use image::imageops::FilterType;
use palettum::{DeltaEMethod, Mapping, WeightingKernelType};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "palettum", about = "Palette-based image processing tool")]
pub struct Cli {
    #[arg(short, long, global = true)]
    pub verbose: bool,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Clone)]
pub enum Commands {
    Palettify(PalettifyArgs),
    #[command(name = "list-palettes")]
    ListPalettes(ListPalettesArgs),
    #[command(name = "save-palette")]
    SavePalette(SavePaletteArgs),
}

#[derive(Parser, Clone)]
pub struct PalettifyArgs {
    #[arg(value_name = "INPUT_FILE")]
    pub input_file: PathBuf,
    #[arg(short, long, value_name = "OUTPUT_FILE")]
    pub output: Option<PathBuf>,
    #[arg(short, long, required = true, value_name = "ID_OR_PATH")]
    pub palette: String,
    #[arg(short, long, default_value = "palettized", value_name = "STRATEGY", value_parser = parse_mapping)]
    pub mapping: Mapping,
    #[arg(long, default_value = "ciede2000", value_name = "METHOD", value_parser = parse_delta_e)]
    pub delta_e: DeltaEMethod,
    #[arg(long, value_parser = clap::value_parser!(u8).range(0..=255), default_value_t = 2)]
    pub quant_level: u8,
    #[arg(long, value_parser = clap::value_parser!(u8).range(0..=255), default_value_t = 128)]
    pub alpha_threshold: u8,
    #[arg(short, long, value_name = "THREADS", default_value_t = num_cpus::get())]
    pub threads: usize,
    #[arg(long, default_value = "inverse_distance_power", value_name = "KERNEL", value_parser = parse_kernel)]
    pub weighting_kernel: WeightingKernelType,
    #[arg(long, default_value_t = 0.08)]
    pub shape_parameter: f64,
    #[arg(long, default_value_t = 3.5)]
    pub power_parameter: f64,
    #[arg(long, default_value = "1.0,1.0,1.0", value_name = "L,A,B", value_parser = parse_lab_scales)]
    pub lab_scales: [f64; 3],
    #[arg(long, value_name = "PIXELS")]
    pub width: Option<u32>,
    #[arg(long, value_name = "PIXELS")]
    pub height: Option<u32>,
    #[arg(long, value_name = "FACTOR")]
    pub scale: Option<String>,
    #[arg(long, default_value = "lanczos3", value_name = "FILTER", value_parser = parse_filter_type)]
    pub resize_filter: FilterType,
    #[arg(long, short)]
    pub quiet: bool,
}

#[derive(Parser, Clone)]
pub struct ListPalettesArgs {
    #[arg(short, long)]
    pub show_paths: bool,
}

#[derive(Parser, Clone)]
pub struct SavePaletteArgs {
    #[arg(value_name = "JSON_FILE")]
    pub json_file: PathBuf,
    #[arg(long, short, value_name = "ID")]
    pub id: Option<String>,
    #[arg(long, short)]
    pub force: bool,
}

impl From<Commands> for crate::Command {
    fn from(cmd: Commands) -> Self {
        match cmd {
            Commands::Palettify(args) => crate::Command::Palettify(args.into()),
            Commands::ListPalettes(args) => crate::Command::ListPalettes(args.into()),
            Commands::SavePalette(args) => crate::Command::SavePalette(args.into()),
        }
    }
}

impl From<PalettifyArgs> for crate::PalettifyArgs {
    fn from(args: PalettifyArgs) -> Self {
        crate::PalettifyArgs {
            input_file: args.input_file,
            output: args.output,
            palette: args.palette,
            mapping: args.mapping,
            delta_e: args.delta_e,
            quant_level: args.quant_level,
            alpha_threshold: args.alpha_threshold,
            threads: args.threads,
            weighting_kernel: args.weighting_kernel,
            shape_parameter: args.shape_parameter,
            power_parameter: args.power_parameter,
            lab_scales: args.lab_scales,
            width: args.width,
            height: args.height,
            scale: args.scale,
            resize_filter: args.resize_filter,
            quiet: args.quiet,
        }
    }
}

impl From<ListPalettesArgs> for crate::ListPalettesArgs {
    fn from(args: ListPalettesArgs) -> Self {
        crate::ListPalettesArgs {
            show_paths: args.show_paths,
        }
    }
}

impl From<SavePaletteArgs> for crate::SavePaletteArgs {
    fn from(args: SavePaletteArgs) -> Self {
        crate::SavePaletteArgs {
            json_file: args.json_file,
            id: args.id,
            force: args.force,
        }
    }
}

fn parse_mapping(mapping: &str) -> Result<Mapping, String> {
    match mapping.to_lowercase().as_str() {
        "palettized" => Ok(Mapping::Palettized),
        "smoothed" => Ok(Mapping::Smoothed),
        "smoothed_palettized" => Ok(Mapping::SmoothedPalettized),
        _ => Err(format!("Invalid mapping strategy: {}", mapping)),
    }
}

fn parse_delta_e(method: &str) -> Result<DeltaEMethod, String> {
    match method.to_lowercase().as_str() {
        "cie76" => Ok(DeltaEMethod::CIE76),
        "cie94" => Ok(DeltaEMethod::CIE94),
        "ciede2000" => Ok(DeltaEMethod::CIEDE2000),
        _ => Err(format!("Invalid Delta E method: {}", method)),
    }
}

fn parse_kernel(kernel: &str) -> Result<WeightingKernelType, String> {
    match kernel.to_lowercase().as_str() {
        "gaussian" => Ok(WeightingKernelType::Gaussian),
        "inverse_distance_power" => Ok(WeightingKernelType::InverseDistancePower),
        _ => Err(format!("Invalid weighting kernel: {}", kernel)),
    }
}

fn parse_lab_scales(scales: &str) -> Result<[f64; 3], String> {
    let parts: Vec<&str> = scales.split(',').map(|s| s.trim()).collect();
    if parts.len() != 3 {
        return Err("LAB scales must be three comma-separated values".into());
    }
    let mut result = [0.0; 3];
    for (i, part) in parts.iter().enumerate() {
        result[i] = part
            .parse::<f64>()
            .map_err(|e| format!("Invalid float: {}", e))?;
    }
    Ok(result)
}

fn parse_filter_type(filter: &str) -> Result<FilterType, String> {
    match filter.to_lowercase().as_str() {
        "nearest" => Ok(FilterType::Nearest),
        "triangle" => Ok(FilterType::Triangle),
        "catmullrom" => Ok(FilterType::CatmullRom),
        "gaussian" => Ok(FilterType::Gaussian),
        "lanczos3" => Ok(FilterType::Lanczos3),
        _ => Err(format!("Invalid resize filter: {}", filter)),
    }
}
