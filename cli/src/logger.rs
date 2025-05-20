use crate::style;
use palettum::error::{Error, Result};
use tracing::{field::Field, Event};
use tracing::{Level, Subscriber};
use tracing_indicatif::IndicatifLayer;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::{
    fmt::{self, format::Writer, FmtContext, FormatEvent, FormatFields},
    registry::LookupSpan,
    util::SubscriberInitExt,
    EnvFilter, FmtSubscriber,
};

struct LogTargetVisitor {
    log_target: Option<String>,
}

impl tracing::field::Visit for LogTargetVisitor {
    fn record_str(&mut self, field: &Field, value: &str) {
        if field.name() == "log.target" {
            self.log_target = Some(value.to_owned());
        }
    }
    fn record_debug(&mut self, _: &Field, _: &dyn std::fmt::Debug) {}
    fn record_bool(&mut self, _: &Field, _: bool) {}
    fn record_i64(&mut self, _: &Field, _: i64) {}
    fn record_u64(&mut self, _: &Field, _: u64) {}
    fn record_f64(&mut self, _: &Field, _: f64) {}
}

struct PalettumFormatter;

impl<S, N> FormatEvent<S, N> for PalettumFormatter
where
    S: Subscriber + for<'a> LookupSpan<'a>,
    N: for<'a> fmt::FormatFields<'a> + 'static,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &Event<'_>,
    ) -> std::fmt::Result {
        let metadata = event.metadata();
        let level = *metadata.level();
        let s = style::theme();

        let (level_text, style_ref) = match level {
            Level::ERROR => ("ERROR ", &s.error),
            Level::WARN => ("WARN  ", &s.warning),
            Level::INFO => ("", &s.info),
            Level::DEBUG => ("DEBUG ", &s.highlight),
            Level::TRACE => ("TRACE ", &s.info),
        };

        write!(writer, "{}", style_ref.apply_to(level_text))?;

        let mut visitor = LogTargetVisitor { log_target: None };
        event.record(&mut visitor);

        let target = visitor.log_target.as_deref().unwrap_or(metadata.target());

        if level != Level::INFO {
            write!(writer, "[{}] ", target)?;
        }

        ctx.format_fields(writer.by_ref(), event)?;
        writeln!(writer)
    }
}

pub fn init() -> Result<()> {
    let env_filter = EnvFilter::from_default_env();

    let indicatif_layer = IndicatifLayer::new();

    let fmt_subscriber = FmtSubscriber::builder()
        .with_span_events(tracing_subscriber::fmt::format::FmtSpan::FULL)
        .with_env_filter(env_filter)
        .event_format(PalettumFormatter)
        .fmt_fields(fmt::format::PrettyFields::new())
        .finish();

    let subscriber = fmt_subscriber.with(indicatif_layer);

    subscriber.try_init().map_err(|e| {
        Error::LoggerError(format!("Failed to initialize tracing subscriber: {}", e))
    })?;

    Ok(())
}
