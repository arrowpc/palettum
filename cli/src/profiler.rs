#![cfg(all(feature = "profiler", not(windows)))]
use anyhow::Result;

pub fn start_profiling() -> Option<pprof::ProfilerGuard<'static>> {
    match pprof::ProfilerGuardBuilder::default()
        .frequency(1000)
        .blocklist(&["libc", "libgcc", "pthread", "vdso"])
        .build()
    {
        Ok(guard) => Some(guard),
        Err(e) => {
            log::error!("failed to build profiler guard: {e}");
            None
        }
    }
}

pub fn finish_profiling(profiler_guard: Option<pprof::ProfilerGuard>) -> Result<()> {
    match profiler_guard
        .expect("failed to retrieve profiler guard")
        .report()
        .build()
    {
        Ok(report) => {
            #[cfg(feature = "profiler-flamegraph")]
            {
                use chrono::Local;
                use std::fs::File;

                let now = Local::now();
                let datetime = now.format("%Y-%m-%d_%H-%M-%S");
                let file = File::create(format!(
                    "{}_{}.flamegraph.svg",
                    env!("CARGO_PKG_NAME"),
                    datetime
                ))?;
                if let Err(e) = report.flamegraph(file) {
                    log::error!("failed to create flamegraph file: {e}");
                }
            }

            #[cfg(not(feature = "profiler-flamegraph"))]
            {
                log::info!("profiling report: {:?}", &report);
            }
        }
        Err(e) => {
            log::error!("failed to build profiler report: {e}");
        }
    }

    Ok(())
}
