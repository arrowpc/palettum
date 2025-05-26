use clap::Parser;
use cli::cli::args::Cli;

use cli::{cli::runner::run_cli, logger};
use indicatif::MultiProgress;
use palettum::error::Result;
use std::{env, process};

#[cfg(feature = "profiler")]
use cli::profiler;

fn main() -> Result<()> {
    let args = Cli::parse();

    if args.verbose == 1 {
        unsafe { env::set_var("RUST_LOG", "debug") };
    } else if args.verbose > 1 {
        unsafe { env::set_var("RUST_LOG", "trace") };
    } else if env::var_os("RUST_LOG").is_none() {
        unsafe { env::set_var("RUST_LOG", "info") };
    }

    let multi = MultiProgress::new();
    let level = logger::init(multi.clone())?;
    log::set_max_level(level);

    let mut _profiler_guard = None;
    #[cfg(feature = "profiler")]
    {
        _profiler_guard = profiler::start_profiling();
    }
    #[cfg(not(feature = "profiler"))]
    {
        _profiler_guard = Some(());
    }

    let exit_code = match run_cli(args, multi) {
        Ok(()) => 0,
        Err(e) => {
            log::error!("{}", e);
            1
        }
    };

    #[cfg(feature = "profiler")]
    {
        profiler::finish_profiling(_profiler_guard)?;
    }

    process::exit(exit_code);
}
