use crate::{palettized::Dithering, Config, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

#[cfg(not(target_arch = "wasm32"))]
use async_once_cell::OnceCell;
#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;

pub struct GpuInstance {
    pub instance: wgpu::Instance,
    pub using_webgpu: bool,
}

impl GpuInstance {
    pub async fn new() -> Result<Self> {
        #[cfg(target_arch = "wasm32")]
        let using_webgpu = wgpu::util::is_browser_webgpu_supported().await;
        #[cfg(not(target_arch = "wasm32"))]
        let using_webgpu = false;

        #[cfg(target_arch = "wasm32")]
        let instance = if using_webgpu {
            wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::BROWSER_WEBGPU,
                ..Default::default()
            })
        } else {
            wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::GL,
                ..Default::default()
            })
        };

        #[cfg(not(target_arch = "wasm32"))]
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        Ok(Self {
            instance,
            using_webgpu,
        })
    }
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    static GPU_INSTANCE: RefCell<Option<Arc<GpuInstance>>> = RefCell::new(None);
}

#[cfg(not(target_arch = "wasm32"))]
static GPU_INSTANCE: OnceCell<Arc<GpuInstance>> = OnceCell::new();

pub async fn get_gpu_instance() -> Result<Arc<GpuInstance>> {
    #[cfg(target_arch = "wasm32")]
    {
        let mut result = None;
        GPU_INSTANCE.with(|cell| {
            if let Some(p_arc) = cell.borrow().as_ref() {
                result = Some(p_arc.clone());
            }
        });
        if result.is_some() {
            return Ok(result.unwrap());
        }
        match GpuInstance::new().await {
            Ok(context) => {
                let arc = Arc::new(context);
                GPU_INSTANCE.with(|cell| {
                    *cell.borrow_mut() = Some(arc.clone());
                });
                Ok(arc)
            }
            Err(e) => {
                log::error!("Failed to initialize GPU context: {:?}", e);
                Err(e)
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let result = GPU_INSTANCE
            .get_or_try_init(async {
                match GpuInstance::new().await {
                    Ok(context) => {
                        let arc = Arc::new(context);
                        log::debug!("GPU Context initialized and cached");
                        Ok(arc)
                    }
                    Err(e) => {
                        log::warn!(
                            "Failed to initialize GPU Context: {:?}. Will fallback to CPU",
                            e
                        );
                        Err(e)
                    }
                }
            })
            .await;

        match result {
            Ok(arc) => Ok(arc.clone()),
            Err(e) => Err(e),
        }
    }
}

const MAX_PALETTE_SIZE: usize = 256;

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GpuRgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[repr(C)]
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GpuConfig {
    pub transparency_threshold: u32,
    pub diff_formula: u32,
    pub smooth_formula: u32,
    pub palette_size: u32,
    pub palette: [u32; MAX_PALETTE_SIZE],
    pub smooth_strength: f32,
    pub dither_algorithm: u32,
    pub dither_strength: f32,
    pub image_width: u32,
    pub image_height: u32,
    pub _padding1: u32,
    pub _padding2: u32,
    pub _padding3: u32,
}

impl GpuConfig {
    pub fn from_config(config: &Config, processing_width: u32, processing_height: u32) -> Self {
        let mut palette = [0u32; MAX_PALETTE_SIZE];
        for (i, rgb_color) in config.palette.colors.iter().enumerate() {
            if i >= MAX_PALETTE_SIZE {
                break;
            }
            let r = rgb_color.0[0] as u32;
            let g = rgb_color.0[1] as u32;
            let b = rgb_color.0[2] as u32;
            let a = 255u32;
            palette[i] = r | (g << 8) | (b << 16) | (a << 24);
        }

        Self {
            transparency_threshold: config.transparency_threshold as u32,
            diff_formula: match config.diff_formula {
                crate::color_difference::Formula::CIE76 => 0,
                crate::color_difference::Formula::CIE94 => 1,
                crate::color_difference::Formula::CIEDE2000 => 2,
            },
            smooth_formula: match config.smooth_formula {
                crate::smoothed::Formula::Idw => 0,
                crate::smoothed::Formula::Gaussian => 1,
                crate::smoothed::Formula::Rq => 2,
            },
            palette_size: config.palette.colors.len() as u32,
            palette,
            smooth_strength: config.smooth_strength,
            dither_algorithm: match config.dither_algorithm {
                Dithering::None => 0,
                Dithering::Fs => 1,
                Dithering::Bn => 2,
            },
            dither_strength: config.dither_strength,
            image_width: processing_width,
            image_height: processing_height,
            _padding1: 0,
            _padding2: 0,
            _padding3: 0,
        }
    }
}

pub fn preprocess(files: &HashMap<PathBuf, String>, current_file: &str) -> Result<String> {
    let mut content = files
        .get(&PathBuf::from(current_file))
        .ok_or_else(|| format!("File not found: {}", current_file))
        .unwrap()
        .clone();

    while content.contains("#include") {
        let mut new_content = String::new();
        for line in content.lines() {
            if let Some(include_path) = line.strip_prefix("#include ") {
                let include_path = include_path.trim().trim_matches('"');
                let included = files
                    .get(&PathBuf::from(include_path))
                    .ok_or_else(|| format!("Included file not found: {}", include_path))
                    .unwrap();
                new_content.push_str(included);
                new_content.push('\n');
            } else {
                new_content.push_str(line);
                new_content.push('\n');
            }
        }
        content = new_content;
    }
    Ok(content)
}
