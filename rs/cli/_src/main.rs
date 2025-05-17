use anyhow::Result;
use clap::Parser;
use palettum_cli::cli::args::Cli;

#[cfg(feature = "tui")]
use {console::style, palettum_cli::tui::run_tui};

use palettum_cli::cli::runner::run_cli;

fn main() -> Result<()> {
    let cli = Cli::parse();

    #[cfg(feature = "tui")]
    if cli.command.is_none() {
        eprintln!(
            "{}",
            style("Warning: the TUI is experimental, lacking most features, and may not work as expected.")
                .yellow()
                .bold()
        );
        run_tui(cli.command.map(|c| c.into()))?;
        return Ok(());
    }

    run_cli(cli)?;
    Ok(())
}
