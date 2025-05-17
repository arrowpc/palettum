use tabled::{grid::records::vec_records::Cell, Table};
use terminal_size::{terminal_size, Width as TermWidth};

use anstyle::Ansi256Color;
use clap::builder::{styling::Style as ClapStyle, Styles};
use console::{Color, Style};
use once_cell::sync::Lazy;

// ANSI 256-color constants
const DARK_BLUE: anstyle::Ansi256Color = anstyle::Ansi256Color(24);
const _BROWNISH_ORANGE: anstyle::Ansi256Color = anstyle::Ansi256Color(130);
const WHITE: anstyle::Ansi256Color = anstyle::Ansi256Color(255);
const BRIGHT_WHITE: anstyle::Ansi256Color = anstyle::Ansi256Color(231);
const BRIGHT_GREEN: anstyle::Ansi256Color = anstyle::Ansi256Color(34);
const RED: anstyle::Ansi256Color = anstyle::Ansi256Color(160);
const YELLOW: anstyle::Ansi256Color = anstyle::Ansi256Color(220);
const LIGHT_BLUE: anstyle::Ansi256Color = anstyle::Ansi256Color(75);
const DARK_GRAY: anstyle::Ansi256Color = anstyle::Ansi256Color(240);
const FOREST_GREEN: anstyle::Ansi256Color = anstyle::Ansi256Color(65);
const MEDIUM_PURPLE4: anstyle::Ansi256Color = anstyle::Ansi256Color(60);
const DARK_RED: anstyle::Ansi256Color = anstyle::Ansi256Color(52);

// --- Removed ColorPalette struct and its impl Default ---

/// Converts an anstyle::Ansi256Color to console::Color for console::Style.
/// This helper function is still useful as console::Style uses console::Color.
fn to_console_color(color: anstyle::Ansi256Color) -> Color {
    Color::Color256(color.0)
}

/// Centralizes all styling definitions, combining raw colors and console/clap styles.
pub struct Theme {
    // Raw color definitions (the single source of truth for colors)
    pub raw_primary: Ansi256Color,
    pub raw_secondary: Ansi256Color,
    pub raw_accent: Ansi256Color,
    pub raw_neutral: Ansi256Color,
    pub raw_success: Ansi256Color,
    pub raw_error: Ansi256Color,
    pub raw_warning: Ansi256Color,
    pub raw_info: Ansi256Color,
    pub raw_subtle: Ansi256Color,
    pub raw_highlight: Ansi256Color,
    pub raw_invalid: Ansi256Color,

    // Console styles (derived from the raw colors)
    pub primary: Style,
    pub secondary: Style,
    pub placeholder: Style,
    pub literal: Style,
    pub emphasis: Style,
    pub success: Style,
    pub error: Style,
    pub warning: Style,
    pub info: Style,
    pub subtle: Style,
    pub highlight: Style,
    pub invalid: Style,
}

impl Default for Theme {
    fn default() -> Self {
        // Define the raw colors using constants - THIS IS THE SINGLE PLACE
        let raw_primary = DARK_BLUE;
        let raw_secondary = FOREST_GREEN;
        let raw_accent = WHITE;
        let raw_neutral = BRIGHT_WHITE;
        let raw_success = BRIGHT_GREEN;
        let raw_error = RED;
        let raw_warning = YELLOW;
        let raw_info = LIGHT_BLUE;
        let raw_subtle = DARK_GRAY;
        let raw_highlight = MEDIUM_PURPLE4;
        let raw_invalid = DARK_RED;

        // Create console styles *from* the raw colors
        Self {
            primary: Style::new().fg(to_console_color(raw_primary)),
            secondary: Style::new().fg(to_console_color(raw_secondary)),
            placeholder: Style::new().fg(to_console_color(raw_secondary)).italic(),
            literal: Style::new().fg(to_console_color(raw_neutral)),
            emphasis: Style::new().fg(to_console_color(raw_accent)).bold(),
            success: Style::new().fg(to_console_color(raw_success)).bold(),
            error: Style::new().fg(to_console_color(raw_error)).bold(),
            warning: Style::new().fg(to_console_color(raw_warning)).bold(),
            info: Style::new().fg(to_console_color(raw_info)),
            subtle: Style::new().fg(to_console_color(raw_subtle)),
            highlight: Style::new().fg(to_console_color(raw_highlight)).bold(),
            invalid: Style::new().fg(to_console_color(raw_invalid)).bold(),

            // Store the raw colors themselves
            raw_primary,
            raw_secondary,
            raw_accent,
            raw_neutral,
            raw_success,
            raw_error,
            raw_warning,
            raw_info,
            raw_subtle,
            raw_highlight,
            raw_invalid,
        }
    }
}

/// Singleton access to the theme.
pub fn theme() -> &'static Theme {
    static THEME: Lazy<Theme> = Lazy::new(Theme::default);
    &THEME
}

/// Returns clap styles using the theme's raw colors.
pub fn clap_styles() -> Styles {
    let theme = theme(); // Get the theme singleton

    // Use the raw color fields from the theme
    Styles::plain()
        // anstyle::Ansi256Color implicitly converts to anstyle::Color for fg_color
        .header(
            ClapStyle::new()
                .fg_color(Some(theme.raw_primary.into()))
                .bold(),
        )
        .usage(
            ClapStyle::new()
                .fg_color(Some(theme.raw_accent.into()))
                .bold(),
        )
        .literal(ClapStyle::new().fg_color(Some(theme.raw_neutral.into())))
        .placeholder(
            ClapStyle::new()
                .fg_color(Some(theme.raw_secondary.into()))
                .italic(),
        )
        .error(
            ClapStyle::new()
                .fg_color(Some(theme.raw_error.into()))
                .bold(),
        )
        .invalid(
            ClapStyle::new()
                .fg_color(Some(theme.raw_invalid.into()))
                .bold(),
        )
        .valid(
            ClapStyle::new()
                .fg_color(Some(theme.raw_highlight.into()))
                .bold(),
        )
}

// GOHERE

// ===== TABLE FORMATTING =====
pub trait FitToTerminal {
    fn fit_to_terminal(self, max_width: Option<usize>, expand: bool) -> Self;
}

impl FitToTerminal for Table {
    // Tried my best to follow in the footsteps of the greats
    // https://github.com/Textualize/rich/blob/master/rich/table.py
    fn fit_to_terminal(self, max_width: Option<usize>, expand: bool) -> Self {
        use tabled::grid::records::Records;
        use tabled::settings::object::Columns;
        use tabled::settings::{Modify, Width};

        let term_w = terminal_size()
            .map(|(TermWidth(w), _)| w as usize)
            .unwrap_or(80);
        let maxw = max_width.unwrap_or(term_w).min(term_w);

        let records = self.get_records();

        let mut cols = 0;
        let mut wids = Vec::new();

        // Compute max width for each column
        for row in records.iter_rows() {
            if cols == 0 {
                cols = row.clone().len();
                wids.resize(cols, 0);
            }
            for (i, cell) in row.iter().enumerate() {
                let max_line_width = (0..cell.count_lines())
                    .map(|i| cell.line_width(i))
                    .max()
                    .unwrap_or(0);
                wids[i] = wids[i].max(max_line_width);
            }
        }

        let padding = 2;
        let border = 1;
        let sep = if cols > 0 { cols - 1 } else { 0 };
        let border_right = 1;
        let extra = border + sep + border_right + padding * cols;
        // Add padding to each column width
        for w in &mut wids {
            *w += padding;
        }

        let mut total = wids.iter().sum::<usize>() + extra;

        // Shrink columns if needed
        if total > maxw {
            let target = maxw.saturating_sub(extra);
            let thresh = target / cols / 2;
            let sum_wrap: usize = wids.iter().filter(|&&w| w > thresh).sum();

            if sum_wrap > 0 {
                let excess = wids.iter().sum::<usize>().saturating_sub(target);
                let ratio = ((sum_wrap.saturating_sub(excess)) as f64 / sum_wrap as f64).max(0.0);
                for w in &mut wids {
                    if *w > thresh {
                        *w = (*w as f64 * ratio).floor() as usize;
                    }
                }
            }

            total = wids.iter().sum::<usize>() + extra;

            if total > maxw {
                let mut rem = total - maxw;
                let dec = rem / cols;
                for w in &mut wids {
                    *w = w.saturating_sub(dec);
                }
                rem -= dec * cols;
                for wid in wids.iter_mut().take(rem) {
                    *wid = wid.saturating_sub(1);
                }
            }
        }

        // Expand columns if needed
        if expand {
            total = wids.iter().sum::<usize>() + extra;
            if total < maxw {
                let mut rem = maxw - total;
                let inc = rem / cols;
                for w in &mut wids {
                    *w += inc;
                }
                rem -= inc * cols;
                for wid in wids.iter_mut().take(rem) {
                    *wid += 1;
                }
            }
        }

        let mut table = self;
        for (i, width) in wids.into_iter().enumerate() {
            table.with(Modify::new(Columns::single(i)).with(Width::truncate(width)));
        }
        table
    }
}

// ===== PROGRESS BAR STYLES =====
pub fn create_main_progress_style(bar_width: usize) -> indicatif::ProgressStyle {
    indicatif::ProgressStyle::with_template(&format!(
        "{{prefix:.bold}} {{elapsed_precise}} \
         {{bar:{bar_width}.green/yellow}} {{pos}}/{{len}} \
         files | {{percent}}% | {{per_sec}} files/s | ETA: {{eta}}",
        bar_width = bar_width
    ))
    .unwrap()
    .progress_chars("█▓▒░")
}

pub fn create_job_progress_style(bar_width: usize) -> indicatif::ProgressStyle {
    indicatif::ProgressStyle::with_template(&format!(
        "{{prefix:.bold}} {{bar:{bar_width}.cyan/blue}} \
         {{pos}}/{{len}} | {{percent}}% | {{msg}}",
        bar_width = bar_width
    ))
    .unwrap()
    .progress_chars("█▓▒░")
}
