use clap::Parser;
use cli::cli::args::Cli;

#[cfg(feature = "tui")]
use {console::style, palettum_cli::tui::run_tui};

use cli::{cli::runner::run_cli, logger};
use palettum::error::Result;
use std::{env, process};

fn main() -> Result<()> {
    let args = Cli::parse();

    if args.verbose == 1 {
        unsafe { env::set_var("RUST_LOG", "debug") };
    } else if args.verbose > 1 {
        unsafe { env::set_var("RUST_LOG", "trace") };
    } else if env::var_os("RUST_LOG").is_none() {
        unsafe { env::set_var("RUST_LOG", "info") };
    }
    logger::init()?;
    if let Err(e) = logger::init() {
        eprintln!("Failed to initialize logger: {}", e);
    }

    let exit_code = match run_cli(args) {
        Ok(()) => 0,
        Err(e) => {
            log::error!("{}", e);
            1
        }
    };

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

    process::exit(exit_code);
}
