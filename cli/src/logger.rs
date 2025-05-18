use crate::style;
use console::Style;
use env_logger::Builder;
use log::Level;
use palettum::error::{Error, Result};
use std::env;
use std::io::Write;

const LOGGER_ENV: &str = "RUST_LOG";

pub fn init() -> Result<()> {
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
        builder.filter_level(log::LevelFilter::Info);
    }

    builder
        .try_init()
        .map_err(|e| Error::LoggerError(e.to_string()))
}
