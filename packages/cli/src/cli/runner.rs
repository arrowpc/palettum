use crate::{
    cli::args::Cli, format_duration, format_filesize, style, Command, CommandResult, PaletteKind,
};
use anyhow::Result;
use console::Term;
use indicatif::TermLike;
use tabled::{
    settings::{object::Segment, width::Width, Modify, Style},
    Table, Tabled,
};

#[derive(Tabled)]
struct PaletteRow {
    #[tabled(rename = "ID")]
    id: String,
    #[tabled(rename = "Name")]
    name: String,
    #[tabled(rename = "Type")]
    kind: String,
    #[tabled(rename = "Colors")]
    colors: usize,
    #[tabled(rename = "Source")]
    source: String,
}

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
            if !args.silent {
                term.write_line(&format!(
                    "🎨 Palettifying '{}' with '{}'...",
                    args.input_path.display(),
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
                if !args.silent {
                    term.write_line(
                        &style::classic_success()
                            .apply_to("✔ Palettification complete!")
                            .to_string(),
                    )?;
                    let label_width = 7; // Based on longest label "Output:"
                    term.write_line(&format!(
                        "  {:<label_width$} {}",
                        style::classic_bold().apply_to("Input:"),
                        format!(
                            "{} ({})",
                            input_path.display(),
                            format_filesize(std::fs::metadata(input_path)?.len())
                        )
                    ))?;
                    term.write_line(&format!(
                        "  {:<label_width$} {}",
                        style::classic_bold().apply_to("Output:"),
                        format!(
                            "{} ({})",
                            output_path.display(),
                            format_filesize(std::fs::metadata(output_path)?.len())
                        )
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
                let rows: Vec<PaletteRow> = palettes
                    .iter()
                    .map(|p| PaletteRow {
                        id: p.id.clone(),
                        name: p.name.clone(),
                        kind: match p.kind {
                            PaletteKind::Custom => "Custom".to_string(),
                            PaletteKind::Default => "Default".to_string(),
                        },
                        colors: p.colors.len(),
                        source: p.source.clone().unwrap_or_else(|| "Default".to_string()),
                    })
                    .collect();

                let mut table = Table::new(rows);
                table.with(Style::rounded());
                //TODO: If extra space is left, increase the max width of columns that are wrapped
                table.with(
                    Modify::new(Segment::all()).with(
                        Width::truncate(((term.width() as usize) / table.count_columns()) - 1)
                            .suffix("..."),
                    ),
                );
                term.write_line(&format!("Available Palettes ({})\n{table}", palettes.len()))?;
            }
            result
        }
        Command::SavePalette(args) => {
            let result = crate::execute_command(Command::SavePalette(args.clone()))?;
            if let CommandResult::SavePaletteSuccess { id, path } = &result {
                term.write_line(
                    &style::classic_success()
                        .apply_to(format!("✔ Palette '{}' saved successfully!", id))
                        .to_string(),
                )?;
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
            term.write_line(
                &style::classic_error()
                    .apply_to(format!("Error: {}", e))
                    .to_string(),
            )?;
            Err(e)
        }
    }
}
