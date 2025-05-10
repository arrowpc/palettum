use crate::{
    execute_command, find_palette, list_available_palettes, Command, CommandResult, Palette,
};
use anyhow::Result;
use image::Rgb;
use palettum::{DeltaEMethod, Mapping, SmoothingStyle};
use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyEventKind};
use ratatui::widgets::ListState;
use ratatui_explorer::{FileExplorer, Input as ExplorerInput, Theme as ExplorerTheme};
use ratatui_image::picker::Picker;
use ratatui_image::thread::{ResizeRequest, ResizeResponse, ThreadProtocol};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Focus {
    PaletteList,
    LogView,
    FileSelector,
    Help,
}

#[derive(Debug, Clone)]
pub enum LogLevel {
    Info,
    Warning,
    Error,
    Success,
    Debug,
}

#[derive(Debug, Clone)]
pub struct LogEntry {
    pub timestamp: Instant,
    pub level: LogLevel,
    pub message: String,
}

pub struct StatefulList<T> {
    pub state: ListState,
    pub items: Vec<T>,
}

impl<T> StatefulList<T> {
    pub fn with_items(items: Vec<T>) -> Self {
        let mut state = ListState::default();
        if !items.is_empty() {
            state.select(Some(0));
        }
        Self { state, items }
    }

    pub fn next(&mut self) {
        if self.items.is_empty() {
            return;
        }
        let i = self
            .state
            .selected()
            .map_or(0, |i| (i + 1) % self.items.len());
        self.state.select(Some(i));
    }

    pub fn previous(&mut self) {
        if self.items.is_empty() {
            return;
        }
        let i = self
            .state
            .selected()
            .map_or(0, |i| if i == 0 { self.items.len() - 1 } else { i - 1 });
        self.state.select(Some(i));
    }

    pub fn selected_item(&self) -> Option<&T> {
        self.state.selected().and_then(|i| self.items.get(i))
    }
}

#[derive(Debug)]
pub enum Target {
    Input,
    Output,
}

pub struct TargetedResizeResponse {
    pub response: ResizeResponse,
    pub target: Target,
}

pub struct App {
    pub running: bool,
    pub show_help: bool,
    pub focused_pane: Focus,
    pub palettes: StatefulList<Palette>,
    pub selected_palette_colors: Option<Vec<Rgb<u8>>>,
    pub logs: Vec<LogEntry>,
    pub max_logs: usize,
    pub is_processing: bool,
    pub progress: Option<f32>,
    pub current_task: String,
    pub input_protocol: Option<ThreadProtocol>,
    pub output_protocol: Option<ThreadProtocol>,
    pub image_picker: Option<Picker>,
    pub tx_worker_input: Sender<ResizeRequest>,
    pub rx_main_input: Receiver<ResizeResponse>,
    pub tx_worker_output: Sender<ResizeRequest>,
    pub rx_main_output: Receiver<ResizeResponse>,
    pub last_input_path: Option<PathBuf>,
    pub last_output_path: Option<PathBuf>,
    pub file_explorer: Option<FileExplorer>,
    pub last_processed_time: Option<Duration>,
    command_sender: Sender<CommandResult>,
    command_receiver: Receiver<CommandResult>,
    initial_command: Option<Command>,
}

impl App {
    pub fn new(initial_command: Option<Command>) -> Result<Self> {
        let (sender, receiver) = mpsc::channel();
        let image_picker = match Picker::from_query_stdio() {
            Ok(picker) => Some(picker),
            Err(e) => {
                eprintln!("Failed to create image picker: {:?}", e);
                None
            }
        };

        let (tx_worker_input, rx_worker_input) = mpsc::channel::<ResizeRequest>();
        let (tx_main_input, rx_main_input) = mpsc::channel::<ResizeResponse>();

        let (tx_worker_output, rx_worker_output) = mpsc::channel::<ResizeRequest>();
        let (tx_main_output, rx_main_output) = mpsc::channel::<ResizeResponse>();

        thread::spawn(move || {
            while let Ok(request) = rx_worker_input.recv() {
                match request.resize_encode() {
                    Ok(response) => {
                        tx_main_input.send(response).unwrap();
                    }
                    Err(e) => {
                        eprintln!("input resize_encode failed: {:?}", e);
                    }
                }
            }
        });

        thread::spawn(move || {
            while let Ok(request) = rx_worker_output.recv() {
                match request.resize_encode() {
                    Ok(response) => {
                        tx_main_output.send(response).unwrap();
                    }
                    Err(e) => {
                        eprintln!("output resize_encode failed: {:?}", e);
                    }
                }
            }
        });
        let mut app = App {
            running: true,
            show_help: true,
            focused_pane: Focus::PaletteList,
            palettes: StatefulList::with_items(list_available_palettes()?),
            selected_palette_colors: None,
            logs: Vec::new(),
            max_logs: 100,
            is_processing: false,
            progress: None,
            current_task: "Ready".to_string(),
            input_protocol: None,
            output_protocol: None,
            image_picker,
            tx_worker_input,
            rx_main_input,
            tx_worker_output,
            rx_main_output,
            last_input_path: None,
            last_output_path: None,
            file_explorer: None,
            last_processed_time: None,
            command_sender: sender,
            command_receiver: receiver,
            initial_command,
        };
        app.log(LogLevel::Info, "Welcome to Palettum!".to_string());
        app.update_selected_palette_detail();
        if let Some(cmd) = app.initial_command.clone() {
            app.trigger_command(cmd);
        }
        Ok(app)
    }

    pub fn log(&mut self, level: LogLevel, message: String) {
        let entry = LogEntry {
            timestamp: Instant::now(),
            level,
            message,
        };
        if self.logs.len() >= self.max_logs {
            self.logs.remove(0);
        }
        self.logs.push(entry);
    }

    pub fn refresh_palettes(&mut self) -> Result<()> {
        let previous_selected = self.palettes.state.selected();
        self.palettes = StatefulList::with_items(list_available_palettes()?);
        if let Some(index) = previous_selected {
            if index < self.palettes.items.len() {
                self.palettes.state.select(Some(index));
            }
        }
        self.update_selected_palette_detail();
        Ok(())
    }

    fn update_selected_palette_detail(&mut self) {
        if let Some(selected) = self.palettes.selected_item() {
            if let Ok(palette) = find_palette(&selected.id) {
                self.selected_palette_colors = Some(palette.colors);
                self.log(
                    LogLevel::Info,
                    format!("Selected palette: {}", selected.name),
                );
            } else {
                self.log(
                    LogLevel::Warning,
                    format!("Could not load palette '{}'", selected.id),
                );
                self.selected_palette_colors = None;
            }
        } else {
            self.selected_palette_colors = None;
        }
    }

    fn trigger_command(&mut self, command: Command) {
        if self.is_processing {
            self.log(LogLevel::Warning, "Another process is running.".to_string());
            return;
        }
        self.is_processing = true;
        self.progress = Some(0.0);
        match &command {
            Command::Palettify(args) => {
                self.current_task = format!("Palettifying with {} palette", args.palette);
            }
            Command::SavePalette(args) => {
                self.current_task =
                    format!("Saving palette {}", args.id.as_deref().unwrap_or("unknown"));
            }
            Command::ListPalettes(_) => {
                self.current_task = "Refreshing palette list".to_string();
            }
        }
        let sender = self.command_sender.clone();
        thread::spawn(move || {
            let result = execute_command(command).unwrap();
            sender.send(result).unwrap();
        });
    }

    pub fn handle_command_results(&mut self) -> Result<()> {
        if let Ok(result) = self.command_receiver.try_recv() {
            self.is_processing = false;
            self.progress = None;
            match result {
                CommandResult::PalettifySuccess {
                    input_path,
                    output_path,
                    duration,
                } => {
                    self.current_task = "Ready".to_string();
                    self.last_processed_time = Some(duration);
                    self.log(
                        LogLevel::Success,
                        format!("✨ Palettify completed in {:?}", duration),
                    );
                    self.log(
                        LogLevel::Info,
                        format!("Output saved to: {}", output_path.display()),
                    );
                    self.last_input_path = Some(input_path);
                    self.last_output_path = Some(output_path);
                    if let Some(output_path) = &self.last_output_path {
                        if let Ok(img) = image::open(output_path) {
                            if let Some(picker) = &self.image_picker {
                                self.output_protocol = Some(ThreadProtocol::new(
                                    self.tx_worker_output.clone(),
                                    Some(picker.new_resize_protocol(img)),
                                ));
                            } else {
                                self.log(
                                    LogLevel::Error,
                                    "Image picker not initialized.".to_string(),
                                );
                                self.output_protocol = None;
                            }
                        } else {
                            self.log(
                                LogLevel::Error,
                                format!("Failed to open output image {}", output_path.display()),
                            );
                            self.output_protocol = None;
                        }
                    } else {
                        self.output_protocol = None;
                    }
                }

                CommandResult::ListPalettesSuccess(_) => {
                    self.current_task = "Ready".to_string();
                    self.refresh_palettes()?;
                }
                CommandResult::SavePaletteSuccess { id, path } => {
                    self.current_task = "Ready".to_string();
                    self.log(
                        LogLevel::Success,
                        format!("Palette '{}' saved successfully", id),
                    );
                    self.log(LogLevel::Info, format!("Source: {}", path.display()));
                    self.refresh_palettes()?;
                }
                CommandResult::Error(e) => {
                    self.current_task = "Error occurred".to_string();
                    self.log(LogLevel::Error, format!("Command failed: {}", e));
                }
            }
        }
        Ok(())
    }

    pub fn on_tick(&mut self) {
        if self.is_processing {
            let current = self.progress.unwrap_or(0.0);
            self.progress = Some((current + 0.01).min(0.99));
        }
    }

    pub fn handle_key_event(&mut self, key_event: KeyEvent) -> Result<()> {
        if self.show_help
            && self.focused_pane == Focus::Help
            && key_event.kind == KeyEventKind::Press
        {
            self.show_help = false;
            self.focused_pane = Focus::PaletteList;
            return Ok(());
        }

        if self.focused_pane == Focus::FileSelector {
            if let Some(ref mut explorer) = self.file_explorer {
                let event = ratatui::crossterm::event::Event::Key(key_event);
                let explorer_input = ExplorerInput::from(&event);
                explorer.handle(explorer_input)?;
                if key_event.kind == KeyEventKind::Press {
                    match key_event.code {
                        KeyCode::Enter => {
                            let selected_item = explorer.current();
                            if !selected_item.is_dir() {
                                let path = selected_item.path().clone();
                                self.last_input_path = Some(path.clone());
                                self.log(
                                    LogLevel::Info,
                                    format!("Selected file: {}", path.display()),
                                );
                                match image::open(&path) {
                                    Ok(img) => {
                                        if let Some(picker) = &self.image_picker {
                                            self.input_protocol = Some(ThreadProtocol::new(
                                                self.tx_worker_input.clone(),
                                                Some(picker.new_resize_protocol(img)),
                                            ));
                                            self.log(
                                                LogLevel::Success,
                                                format!("✓ Loaded image: {}", path.display()),
                                            );
                                            // Clear output preview when a new input is loaded
                                            self.last_output_path = None;
                                            self.output_protocol = None;
                                        } else {
                                            self.log(
                                                LogLevel::Error,
                                                "Image picker not initialized.".to_string(),
                                            );
                                            self.input_protocol = None;
                                        }
                                    }

                                    Err(e) => {
                                        self.log(
                                            LogLevel::Error,
                                            format!(
                                                "Failed to open image {}: {}",
                                                path.display(),
                                                e
                                            ),
                                        );
                                        self.input_protocol = None;
                                    }
                                }
                                self.file_explorer = None;
                                self.focused_pane = Focus::PaletteList;
                            }
                        }
                        KeyCode::Esc => {
                            self.file_explorer = None;
                            self.focused_pane = Focus::PaletteList;
                        }
                        _ => {}
                    }
                }
                return Ok(());
            }
        }

        if key_event.kind == KeyEventKind::Press {
            match key_event.code {
                KeyCode::Char('q') => self.running = false,
                KeyCode::Char('?') => {
                    self.show_help = !self.show_help;
                    self.focused_pane = if self.show_help {
                        Focus::Help
                    } else {
                        Focus::PaletteList
                    };
                }
                KeyCode::Char('f') => {
                    if self.file_explorer.is_none() {
                        let theme = ExplorerTheme::default().add_default_title();
                        match FileExplorer::with_theme(theme) {
                            Ok(explorer) => {
                                self.file_explorer = Some(explorer);
                                self.focused_pane = Focus::FileSelector;
                                self.log(LogLevel::Info, "Select an image file...".to_string());
                            }
                            Err(e) => {
                                self.log(
                                    LogLevel::Error,
                                    format!("Failed to open file explorer: {}", e),
                                );
                            }
                        }
                    }
                }
                KeyCode::Char('p') => {
                    if let Some(input) = self.last_input_path.clone() {
                        if let Some(palette) = self.palettes.selected_item().cloned() {
                            self.log(
                                LogLevel::Info,
                                format!("Palettifying with {} palette...", palette.name),
                            );
                            let args = crate::PalettifyArgs {
                                input_path: input,
                                output: None,
                                palette: palette.id,
                                mapping: Mapping::Palettized,
                                delta_e: DeltaEMethod::CIEDE2000,
                                quant_level: 2,
                                alpha_threshold: 128,
                                threads: 4,
                                smoothing_style: SmoothingStyle::IDW,
                                smoothing_strength: 0.5,
                                lab_scales: [1.0, 1.0, 1.0],
                                width: None,
                                height: None,
                                scale: None,
                                resize_filter: image::imageops::FilterType::Lanczos3,
                                silent: false,
                            };
                            self.trigger_command(Command::Palettify(args));
                        } else {
                            self.log(LogLevel::Warning, "No palette selected.".to_string());
                        }
                    } else {
                        self.log(
                            LogLevel::Warning,
                            "No input file selected. Press 'f' to select an image.".to_string(),
                        );
                    }
                }
                KeyCode::Tab => {
                    self.focused_pane = match self.focused_pane {
                        Focus::PaletteList => Focus::LogView,
                        Focus::LogView => Focus::PaletteList,
                        _ => Focus::PaletteList,
                    };
                }
                KeyCode::Up => {
                    if self.focused_pane == Focus::PaletteList {
                        self.palettes.previous();
                        self.update_selected_palette_detail();
                    }
                }
                KeyCode::Down => {
                    if self.focused_pane == Focus::PaletteList {
                        self.palettes.next();
                        self.update_selected_palette_detail();
                    }
                }
                KeyCode::Esc => {
                    self.show_help = false;
                    self.focused_pane = Focus::PaletteList;
                }
                _ => {}
            }
        }
        Ok(())
    }

    pub fn handle_resize(&mut self, width: u16, height: u16) {
        self.log(LogLevel::Debug, format!("Resized to {}x{}", width, height));
    }
}
