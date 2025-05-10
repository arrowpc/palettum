use crate::{
    format_duration,
    style::tui::*,
    tui::app::{App, Focus, LogLevel},
    Palette, PaletteKind,
};
use image::Rgb as ImgRgb;
use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Gauge, List, ListItem, Paragraph},
    Frame,
};
use ratatui_image::thread::ThreadImage;

pub fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);
    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(vertical[1])[1]
}

pub fn render_logo(app: &App) -> Paragraph {
    let default_color = ImgRgb([0, 200, 200]);
    let binding = vec![default_color];
    let palette_colors = app.selected_palette_colors.as_ref().unwrap_or(&binding);
    let logo_text = "██████╗  █████╗ ██╗     ███████╗████████╗████████╗██╗   ██╗███╗   ███╗\n██╔══██╗██╔══██║██║     ██╔════╝╚══██╔══╝╚══██╔══╝██║   ██║████╗ ████║\n██████╔╝███████║██║     █████╗     ██║      ██║   ██║   ██║██╔████╔██║\n██╔═══╝ ██╔══██║██║     ██╔══╝     ██║      ██║   ██║   ██║██║╚██╔╝██║\n██║     ██║  ██║███████╗███████╗   ██║      ██║   ╚██████╔╝██║ ╚═╝ ██║\n╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝      ╚═╝    ╚═════╝ ╚═╝     ╚═╝\n";
    let lines: Vec<Line> = logo_text
        .lines()
        .enumerate()
        .map(|(i, line)| {
            let color = palette_colors
                .get(i % palette_colors.len())
                .unwrap_or(&default_color);
            Line::from(Span::styled(
                line,
                Style::default().fg(Color::Rgb(color.0[0], color.0[1], color.0[2])),
            ))
        })
        .collect();
    Paragraph::new(lines)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Palettum ")
                .style(Style::default().bg(Color::Black)),
        )
        .alignment(Alignment::Center)
}

pub fn render_palette_list(app: &mut App, rect: Rect, f: &mut Frame<'_>) {
    let items: Vec<ListItem> = app
        .palettes
        .items
        .iter()
        .map(|p| {
            let tag = if p.kind == PaletteKind::Custom {
                "[C]"
            } else {
                "[D]"
            };
            let line = Line::from(vec![
                Span::styled(
                    format!("{:<4}", tag),
                    Style::default()
                        .fg(if p.kind == PaletteKind::Custom {
                            Color::Yellow
                        } else {
                            Color::Gray
                        })
                        .add_modifier(Modifier::BOLD),
                ),
                Span::raw(format!("{:<20} ({} colors)", p.name, p.colors.len())),
            ]);
            ListItem::new(line)
        })
        .collect();
    let list_block = Block::default()
        .borders(Borders::ALL)
        .title(" Palettes ")
        .style(Style::default().bg(Color::Black))
        .border_style(if app.focused_pane == Focus::PaletteList {
            focused_border_style()
        } else {
            border_style()
        });
    let list = List::new(items)
        .block(list_block)
        .highlight_style(selected_style())
        .highlight_symbol("* ");
    f.render_stateful_widget(list, rect, &mut app.palettes.state);
}

pub fn render_palette_detail(
    palette_info: Option<&Palette>,
    colors: Option<&Vec<ImgRgb<u8>>>,
    rect: Rect,
    f: &mut Frame<'_>,
) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style())
        .title(" Palette Details ");
    if let (Some(info), Some(palette_colors)) = (palette_info, colors) {
        let detail_layout = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(1),
                Constraint::Length(1),
                Constraint::Length(1),
                Constraint::Length(1),
                Constraint::Min(1),
            ])
            .margin(1)
            .split(block.inner(rect));
        f.render_widget(
            Paragraph::new(Line::from(vec![
                Span::styled("Name: ", header_style()),
                Span::raw(&info.name),
            ])),
            detail_layout[0],
        );
        f.render_widget(
            Paragraph::new(Line::from(vec![
                Span::styled("ID:   ", header_style()),
                Span::raw(&info.id),
            ])),
            detail_layout[1],
        );
        f.render_widget(
            Paragraph::new(Line::from(vec![
                Span::styled("Type: ", header_style()),
                Span::raw(if info.kind == PaletteKind::Custom {
                    "Custom"
                } else {
                    "Default"
                }),
                Span::styled(" │ ", dim_style()),
                Span::styled("Colors: ", header_style()),
                Span::raw(format!("{}", info.colors.len())),
            ])),
            detail_layout[2],
        );
        f.render_widget(
            Paragraph::new(Line::from(vec![
                Span::styled("Source: ", header_style()),
                Span::raw(info.source.as_deref().unwrap_or("N/A")),
            ])),
            detail_layout[3],
        );
        let max_swatches = (detail_layout[4].width / 2).saturating_sub(1);
        let swatches: Vec<Span> = palette_colors
            .iter()
            .take(max_swatches as usize)
            .map(|ImgRgb([r, g, b])| Span::styled("██", palette_color_style(*r, *g, *b)))
            .collect();
        f.render_widget(Paragraph::new(Line::from(swatches)), detail_layout[4]);
    } else {
        f.render_widget(
            Paragraph::new("Select a palette")
                .alignment(Alignment::Center)
                .style(dim_style()),
            block.inner(rect),
        );
    }
    f.render_widget(block, rect);
}

pub fn render_log_view(app: &App, rect: Rect, f: &mut Frame<'_>) {
    let log_lines: Vec<ListItem> = app
        .logs
        .iter()
        .rev()
        .map(|entry| {
            let (style, prefix) = match entry.level {
                LogLevel::Info => (info_style(), "[i]"),
                LogLevel::Warning => (accent_style(), "[!]"),
                LogLevel::Error => (error_style(), "[X]"),
                LogLevel::Success => (success_style(), "[✓]"),
                LogLevel::Debug => (dim_style(), "[d]"),
            };
            ListItem::new(Line::from(vec![
                Span::styled(format!("[{:.1?}] ", entry.timestamp.elapsed()), dim_style()),
                Span::styled(prefix, style.add_modifier(Modifier::BOLD)),
                Span::raw(" "),
                Span::styled(&entry.message, style),
            ]))
        })
        .collect();
    let log_list = List::new(log_lines).block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(if app.focused_pane == Focus::LogView {
                focused_border_style()
            } else {
                border_style()
            })
            .title(" Log "),
    );
    f.render_widget(log_list, rect);
}

pub fn render_input_preview(app: &mut App, rect: Rect, f: &mut Frame<'_>) {
    let block = Block::default().borders(Borders::ALL).title(" Before ");
    let area = block.inner(rect);

    f.render_widget(block, rect);

    if let Some(protocol) = &mut app.input_protocol {
        let image = ThreadImage::default();
        f.render_stateful_widget(image, area, protocol);
    } else {
        f.render_widget(
            Paragraph::new("No image selected")
                .alignment(Alignment::Center)
                .style(dim_style()),
            area,
        );
    }
}

pub fn render_output_preview(app: &mut App, rect: Rect, f: &mut Frame<'_>) {
    let block = Block::default().borders(Borders::ALL).title(" After ");
    let area = block.inner(rect);

    f.render_widget(block, rect);

    if let Some(protocol) = &mut app.output_protocol {
        let image = ThreadImage::default();
        f.render_stateful_widget(image, area, protocol);
    } else {
        f.render_widget(
            Paragraph::new("No output image")
                .alignment(Alignment::Center)
                .style(dim_style()),
            area,
        );
    }
}

pub fn render_status_bar(app: &App, rect: Rect, f: &mut Frame<'_>) {
    let status_style = if app.is_processing {
        Style::default()
            .fg(Color::Blue)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::Green)
    };
    let status_text = if app.is_processing {
        format!("Processing: {}...", app.current_task)
    } else if let Some(time) = app.last_processed_time {
        format!("Ready - Last process took: {}", format_duration(time))
    } else {
        "Ready".to_string()
    };
    let progress = if app.is_processing {
        (app.progress.unwrap_or(0.0) * 100.0) as u16
    } else {
        0
    };
    let gauge = Gauge::default()
        .block(Block::default())
        .gauge_style(if app.is_processing {
            Style::default().fg(Color::Blue).bg(Color::DarkGray)
        } else {
            Style::default().fg(Color::White).bg(Color::DarkGray)
        })
        .percent(progress);
    let layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(70), Constraint::Percentage(30)])
        .split(rect);
    let para = Paragraph::new(status_text)
        .alignment(Alignment::Left)
        .style(status_style);
    f.render_widget(para, layout[0]);
    f.render_widget(gauge, layout[1]);
}

pub fn render_help_popup(_app: &App, f: &mut Frame<'_>) {
    let area = centered_rect(10, 10, f.area());
    f.render_widget(Clear, area);
    let help_text = vec![
        Line::from(vec![
            Span::styled("?", accent_style()),
            Span::raw(" - Toggle Help"),
        ]),
        // Line::from(vec![
        //     Span::styled("Tab", accent_style()),
        //     Span::raw(" - Cycle Focus"),
        // ]),
        Line::from(vec![
            Span::styled("j/k", accent_style()),
            Span::raw(" - Navigate Palettes"),
        ]),
        Line::from(vec![
            Span::styled("Esc", accent_style()),
            Span::raw(" - Back/Clear"),
        ]),
        Line::from(vec![
            Span::styled("q", accent_style()),
            Span::raw(" - Quit"),
        ]),
        Line::from(vec![
            Span::styled("f", accent_style()),
            Span::raw(" - Open File Selection"),
        ]),
        Line::from(vec![
            Span::styled("p", accent_style()),
            Span::raw(" - Palettify Current Image"),
        ]),
        Line::from(Span::raw("")),
        Line::from(vec![Span::styled("Workflow:", header_style())]),
        Line::from(Span::raw("1. Select a palette from the list (↑/↓)")),
        Line::from(Span::raw("2. Select an input image (press 'f')")),
        Line::from(Span::raw("3. Process the image (press 'p')")),
    ];
    let help = Paragraph::new(help_text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Help ")
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .style(Style::default().bg(Color::Black))
        .alignment(Alignment::Left);
    f.render_widget(help, area);
}

pub fn render_file_explorer(app: &App, f: &mut Frame<'_>) {
    if let Some(ref explorer) = app.file_explorer {
        let area = centered_rect(40, 40, f.area());
        f.render_widget(Clear, area);
        let explorer_widget = explorer.widget();
        f.render_widget_ref(explorer_widget, area);
    }
}

pub fn render(f: &mut Frame<'_>, app: &mut App) {
    let size = f.area();
    // Top: Logo
    let logo_area = Rect {
        x: size.x,
        y: size.y,
        width: size.width,
        height: 9,
    };
    f.render_widget(render_logo(app), logo_area);

    // Main area below logo
    let main_area = Rect {
        x: size.x,
        y: logo_area.y + logo_area.height,
        width: size.width,
        height: size.height.saturating_sub(logo_area.height),
    };
    // Split main area into left and right columns
    let main_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(20), Constraint::Percentage(80)])
        .split(main_area);

    // Left column: Split vertically into palette list and palette detail
    let left_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(20), Constraint::Percentage(80)])
        .split(main_layout[0]);

    // Right column: Split vertically into previews and log view
    let right_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(100), Constraint::Percentage(0)])
        .split(main_layout[1]);

    // Previews: Split horizontally into input and output
    let preview_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(right_layout[0]);

    // Render components
    render_palette_list(app, left_layout[1], f);
    let selected_info = app.palettes.selected_item().cloned();
    let selected_colors = app.selected_palette_colors.as_ref();
    render_palette_detail(selected_info.as_ref(), selected_colors, left_layout[0], f);
    render_input_preview(app, preview_layout[0], f);
    render_output_preview(app, preview_layout[1], f);

    // render_log_view(app, right_layout[1], f);

    // Status bar at the bottom
    // let status_bar_area = Layout::default()
    //     .direction(Direction::Vertical)
    //     .constraints([Constraint::Min(0), Constraint::Length(1)])
    //     .split(main_area)[1];
    // render_status_bar(app, status_bar_area, f);

    // Conditional popups
    if app.show_help {
        render_help_popup(app, f);
    }
    if app.focused_pane == Focus::FileSelector {
        render_file_explorer(app, f);
    }
}
