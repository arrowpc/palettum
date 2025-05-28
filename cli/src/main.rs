use anyhow::Result;
use clap::Parser;
use cli::cli::args::Cli;
use cli::{cli::runner::run_cli, logger};
use indicatif::MultiProgress;
use std::{env, process};

#[cfg(all(feature = "profiler", not(windows)))]
mod profiler;
#[cfg(all(feature = "profiler", not(windows)))]
use pprof::ProfilerGuard;
#[cfg(all(feature = "profiler", not(windows)))]
type MyProfilerGuard<'a> = ProfilerGuard<'a>;

#[cfg(not(all(feature = "profiler", not(windows))))]
type MyProfilerGuard<'a> = ();

fn main() -> Result<()> {
    let args = Cli::parse();

    if args.verbose == 1 {
        env::set_var("RUST_LOG", "debug");
    } else if args.verbose > 1 {
        env::set_var("RUST_LOG", "trace");
    } else if env::var_os("RUST_LOG").is_none() {
        env::set_var("RUST_LOG", "info");
    }

    let multi = MultiProgress::new();
    let level = logger::init(multi.clone())?;
    log::set_max_level(level);

    let mut _profiler_guard: Option<MyProfilerGuard<'_>> = None;

    #[cfg(all(feature = "profiler", not(windows)))]
    {
        // Adjust this path if your profiler module is elsewhere!
        _profiler_guard = profiler::start_profiling();
    }

    let exit_code = match run_cli(args, multi) {
        Ok(()) => 0,
        Err(e) => {
            log::error!("{:?}", e);
            1
        }
    };

    #[cfg(all(feature = "profiler", not(windows)))]
    {
        profiler::finish_profiling(_profiler_guard)?;
    }

    process::exit(exit_code);
}
