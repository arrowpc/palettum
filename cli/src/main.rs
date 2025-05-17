use clap::Parser;
use cli::cli::args::Cli;

#[cfg(feature = "tui")]
use {console::style, palettum_cli::tui::run_tui};

use cli::cli::runner::run_cli;
use cli::logger;
use palettum::error::Result;

fn main() -> Result<()> {
    if let Err(e) = logger::init() {
        eprintln!("Failed to initialize logger: {}", e);
    }

    let cli = Cli::parse();

    if let Err(e) = run_cli(cli) {
        log::error!("{}", e);
        std::process::exit(1);
    }

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

    Ok(())
}
