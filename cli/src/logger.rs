use crate::style;
use anyhow::{Context, Result};
use console::Style;
use env_logger::Builder;
use indicatif::MultiProgress;
use indicatif_log_bridge::LogWrapper;
use log::{Level, LevelFilter};
use std::env;
use std::io::Write;

const LOGGER_ENV: &str = "RUST_LOG";

// TODO: Fix flickering on high volume of logs
pub fn init(multi: MultiProgress) -> Result<LevelFilter> {
    #[cfg(feature = "video")]
    {
        use palettum::ffmpeg_next::log::set_level;
        set_level(palettum::ffmpeg_next::log::Level::Error);
    }

    let mut builder = Builder::new();

    builder.format(|buf, record| {
        let level = record.level();
        let target = record.target();
        let message = record.args();
        let s = style::theme();

        let (level_text, style) = match level {
            Level::Error => ("ERROR ", &s.error),
            Level::Warn => ("WARN ", &s.warning),
            Level::Info => ("", &s.info),
            Level::Debug => ("DEBUG ", &Style::new().dim()),
            Level::Trace => ("TRACE ", &Style::new().white().dim()),
        };

        let styled_level = style.apply_to(level_text);

        if level == Level::Info {
            writeln!(buf, "{}{}", styled_level, message)
        } else {
            writeln!(buf, "{}[{}] {}", styled_level, target, message)
        }
    });

    if let Ok(rust_log_env_var) = env::var(LOGGER_ENV) {
        builder.parse_filters(&rust_log_env_var);
    } else {
        builder.filter_level(LevelFilter::Info);
    }

    let logger = builder.build();
    let level = logger.filter();

    LogWrapper::new(multi.clone(), logger)
        .try_init()
        .context("Failed to initialize logger")?;

    Ok(level)
}
