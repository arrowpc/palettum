use super::args::{Cli, Commands};
use crate::style;
use anydir::AnyFileEntry;
use image::ImageFormat;
use indicatif::{MultiProgress, ProgressBar};
use log::{error, info};
use palettum::{
    error::{Error, Result},
    palettify_io, Config, PaletteKind,
};
use palettum::{get_all_palettes, palette_from_file_entry, save_custom_palette};
use rayon::{prelude::*, ThreadPoolBuilder};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use style::FitToTerminal;
use tabled::Table;
use walkdir::WalkDir;

pub fn run_cli(cli: Cli, multi: MultiProgress) -> Result<()> {
    match cli.command {
        Commands::Palettify(args) => {
            const INDIVIDUAL_FILES_LABEL: &str = "Individual";
            // --- 1) BUILD JOB LIST & COUNT FILES ---
            let (jobs, total_files) = if let Some(output_files) = &args.output_files {
                if output_files.len() != args.input_paths.len() {
                    return Err(Error::ParseError(format!(
                        "--output-files expects {} paths, got {}",
                        args.input_paths.len(),
                        output_files.len()
                    )));
                }
                let pairs = args
                    .input_paths
                    .iter()
                    .cloned()
                    .zip(output_files.iter().cloned())
                    .collect::<Vec<_>>();
                let mut map = BTreeMap::new();
                map.insert(INDIVIDUAL_FILES_LABEL.to_string(), pairs);
                (map, args.input_paths.len())
            } else {
                let mut map: BTreeMap<String, Vec<(PathBuf, PathBuf)>> = BTreeMap::new();
                let mut count = 0;
                for input in &args.input_paths {
                    match determine_path_type(input)? {
                        PathType::Image | PathType::Gif => {
                            let out = determine_output_path(
                                args.output_path.as_deref(),
                                input,
                                args.mapping,
                            );
                            map.entry(INDIVIDUAL_FILES_LABEL.to_string())
                                .or_default()
                                .push((input.clone(), out));
                            count += 1;
                        }
                        PathType::Directory => {
                            let out_dir = determine_output_path(
                                args.output_path.as_deref(),
                                input,
                                args.mapping,
                            );
                            let files = process_files(input, &out_dir)?;
                            let dir_name = input
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            for file in files {
                                let rel = file.strip_prefix(input).unwrap();
                                let out = out_dir.join(rel);
                                let out_final = path_with_stem(&out);
                                map.entry(dir_name.clone())
                                    .or_default()
                                    .push((file, out_final));
                                count += 1;
                            }
                        }
                    }
                }
                (map, count)
            };

            // --- 2) SINGLE FILE FAST PATH ---
            if total_files == 1 {
                let (_job, files) = jobs.iter().next().unwrap();
                let (input, output) = files.iter().next().unwrap();
                let input = input.clone();
                let output = output.clone();
                let start = Instant::now();
                let s = style::theme();

                info!(
                    "Palettifying:\n {} → {}\n Palette: {}",
                    s.primary.apply_to(input.display()),
                    s.secondary
                        .apply_to(output_with_final_ext(&input, &output).display()),
                    s.highlight.apply_to(args.palette.id.clone()),
                );

                let config = Arc::new(
                    Config::builder()
                        .palette(args.palette.clone())
                        .mapping(args.mapping)
                        .palettized_formula(args.palettized_formula)
                        .transparency_threshold(args.alpha_threshold)
                        .smoothed_formula(args.smoothed_formula)
                        .smoothing_strength(args.smoothing_strength)
                        .lab_scales(args.lab_scales)
                        .num_threads(args.threads.max(1))
                        .quant_level(args.quantization)
                        .build(),
                );

                if let Some(p) = output.parent() {
                    std::fs::create_dir_all(p)?;
                }
                palettify_io(
                    &input,
                    &output,
                    &config,
                    args.width,
                    args.height,
                    args.scale,
                    args.filter,
                )?;

                let dt: Duration = start.elapsed();
                info!("Done in {}", s.secondary.apply_to(format_duration(dt)));
                return Ok(());
            }

            // --- 3) MULTI-FILE WITH PROGRESS BARS ---
            let m = multi.clone();

            let mut job_pbs = HashMap::new();
            let mut job_names: Vec<_> = jobs.keys().cloned().collect();
            job_names.sort();
            let max_name_len = job_names.iter().map(|n| n.len()).max().unwrap_or(0);

            for name in &job_names {
                let len = jobs.get(name).unwrap().len() as u64;
                let pb = m.add(ProgressBar::new(len));
                pb.set_style(style::create_job_progress_style());
                pb.set_prefix(format!("{:width$}", name.to_string(), width = max_name_len));
                job_pbs.insert(name.clone(), pb);
            }
            let job_pbs = Arc::new(job_pbs);

            let main_pb = if job_names.len() > 1 {
                // Main bar for multiple jobs
                let pb = m.add(ProgressBar::new(total_files as u64));
                pb.set_style(style::create_main_progress_style());
                pb.set_prefix(format!("{:width$}", "Total", width = max_name_len));
                Some(Arc::new(pb))
            } else {
                None
            };

            // Thread allocation
            let total_threads = if args.threads > 0 {
                args.threads
            } else {
                num_cpus::get()
            };
            let file_threads = total_threads.min(total_files);
            let pixel_threads = (total_threads / file_threads).max(1);

            let main_pb = Arc::new(main_pb);
            let job_pbs = Arc::new(job_pbs);
            let pool = ThreadPoolBuilder::new().num_threads(file_threads).build()?;
            // let mut error_count: usize = 0;
            let error_count = Arc::new(Mutex::new(0usize));

            // Schedule jobs
            let mut file_jobs = Vec::new();
            for (job_name, files) in jobs {
                for (input, output) in files {
                    let job_name = job_name.clone();
                    let main_pb = Arc::clone(&main_pb);
                    let job_pbs = Arc::clone(&job_pbs);
                    let palette = args.palette.clone();
                    let mapping = args.mapping;
                    let pal_f = args.palettized_formula;
                    let tmp_f = args.smoothed_formula;
                    let alpha = args.alpha_threshold;
                    let smooth = args.smoothing_strength;
                    let labs = args.lab_scales;
                    let q = args.quantization;
                    let error_count = Arc::clone(&error_count);

                    file_jobs.push(move || {
                        let s = style::theme();
                        job_pbs.get(&job_name).unwrap();

                        if let Some(p) = output.parent() {
                            std::fs::create_dir_all(p).unwrap();
                        }
                        let cfg = Arc::new(
                            Config::builder()
                                .palette(palette.clone())
                                .mapping(mapping)
                                .palettized_formula(pal_f)
                                .transparency_threshold(alpha)
                                .smoothed_formula(tmp_f)
                                .smoothing_strength(smooth)
                                .lab_scales(labs)
                                .num_threads(pixel_threads)
                                .quant_level(q)
                                .build(),
                        );
                        match palettify_io(
                            &input,
                            &output,
                            &cfg,
                            args.width,
                            args.height,
                            args.scale,
                            args.filter,
                        ) {
                            Ok(_) => {
                                let pb = job_pbs.get(&job_name).unwrap();
                                pb.inc(1);
                                if pb.position() >= pb.length().unwrap_or(0) {
                                    pb.set_message(s.success.apply_to("Completed").to_string());
                                }
                                if let Some(main_pb) = main_pb.as_ref() {
                                    main_pb.inc(1);
                                }
                            }
                            Err(e) => {
                                let mut ec = error_count.lock().unwrap();
                                *ec += 1;
                                let pb = job_pbs.get(&job_name).unwrap();
                                pb.inc(1);
                                pb.set_message(s.error.apply_to("Error").to_string());
                                error!("{} ({})", input.display(), e);
                            }
                        }
                    });
                }
            }

            // Run
            let start = Instant::now();
            pool.install(|| {
                file_jobs.into_par_iter().for_each(|job| job());
            });
            m.clear().unwrap();

            let duration = start.elapsed();
            let suc = total_files - *error_count.lock().unwrap();
            let s = style::theme();

            let avg_duration = if suc > 0 {
                duration / suc as u32
            } else {
                std::time::Duration::ZERO
            };

            info!(
                "Palettified {} files in {} ({}/file) using {}",
                s.highlight.apply_to(suc),
                s.secondary.apply_to(format_duration(duration)),
                format_duration(avg_duration),
                s.highlight.apply_to(args.palette.id.clone())
            );

            Ok(())
        }

        Commands::List => {
            let palettes = get_all_palettes();
            let mut table = Table::new(&palettes);
            table.with(tabled::settings::Style::modern_rounded());
            table = table.fit_to_terminal(None, true);
            let s = style::theme();
            info!(
                "Available Palettes ({})\n{}",
                s.highlight.apply_to(palettes.len()),
                table
            );
            Ok(())
        }

        Commands::Save(args) => {
            let path = AnyFileEntry::from_path(args.path)?;
            let palette = palette_from_file_entry(&path, PaletteKind::Custom)?;
            let saved_path = save_custom_palette(&palette, args.force)?;
            let s = style::theme();

            info!(
                "{} saved to: {}",
                s.highlight.apply_to(palette.id),
                s.secondary.apply_to(saved_path.display())
            );

            Ok(())
        }
    }
}

enum PathType {
    Image,
    Gif,
    Directory,
}

fn determine_path_type(path: &Path) -> Result<PathType> {
    if path.is_dir() {
        Ok(PathType::Directory)
    } else if path.is_file() {
        if let Ok(format) = ImageFormat::from_path(path) {
            if format == ImageFormat::Gif {
                Ok(PathType::Gif)
            } else {
                Ok(PathType::Image)
            }
        } else {
            Err(Error::Io(std::io::Error::other(format!(
                "File {} exists but isn't recognised as an image",
                path.display()
            ))))
        }
    } else {
        Err(Error::Io(std::io::Error::other(format!(
            "Path {} doesn't exist or isn't a file/directory",
            path.display()
        ))))
    }
}

fn determine_output_path(
    output: Option<&Path>,
    input: &Path,
    mapping: palettum::Mapping,
) -> PathBuf {
    if let Some(path) = output {
        return path.to_path_buf();
    }

    let suffix = match mapping {
        palettum::Mapping::Palettized => "_palettized",
        palettum::Mapping::Smoothed => "_smoothed",
        palettum::Mapping::SmoothedPalettized => "_smoothed_palettized",
    };

    let parent = input.parent().unwrap_or_else(|| Path::new("."));

    // If input has an extension, treat as file, else as directory
    let name = if input.extension().is_some() {
        input.file_stem().unwrap_or_default()
    } else {
        input.file_name().unwrap_or_default()
    };

    let mut new_name = name.to_os_string();
    new_name.push(suffix);

    parent.join(new_name)
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

fn path_with_stem(original_path: &Path) -> PathBuf {
    let parent = original_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = original_path
        .file_stem()
        .unwrap_or_else(|| original_path.file_name().unwrap_or_default());
    parent.join(stem)
}

// TODO: Check if directory already exists & implement --force flag for palettify command
fn process_files(src_dir: &Path, dst_dir: &Path) -> Result<Vec<PathBuf>> {
    let exts = ["gif", "png", "jpg", "jpeg", "webp"];
    let mut image_files = Vec::new();

    fs::create_dir_all(dst_dir)?;

    for entry in WalkDir::new(src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase());
            let is_image = ext.as_deref().map(|e| exts.contains(&e)).unwrap_or(false);

            if is_image {
                image_files.push(path.to_path_buf());
            }

            if let Ok(rel_path) = path.strip_prefix(src_dir) {
                let dst_path = dst_dir.join(rel_path);
                if let Some(parent) = dst_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(path, dst_path)?;
            }
        }
    }
    Ok(image_files)
}

fn output_with_final_ext(input: &Path, output: &Path) -> PathBuf {
    let mut out = output.to_path_buf();
    let ext = match determine_path_type(input) {
        Ok(PathType::Gif) => "gif",
        Ok(PathType::Image) => "png",
        _ => return out,
    };
    out.set_extension(ext);
    out
}
