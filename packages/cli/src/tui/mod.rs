use crate::Command;
use anyhow::Result;
use ratatui::crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io;

pub mod app;
pub mod event;
pub mod ui;

use app::App;

pub fn run_tui(initial_command: Option<Command>) -> Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    let mut app = App::new(initial_command)?;
    let event_handler = event::EventHandler::new(250);

    while app.running {
        terminal.draw(|f| ui::render(f, &mut app))?;
        match event_handler.next()? {
            event::Event::Tick => app.on_tick(),
            event::Event::Key(key_event) => app.handle_key_event(key_event)?,
            event::Event::Mouse(mouse_event) => app.handle_mouse_event(mouse_event),
            event::Event::Resize(w, h) => app.handle_resize(w, h),
        }
        app.handle_command_results()?;
    }

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;
    Ok(())
}
