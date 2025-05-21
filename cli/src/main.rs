use clap::Parser;
use cli::cli::args::Cli;

use cli::{cli::runner::run_cli, logger};
use palettum::error::Result;
use std::{env, process};
use tracing::error;

fn main() -> Result<()> {
    let args = Cli::parse();

    if env::var_os("RUST_LOG").is_none() {
        let log_level = match args.verbose {
            0 => "warn",
            1 => "info",
            2 => "debug",
            _ => "trace",
        };
        env::set_var("RUST_LOG", log_level);
    }
    logger::init()?;

    let exit_code = match run_cli(args) {
        Ok(()) => 0,
        Err(e) => {
            error!("{}", e);
            1
        }
    };

    process::exit(exit_code);
}
