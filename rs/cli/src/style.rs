// Kind of a useless file rn
use anstyle::{AnsiColor, Style as Anstyle};
use clap::builder::Styles as ClapStyles;

pub fn get_clap_styles() -> ClapStyles {
    ClapStyles::plain()
        .header(
            Anstyle::new()
                .fg_color(Some(AnsiColor::Cyan.into()))
                .bold()
                .underline(),
        )
        .usage(Anstyle::new().fg_color(Some(AnsiColor::Yellow.into())))
        .literal(Anstyle::new().fg_color(Some(AnsiColor::Green.into())))
        .placeholder(Anstyle::new().fg_color(Some(AnsiColor::Blue.into())))
        .valid(Anstyle::new().fg_color(Some(AnsiColor::Green.into())))
        .invalid(Anstyle::new().fg_color(Some(AnsiColor::Red.into())))
}

pub fn classic_header() -> console::Style {
    console::Style::new().cyan().bold()
}

pub fn classic_accent() -> console::Style {
    console::Style::new().yellow().bold()
}

pub fn classic_success() -> console::Style {
    console::Style::new().green().bold()
}

pub fn classic_error() -> console::Style {
    console::Style::new().red().bold()
}

pub fn classic_info() -> console::Style {
    console::Style::new().blue()
}

pub fn classic_dim() -> console::Style {
    console::Style::new().dim()
}

pub fn classic_bold() -> console::Style {
    console::Style::new().bold()
}

#[cfg(feature = "tui")]
pub mod tui {
    use ratatui::style::{Color, Style};

    pub fn base_style() -> Style {
        Style::default()
    }

    pub fn header_style() -> Style {
        Style::default().fg(Color::Cyan)
    }

    pub fn accent_style() -> Style {
        Style::default().fg(Color::Yellow)
    }

    pub fn success_style() -> Style {
        Style::default().fg(Color::Green)
    }

    pub fn error_style() -> Style {
        Style::default().fg(Color::Red)
    }

    pub fn info_style() -> Style {
        Style::default().fg(Color::Blue)
    }

    pub fn dim_style() -> Style {
        Style::default().fg(Color::Gray)
    }

    pub fn selected_style() -> Style {
        Style::default().fg(Color::White).bg(Color::Blue)
    }

    pub fn border_style() -> Style {
        Style::default().fg(Color::DarkGray)
    }

    pub fn focused_border_style() -> Style {
        Style::default().fg(Color::Cyan)
    }

    pub fn palette_color_style(r: u8, g: u8, b: u8) -> Style {
        Style::default().fg(Color::Rgb(r, g, b))
    }

    pub fn progress_style() -> Style {
        Style::default().fg(Color::Blue)
    }
}
