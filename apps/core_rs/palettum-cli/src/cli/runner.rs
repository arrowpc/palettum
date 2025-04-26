use crate::{cli::args::Cli, format_duration, format_filesize, style, Command, CommandResult, PaletteKind};
use anyhow::Result;
use console::Term;

pub fn run_cli(cli: Cli) -> Result<()> {
    let term = Term::stdout();

    if cli.verbose {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug")).init();
    } else {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    }

    let command = match cli.command {
        Some(cmd) => cmd.into(),
        None => {
            term.write_line("No command specified. Use --help for usage.")?;
            return Ok(());
        }
    };

    let result = match command {
        Command::Palettify(args) => {
            if !args.quiet {
                term.write_line(&format!(
                    "🎨 Palettifying '{}' with '{}'...",
                    args.input_file.display(),
                    style::classic_accent().apply_to(&args.palette)
                ))?;
            }
            let result = crate::execute_command(Command::Palettify(args.clone()))?;
            if let CommandResult::PalettifySuccess {
                input_path,
                output_path,
                duration,
            } = &result
            {
                if !args.quiet {
                    term.write_line(&style::classic_success()
                        .apply_to("✔ Palettification complete!")
                        .to_string())?;
                    let label_width = 7; // Based on longest label "Output:"
                    term.write_line(&format!(
                        "  {:<label_width$} {}",
                        style::classic_bold().apply_to("Input:"),
                        format!("{} ({})", input_path.display(), format_filesize(std::fs::metadata(input_path)?.len()))
                    ))?;
                    term.write_line(&format!(
                        "  {:<label_width$} {}",
                        style::classic_bold().apply_to("Output:"),
                        format!("{} ({})", output_path.display(), format_filesize(std::fs::metadata(output_path)?.len()))
                    ))?;
                    term.write_line(&format!(
                        "  {:<label_width$} {}",
                        style::classic_bold().apply_to("Time:"),
                        format_duration(*duration)
                    ))?;
                }
            }
            result
        }
        Command::ListPalettes(_) => {
            let result = crate::execute_command(command)?;
            if let CommandResult::ListPalettesSuccess(palettes) = &result {
                term.write_line(&style::classic_header()
                    .apply_to(format!("Available Palettes ({})", palettes.len()))
                    .to_string())?;
                let id_width = palettes.iter().map(|p| p.id.len()).max().unwrap_or(10).max(4);
                let name_width = palettes.iter().map(|p| p.name.len()).max().unwrap_or(20).max(6);
                let source_width = palettes
                    .iter()
                    .map(|p| p.source.as_ref().map_or(8, |pb| pb.len()))
                    .max()
                    .unwrap_or(30)
                    .max(6);
                term.write_line(&format!(
                    "  {:<id_width$} {:<name_width$} {:<10} {:<8} {}",
                    style::classic_bold().apply_to("ID"),
                    style::classic_bold().apply_to("Name"),
                    style::classic_bold().apply_to("Type"),
                    style::classic_bold().apply_to("Colors"),
                    style::classic_bold().apply_to("Source")
                ))?;
                term.write_line(&"-".repeat(2 + id_width + 1 + name_width + 1 + 10 + 1 + 8 + 1 + source_width))?;
                for palette in palettes {
                    let type_str = if palette.kind == PaletteKind::Custom {
                        style::classic_accent().apply_to("Custom")
                    } else {
                        style::classic_dim().apply_to("Default")
                    };
                    let source_str = palette.source.as_ref().map_or(
                        style::classic_dim().apply_to("Default").to_string(),
                        |p| p.to_string(),
                    );
                    term.write_line(&format!(
                        "  {:<id_width$} {:<name_width$} {:<10} {:<8} {:<source_width$}",
                        palette.id, palette.name, type_str, palette.colors.len(), source_str
                    ))?;
                }
            }
            result
        }
        Command::SavePalette(args) => {
            let result = crate::execute_command(Command::SavePalette(args.clone()))?;
            if let CommandResult::SavePaletteSuccess { id, path } = &result {
                term.write_line(&style::classic_success()
                    .apply_to(format!("✔ Palette '{}' saved successfully!", id))
                    .to_string())?;
                term.write_line(&format!(
                    "   > Location: {}",
                    style::classic_info().apply_to(path.display())
                ))?;
            }
            result
        }
    };

    match result {
        CommandResult::PalettifySuccess { .. } => Ok(()),
        CommandResult::ListPalettesSuccess(_) => Ok(()),
        CommandResult::SavePaletteSuccess { .. } => Ok(()),
        CommandResult::Error(e) => {
            term.write_line(&style::classic_error().apply_to(format!("Error: {}", e)).to_string())?;
            Err(e)
        }
    }
}
