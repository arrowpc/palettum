use super::args::{Cli, Commands};
use crate::style;
use anydir::AnyFileEntry;
use futures::stream::{FuturesUnordered, StreamExt};
use indicatif::{MultiProgress, ProgressBar};
use log::{error, info};
use palettum::{
    custom_palettes_dir, delete_custom_palette, media::load_media_from_path, palette_to_file,
    Config, Palette, PaletteKind,
};
use palettum::{get_all_palettes, palette_from_file_entry, save_custom_palette};
use rayon::prelude::*;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use style::FitToTerminal;
use tabled::Table;
use walkdir::WalkDir;

use anyhow::{bail, Context, Result};
const VALID_EXTS: [&str; 7] = ["gif", "png", "jpg", "jpeg", "webp", "ico", "mp4"];

pub async fn run_cli(cli: Cli, multi: MultiProgress) -> Result<()> {
    let s = style::theme();
    match cli.command {
        Commands::Palettify(args) => {
            const INDIVIDUAL_FILES_LABEL: &str = "Individual";
            // --- 1) BUILD JOB LIST & COUNT FILES ---
            let (jobs, total_files) = if let Some(output_files) = &args.output_files {
                if output_files.len() != args.input.len() {
                    bail!(
                        "--output-files expects {} paths, got {}",
                        args.input.len(),
                        output_files.len()
                    );
                }
                let pairs = args
                    .input
                    .iter()
                    .cloned()
                    .zip(output_files.iter().cloned())
                    .collect::<Vec<_>>();
                let mut map = BTreeMap::new();
                map.insert(INDIVIDUAL_FILES_LABEL.to_string(), pairs);
                (map, args.input.len())
            } else {
                let mut map: BTreeMap<String, Vec<(PathBuf, PathBuf)>> = BTreeMap::new();
                let mut count = 0;
                for input in &args.input {
                    if input.is_dir() {
                        // Directory
                        let out_dir = determine_output(args.output.as_deref(), input, args.mapping);
                        let files = process_files(input, &out_dir)
                            .with_context(|| format!("Failed to process files in {input:?}"))?;
                        let dir_name = input
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        for file in files {
                            let rel = file.strip_prefix(input).unwrap();
                            let out = out_dir.join(rel);
                            // let out_final = path_with_stem(&out);
                            let out_final = out.with_extension(""); // New line
                            map.entry(dir_name.clone())
                                .or_default()
                                .push((file, out_final));
                            count += 1;
                        }
                    } else {
                        // File
                        let out = determine_output(args.output.as_deref(), input, args.mapping);
                        map.entry(INDIVIDUAL_FILES_LABEL.to_string())
                            .or_default()
                            .push((input.clone(), out));
                        count += 1;
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

                let num_threads_for_config = if cfg!(feature = "gpu") {
                    num_cpus::get()
                } else {
                    args.threads.max(1)
                };

                let config = Arc::new(
                    Config::builder()
                        .palette(args.palette.clone())
                        .mapping(args.mapping)
                        .diff_formula(args.diff_formula)
                        .transparency_threshold(args.alpha)
                        .dither_algorithm(args.dither_algorithm)
                        .dither_strength(args.dither_strength)
                        .smooth_formula(args.smooth_formula)
                        .smooth_strength(args.smooth_strength)
                        .num_threads(num_threads_for_config)
                        .quant_level(args.quantization)
                        .build(),
                );

                if let Some(p) = output.parent() {
                    std::fs::create_dir_all(p)
                        .with_context(|| format!("Failed to create output directory {p:?}"))?;
                }

                if !input.exists() {
                    bail!("Could not find {}. Make sure it exists", input.display())
                }

                if input.is_file()
                    && !input
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .is_some_and(|ext| VALID_EXTS.contains(&ext))
                {
                    bail!(
                        "Invalid file extension for {}. Allowed: {}",
                        input.display(),
                        VALID_EXTS.join(", ")
                    );
                }
                let mut media = load_media_from_path(&input)
                    .with_context(|| format!("Failed to load media from {input:?}"))?;

                let mut output_with_ext = output.clone();
                output_with_ext.set_extension(media.default_extension());
                info!(
                    "Palettifying:\n {} → {}\n Palette: {}",
                    s.primary.apply_to(input.display()),
                    s.secondary.apply_to(output_with_ext.display()),
                    s.highlight.apply_to(args.palette.id.clone()),
                );

                media
                    .resize(args.width, args.height, args.scale, args.filter)
                    .with_context(|| format!("Failed to resize {input:?}"))?;
                media
                    .palettify(&config)
                    .await
                    .with_context(|| format!("Failed to palettify {input:?}"))?;
                media
                    .write_to_file(&output)
                    .with_context(|| format!("Failed to write output {output:?}"))?;

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
                let pb = m.add(ProgressBar::new(total_files as u64));
                pb.set_style(style::create_main_progress_style());
                pb.set_prefix(format!("{:width$}", "Total", width = max_name_len));
                Some(Arc::new(pb))
            } else {
                None
            };

            let total_threads = if cfg!(feature = "gpu") {
                num_cpus::get()
            } else {
                args.threads
            };
            let file_threads = total_threads.min(total_files);

            let main_pb = Arc::new(main_pb);
            let job_pbs = Arc::clone(&job_pbs);
            let error_count = Arc::new(Mutex::new(0usize));

            // --- ASYNC PARALLEL JOBS ---
            let file_jobs = FuturesUnordered::new();
            for (job_name, files) in jobs {
                for (input, output) in files {
                    let job_name = job_name.clone();
                    let main_pb = Arc::clone(&main_pb);
                    let job_pbs = Arc::clone(&job_pbs);
                    let palette = args.palette.clone();
                    let mapping = args.mapping;
                    let pal_f = args.diff_formula;
                    let tmp_f = args.smooth_formula;
                    let alpha = args.alpha;
                    let smooth = args.smooth_strength;
                    let q = args.quantization;
                    let error_count = Arc::clone(&error_count);
                    let dither_algorithm = args.dither_algorithm;
                    let dither_strength = args.dither_strength;
                    let width = args.width;
                    let height = args.height;
                    let scale = args.scale;
                    let filter = args.filter;
                    let pixel_threads = if cfg!(feature = "gpu") {
                        num_cpus::get()
                    } else {
                        (total_threads / file_threads).max(1)
                    };

                    file_jobs.push(async move {
                        job_pbs.get(&job_name).unwrap();

                        if let Some(p) = output.parent() {
                            std::fs::create_dir_all(p).unwrap();
                        }
                        let cfg = Arc::new(
                            Config::builder()
                                .palette(palette.clone())
                                .mapping(mapping)
                                .diff_formula(pal_f)
                                .transparency_threshold(alpha)
                                .dither_algorithm(dither_algorithm)
                                .dither_strength(dither_strength)
                                .smooth_formula(tmp_f)
                                .smooth_strength(smooth)
                                .num_threads(pixel_threads)
                                .quant_level(q)
                                .build(),
                        );

                        let result: Result<()> = async {
                            let mut media = load_media_from_path(&input)
                                .with_context(|| format!("Failed to load media from {input:?}"))?;
                            media
                                .resize(width, height, scale, filter)
                                .with_context(|| format!("Failed to resize {input:?}"))?;
                            media
                                .palettify(&cfg)
                                .await
                                .with_context(|| format!("Failed to palettify {input:?}"))?;
                            media
                                .write_to_file(&output)
                                .with_context(|| format!("Failed to write output {output:?}"))?;
                            Ok(())
                        }
                        .await;

                        match result {
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

            let start = Instant::now();
            file_jobs
                .for_each_concurrent(file_threads, |_| async {})
                .await;
            m.clear().unwrap();

            let duration = start.elapsed();
            let suc = total_files - *error_count.lock().unwrap();

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
            info!(
                "Available Palettes ({})\n{}",
                s.highlight.apply_to(palettes.len()),
                table
            );
            Ok(())
        }

        Commands::Save(args) => {
            let path = AnyFileEntry::from_path(args.path)
                .context("Failed to create file entry from path")?;
            let palette = palette_from_file_entry(&path, PaletteKind::Custom)
                .context("Failed to create palette from file entry")?;
            let saved_path = save_custom_palette(&palette, args.force)
                .context("Failed to save custom palette")?;

            info!(
                "{} saved to: {}",
                s.highlight.apply_to(palette.id),
                s.secondary.apply_to(saved_path.display())
            );

            Ok(())
        }

        Commands::Delete(args) => {
            delete_custom_palette(&args.palette).context("Failed to delete custom palette")?;

            info!(
                "Deleted {} from {}",
                s.highlight.apply_to(args.palette.id),
                custom_palettes_dir().as_rt().unwrap().path.display()
            );

            Ok(())
        }

        Commands::Extract(args) => {
            let media = load_media_from_path(&args.input)
                .with_context(|| format!("Failed to load media from {:?}", args.input))?;
            let palette = Palette::from_media(&media, args.colors)?;
            let output = if let Some(ref out) = args.output {
                PathBuf::from(out)
            } else {
                extracted_output(&args.input)
            };
            palette_to_file(&palette, &output)
                .with_context(|| format!("Failed to write palette to {output:?}"))?;

            let mut json_output = output.clone();
            json_output.set_extension("json");
            info!(
                "Extracted palette saved to: {}",
                s.secondary.apply_to(json_output.display())
            );
            Ok(())
        }
    }
}

fn extracted_output(input: &Path) -> PathBuf {
    let parent = input.parent().unwrap_or_else(|| Path::new(""));
    let stem = input.file_stem().unwrap_or_default();
    let mut new_name = stem.to_os_string();
    new_name.push("_extracted");
    parent.join(new_name)
}

fn determine_output(output: Option<&Path>, input: &Path, mapping: palettum::Mapping) -> PathBuf {
    if let Some(path) = output {
        return path.to_path_buf();
    }

    let suffix = match mapping {
        palettum::Mapping::Palettized => "_palettized",
        palettum::Mapping::Smoothed => "_smoothed",
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
        format!("{millis}ms")
    } else {
        format!("{secs:.3}s")
    }
}

// TODO: Check if directory already exists & implement --force flag for palettify command
fn process_files(src_dir: &Path, dst_dir: &Path) -> Result<Vec<PathBuf>> {
    fs::create_dir_all(dst_dir)
        .with_context(|| format!("Failed to create directory {dst_dir:?}"))?;

    let entries: Vec<walkdir::DirEntry> = WalkDir::new(src_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|entry| entry.file_type().is_file())
        .collect();

    let results: Vec<Result<Option<PathBuf>>> = entries
        .par_iter()
        .map(|entry| {
            let path = entry.path();

            let rel_path = path
                .strip_prefix(src_dir)
                .with_context(|| format!("Failed to strip prefix {src_dir:?} from {path:?}"))?;
            let dst_path = dst_dir.join(rel_path);

            if let Some(parent) = dst_path.parent() {
                fs::create_dir_all(parent)
                    .with_context(|| format!("Failed to create directory {parent:?}"))?;
            }

            fs::copy(path, &dst_path)
                .with_context(|| format!("Failed to copy {path:?} to {dst_path:?}"))?;

            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase());

            if ext.as_deref().is_some_and(|e| VALID_EXTS.contains(&e)) {
                Ok(Some(path.to_path_buf())) // It's an image, return its path
            } else {
                Ok(None)
            }
        })
        .collect();

    let mut image_files = Vec::new();
    for result in results {
        match result {
            Ok(Some(image_path)) => image_files.push(image_path),
            Ok(None) => {}
            Err(e) => return Err(e),
        }
    }

    Ok(image_files)
}
