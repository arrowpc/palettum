use anyhow::Result;
use clap::Parser;
use palettum_cli::cli::args::Cli;

#[cfg(feature = "tui")]
use palettum_cli::tui::run_tui;

use palettum_cli::cli::runner::run_cli;

fn main() -> Result<()> {
    let cli = Cli::parse();

    #[cfg(feature = "tui")]
    if cli.interactive || cli.command.is_none() {
        run_tui(cli.command.map(|c| c.into()))?;
        return Ok(());
    }

    run_cli(cli)?;
    Ok(())
}
