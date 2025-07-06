use crate::{config::Config, error::Result, palettized::Dithering, Mapping};
use std::{borrow::Cow, sync::Arc};
use wgpu::util::DeviceExt;

#[cfg(not(target_arch = "wasm32"))]
use async_once_cell::OnceCell;
#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;

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

#[cfg(target_arch = "wasm32")]
thread_local! {
    static GPU_PROCESSOR_INSTANCE: RefCell<Option<Arc<GpuImageProcessor>>> = RefCell::new(None);
}

#[cfg(not(target_arch = "wasm32"))]
static GPU_PROCESSOR_INSTANCE: OnceCell<Arc<GpuImageProcessor>> = OnceCell::new();

pub async fn get_gpu_processor() -> Result<Option<Arc<GpuImageProcessor>>> {
    #[cfg(target_arch = "wasm32")]
    {
        let mut result = None;
        GPU_PROCESSOR_INSTANCE.with(|cell| {
            if let Some(p_arc) = cell.borrow().as_ref() {
                result = Some(p_arc.clone());
            }
        });
        if result.is_some() {
            return Ok(result);
        }
        match GpuImageProcessor::new().await {
            Some(processor) => {
                let arc = Arc::new(processor);
                GPU_PROCESSOR_INSTANCE.with(|cell| {
                    *cell.borrow_mut() = Some(arc.clone());
                });
                Ok(Some(arc))
            }
            None => Ok(None),
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let result = GPU_PROCESSOR_INSTANCE
            .get_or_try_init(async {
                match GpuImageProcessor::new().await {
                    Some(processor) => {
                        let arc = Arc::new(processor);
                        log::debug!("GPU Image Processor initialized and cached");
                        Ok(arc)
                    }
                    None => {
                        log::warn!(
                            "Failed to initialize GPU Image Processor. Will fallback to CPU"
                        );
                        Err(())
                    }
                }
            })
            .await;

        match result {
            Ok(arc) => Ok(Some(arc.clone())),
            Err(_) => Ok(None),
        }
    }
}
pub struct GpuImageProcessor {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,

    palettized_pipeline: wgpu::ComputePipeline,
    smoothed_pipeline: wgpu::ComputePipeline,

    mapping_layout: wgpu::BindGroupLayout,
}

const WORKGROUP_SIZE_X: u32 = 16;
const WORKGROUP_SIZE_Y: u32 = 16;

impl GpuImageProcessor {
    pub async fn new() -> Option<Self> {
        let instance = wgpu::Instance::default();
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .ok()?;

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("Image Processing Device"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                memory_hints: wgpu::MemoryHints::default(),
                trace: wgpu::Trace::default(),
            })
            .await
            .ok()?;

        let mapping_layout = Self::create_bind_group_layout(&device);

        let palettized_pipeline = Self::create_palettized_pipeline(&device, &mapping_layout);
        let smoothed_pipeline = Self::create_smoothed_pipeline(&device, &mapping_layout);

        Some(Self {
            device,
            queue,
            palettized_pipeline,
            smoothed_pipeline,
            mapping_layout,
        })
    }

    pub async fn process_image(
        &self,
        image_data: &[u8],
        width: u32,
        height: u32,
        config: &Config,
    ) -> Result<Vec<u8>> {
        if width == 0 || height == 0 {
            return Ok(Vec::new());
        }

        let bytes_per_rgba_pixel = std::mem::size_of::<GpuRgba>() as u64;
        let bytes_per_row_for_rgba = width as u64 * bytes_per_rgba_pixel;

        if bytes_per_row_for_rgba == 0 && width > 0 {
            todo!("bytes_per_row_for_rgba is zero with non-zero width.");
        }

        let max_buffer_size = self.device.limits().max_buffer_size;
        let max_rows_per_chunk_based_on_total_size = if bytes_per_row_for_rgba > 0 {
            (max_buffer_size / bytes_per_row_for_rgba) as u32
        } else {
            height
        };

        let max_bindable_storage_buffer_size = self.device.limits().max_storage_buffer_binding_size;
        let max_rows_per_chunk_based_on_binding = if bytes_per_row_for_rgba > 0 {
            (max_bindable_storage_buffer_size as u64 / bytes_per_row_for_rgba) as u32
        } else {
            height
        };

        let max_rows_per_chunk =
            max_rows_per_chunk_based_on_total_size.min(max_rows_per_chunk_based_on_binding);

        if max_rows_per_chunk == 0 && height > 0 {
            todo!(
                "Cannot determine a valid chunk size (max_rows_per_chunk is 0 but height {} > 0). \
                 Image width ({}) might be too large. Max buffer size: {}, max binding size: {}",
                height,
                width,
                max_buffer_size,
                max_bindable_storage_buffer_size
            );
        }

        let mut all_results: Vec<u8> = Vec::with_capacity(image_data.len());

        let num_chunks = if height == 0 || max_rows_per_chunk == 0 {
            0
        } else {
            height.div_ceil(max_rows_per_chunk)
        };

        for chunk_index in 0..num_chunks {
            let current_row_start = chunk_index * max_rows_per_chunk;
            let current_chunk_height = (height - current_row_start).min(max_rows_per_chunk);

            if current_chunk_height == 0 {
                continue;
            }

            let chunk_rgba_data_start_index =
                (current_row_start * width * (bytes_per_rgba_pixel as u32)) as usize;
            let chunk_rgba_data_end_index = ((current_row_start + current_chunk_height)
                * width
                * (bytes_per_rgba_pixel as u32))
                as usize;
            let current_image_data_slice =
                &image_data[chunk_rgba_data_start_index..chunk_rgba_data_end_index];

            let rgba_chunk_buffer =
                self.device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some(&format!("RGBA Image Chunk Buffer {}", chunk_index)),
                        contents: current_image_data_slice,
                        usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
                    });

            let gpu_chunk_config = GpuConfig::from_config(config, width, current_chunk_height);
            let config_chunk_buffer =
                self.device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some(&format!("Config Chunk Buffer {}", chunk_index)),
                        contents: bytemuck::bytes_of(&gpu_chunk_config),
                        usage: wgpu::BufferUsages::UNIFORM,
                    });

            let result_chunk_buffer_size = current_image_data_slice.len() as u64;
            let result_chunk_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(&format!("Result RGBA Chunk Buffer {}", chunk_index)),
                size: result_chunk_buffer_size,
                usage: wgpu::BufferUsages::STORAGE
                    | wgpu::BufferUsages::COPY_SRC
                    | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });

            let mut encoder = self
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some(&format!("Image Proc. Commands Chunk {}", chunk_index)),
                });

            let general_bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some(&format!("General Bind Group Chunk {}", chunk_index)),
                layout: &self.mapping_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: rgba_chunk_buffer.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: config_chunk_buffer.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 2,
                        resource: result_chunk_buffer.as_entire_binding(),
                    },
                ],
            });

            match config.mapping {
                Mapping::Palettized => {
                    let mut compute_pass =
                        encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                            label: Some(&format!("Palettized Pass Chunk {}", chunk_index)),
                            timestamp_writes: None,
                        });
                    compute_pass.set_pipeline(&self.palettized_pipeline);
                    compute_pass.set_bind_group(0, &general_bind_group, &[]);

                    match config.dither_algorithm {
                        Dithering::Fs => {
                            compute_pass.dispatch_workgroups(1, 1, 1);
                        }
                        Dithering::Bn | Dithering::None => {
                            let dispatch_x =
                                gpu_chunk_config.image_width.div_ceil(WORKGROUP_SIZE_X);
                            let dispatch_y =
                                gpu_chunk_config.image_height.div_ceil(WORKGROUP_SIZE_Y);
                            compute_pass.dispatch_workgroups(dispatch_x, dispatch_y, 1);
                        }
                    }
                }
                Mapping::Smoothed => {
                    let mut compute_pass =
                        encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                            label: Some(&format!("Smoothed Pass Chunk {}", chunk_index)),
                            timestamp_writes: None,
                        });
                    compute_pass.set_pipeline(&self.smoothed_pipeline);
                    compute_pass.set_bind_group(0, &general_bind_group, &[]);

                    let dispatch_x = gpu_chunk_config.image_width.div_ceil(WORKGROUP_SIZE_X);
                    let dispatch_y = gpu_chunk_config.image_height.div_ceil(WORKGROUP_SIZE_Y);
                    compute_pass.dispatch_workgroups(dispatch_x, dispatch_y, 1);
                }
            }

            let staging_chunk_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(&format!("Staging Chunk Buffer {}", chunk_index)),
                size: result_chunk_buffer_size,
                usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });

            encoder.copy_buffer_to_buffer(
                &result_chunk_buffer,
                0,
                &staging_chunk_buffer,
                0,
                result_chunk_buffer_size,
            );

            self.queue.submit(std::iter::once(encoder.finish()));

            let buffer_slice = staging_chunk_buffer.slice(..);
            let (sender, receiver) = futures::channel::oneshot::channel();
            buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
                if sender.send(result).is_err() {
                    log::warn!("Receiver dropped before map_async result for staging buffer");
                }
            });

            self.device.poll(wgpu::MaintainBase::Wait).unwrap();

            match receiver.await {
                Ok(Ok(())) => {
                    let data = buffer_slice.get_mapped_range();
                    all_results.extend_from_slice(&data);
                    drop(data);
                    staging_chunk_buffer.unmap();
                }
                Ok(Err(e)) => {
                    todo!("Buffer mapping error for chunk {}: {:?}", chunk_index, e);
                }
                Err(e) => {
                    todo!("Channel receive error for chunk {}: {:?}", chunk_index, e);
                }
            }
        }

        Ok(all_results)
    }

    fn create_bind_group_layout(device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Mapping Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: wgpu::BufferSize::new(
                            std::mem::size_of::<GpuConfig>() as u64
                        ),
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        })
    }

    fn create_palettized_pipeline(
        device: &wgpu::Device,
        layout: &wgpu::BindGroupLayout,
    ) -> wgpu::ComputePipeline {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Palettized Mapping Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!(
                "shaders/palettized.wgsl"
            ))),
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Palettized Pipeline Layout"),
            bind_group_layouts: &[layout],
            push_constant_ranges: &[],
        });

        device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Palettized Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            cache: None,
            compilation_options: wgpu::PipelineCompilationOptions::default(),
        })
    }

    fn create_smoothed_pipeline(
        device: &wgpu::Device,
        layout: &wgpu::BindGroupLayout,
    ) -> wgpu::ComputePipeline {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Smoothed Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("shaders/smoothed.wgsl"))),
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Smoothed Pipeline Layout"),
            bind_group_layouts: &[layout],
            push_constant_ranges: &[],
        });

        device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Smoothed Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            cache: None,
            compilation_options: wgpu::PipelineCompilationOptions::default(),
        })
    }
}
//GOHERE

// #[cfg(target_arch = "wasm32")]
mod wasm {
    use super::GpuConfig;
    use crate::{Config, Mapping};
    use wasm_bindgen::prelude::*;
    use web_sys::{ImageBitmap, OffscreenCanvas};

    const PRESENT_UNIFORM_BYTES: u64 = 16; // two vec2<f32>
    const CONFIG_UNIFORM_BYTES: u64 = std::mem::size_of::<GpuConfig>() as u64;

    #[derive(Debug, Clone, Copy, PartialEq, Default)]
enum DrawMode {
        #[default]
        Fit,
        Fill,
        Stretch,
    }

    // ------------------------------------------------------------
    // GPU state that lives as long as the tab lives
    // ------------------------------------------------------------
    struct Gpu {
        device: wgpu::Device,
        adapter: wgpu::Adapter,
        queue: wgpu::Queue,

        sampler: wgpu::Sampler,
        tex_bgl: wgpu::BindGroupLayout,
        uni_bgl: wgpu::BindGroupLayout,
        mapping_frag_bgl: wgpu::BindGroupLayout,

        // pipelines
        blit: wgpu::RenderPipeline,
        present: std::collections::HashMap<Mapping, wgpu::RenderPipeline>,
        present_fmt: Option<wgpu::TextureFormat>,
    }

    struct CanvasCtx {
        surface: wgpu::Surface<'static>,
        config: wgpu::SurfaceConfiguration,
    }

    // ==============================================================
    // ===============  PUBLIC  WASM  API  ==========================
    // ==============================================================
    #[wasm_bindgen]
    impl Renderer {
        #[wasm_bindgen(constructor)]
        pub async fn new() -> Renderer {
            let using_webgpu = wgpu::util::is_browser_webgpu_supported().await;
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
            Renderer {
                instance,
                gpu: None,
                canvas: None,
                full_tex: None,
                work_tex: None,
                work_bg: None,
                uniform_buf: None,
                config_buf: None,
                last_bitmap: None,
                draw_mode: DrawMode::default(),
                using_webgpu,
                config: None,
            }
        }

        // ------------------------------------------------------------
        // canvas handling
        // ------------------------------------------------------------
        #[wasm_bindgen]
        pub async fn set_canvas(&mut self, canvas: OffscreenCanvas) -> Result<(), JsValue> {
            log::info!(
                "Setting canvas with dimensions: {}x{}",
                canvas.width(),
                canvas.height()
            );
            let raw_surface = self
                .instance
                .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas.clone()))
                .map_err(|e| JsValue::from_str(&format!("surface: {:?}", e)))?;
            // extend lifetime
            let surface: wgpu::Surface<'static> =
                unsafe { std::mem::transmute::<_, wgpu::Surface<'static>>(raw_surface) };

            if !self.using_webgpu {
                self.gpu = None;
                self.full_tex = None;
                self.uniform_buf = None;
            }
            self.ensure_gpu(&surface).await?;

            let gpu = self.gpu.as_ref().unwrap();

            // configure swap-chain
            let caps = surface.get_capabilities(&gpu.adapter);
            let mut fmt = caps.formats[0];
            for &f in caps.formats.iter() {
                if f == wgpu::TextureFormat::Rgba8Unorm {
                    fmt = f;
                    break;
                }
            }

            let mut alpha_mode = wgpu::CompositeAlphaMode::Opaque;
            if self.using_webgpu {
                alpha_mode = wgpu::CompositeAlphaMode::PreMultiplied;
            }

            let config = wgpu::SurfaceConfiguration {
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                format: fmt,
                width: canvas.width(),
                height: canvas.height(),
                present_mode: wgpu::PresentMode::Fifo,
                alpha_mode,
                view_formats: vec![],
                desired_maximum_frame_latency: 2,
            };
            surface.configure(&gpu.device, &config);

            if gpu.present_fmt.is_none() {
                self.build_present_pipelines(fmt);
            };

            self.canvas = Some(CanvasCtx { surface, config });

            // draw whatever the last bitmap was, if any
            let _ = self.try_draw();

            Ok(())
        }

        // ------------------------------------------------------------
        // user options
        // ------------------------------------------------------------
        #[wasm_bindgen]
        pub fn set_draw_mode(&mut self, mode: &str) -> Result<(), JsValue> {
            self.draw_mode = match mode {
                "stretch" => DrawMode::Stretch,
                "aspect-fill" => DrawMode::Fill,
                "aspect-fit" => DrawMode::Fit,
                _ => {
                    return Err(JsValue::from_str(
                        "mode must be stretch | aspect-fit | aspect-fill",
                    ))
                }
            };
            Ok(())
        }

        #[wasm_bindgen]
        pub fn set_config(&mut self, config: Config) -> Result<(), JsValue> {
            // log::info!("Setting config: {}", config);
            self.config = Some(config);
            // Re-draw to apply new config
            let _ = self.try_draw();
            Ok(())
        }

        // ------------------------------------------------------------
        // main drawing entry
        // ------------------------------------------------------------
        #[wasm_bindgen]
        pub fn draw(&mut self, bmp: ImageBitmap) -> Result<(), JsValue> {
            self.last_bitmap = Some(bmp.clone());
            self.upload_full_texture(&bmp)?;
            self.ensure_work_tex_size()?;
            self.blit_full_to_work()?;
            self.present()
        }

        #[wasm_bindgen]
        pub fn try_draw(&mut self) -> Result<(), JsValue> {
            if self.last_bitmap.is_none() {
                return Err(JsValue::from_str("draw() has not been called yet"));
            }
            let bitmap = self.last_bitmap.as_ref().unwrap().clone();
            if bitmap.width() == 0 || bitmap.height() == 0 {
                return Err(JsValue::from_str(
                    "last_bitmap is invalid (closed or zero size)",
                ));
            }
            if self.full_tex.is_none() {
                self.upload_full_texture(&bitmap)?;
            }
            self.ensure_work_tex_size()?;
            self.blit_full_to_work()?;
            self.present()
        }

        #[wasm_bindgen]
        pub fn dispose(self) {
            // nothing – dropping does the work
        }
    }

    // ==============================================================
    // ============  LOW-LEVEL IMPLEMENTATION  ======================
    // ==============================================================
    impl Renderer {
        //------------------------- texture upload -------------------
        fn upload_full_texture(&mut self, bmp: &ImageBitmap) -> Result<(), JsValue> {
            let gpu = self.gpu.as_ref().ok_or("GPU not ready")?;

            let (w, h) = (bmp.width() as u32, bmp.height() as u32);
            if self
                .full_tex
                .as_ref()
                .map(|t| t.size().width != w || t.size().height != h)
                .unwrap_or(true)
            {
                self.full_tex = Some(
                    gpu.device
                        .create_texture(&Self::linear_tex("full_tex", w, h)),
                );
            }

            gpu.queue.copy_external_image_to_texture(
                &wgpu::CopyExternalImageSourceInfo {
                    source: wgpu::ExternalImageSource::ImageBitmap(bmp.clone()),
                    origin: wgpu::Origin2d::ZERO,
                    flip_y: false,
                },
                wgpu::CopyExternalImageDestInfo {
                    texture: self.full_tex.as_ref().unwrap(),
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                    color_space: wgpu::PredefinedColorSpace::Srgb,
                    premultiplied_alpha: false,
                },
                self.full_tex.as_ref().unwrap().size(),
            );
            Ok(())
        }

        //------------------- work-texture management ----------------
        fn desired_work_dims(&self) -> Option<(u32, u32)> {
            let full = self.full_tex.as_ref()?;
            let ctx = self.canvas.as_ref()?;
            let scale = (ctx.config.width as f32 / full.size().width as f32)
                .min(ctx.config.height as f32 / full.size().height as f32)
                .clamp(0.0, 1.0);
            Some((
                (full.size().width as f32 * scale).max(1.0).round() as u32,
                (full.size().height as f32 * scale).max(1.0).round() as u32,
            ))
        }

        fn ensure_work_tex_size(&mut self) -> Result<(), JsValue> {
            let gpu = self.gpu.as_ref().unwrap();
            let (w, h) = self
                .desired_work_dims()
                .ok_or(JsValue::from_str("no canvas / full_tex"))?;
            if self
                .work_tex
                .as_ref()
                .map(|t| t.size().width != w || t.size().height != h)
                .unwrap_or(true)
            {
                self.work_tex = Some(
                    gpu.device
                        .create_texture(&Self::linear_tex("work_tex", w, h)),
                );
                let view = self
                    .work_tex
                    .as_ref()
                    .unwrap()
                    .create_view(&Default::default());
                self.work_bg = Some(gpu.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("work_bg"),
                    layout: &gpu.tex_bgl,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::Sampler(&gpu.sampler),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::TextureView(&view),
                        },
                    ],
                }));
            }
            Ok(())
        }

        //----------------------------- blit -------------------------
        fn blit_full_to_work(&mut self) -> Result<(), JsValue> {
            let gpu = self.gpu.as_ref().unwrap();

            let src_view = self
                .full_tex
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            let dst_view = self
                .work_tex
                .as_ref()
                .unwrap()
                .create_view(&Default::default());

            let tmp_bg = gpu.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("blit_bg"),
                layout: &gpu.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::Sampler(&gpu.sampler),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                ],
            });

            let mut enc = gpu
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("blit_enc"),
                });
            {
                let mut rpass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("blit_pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &dst_view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                });
                rpass.set_pipeline(&gpu.blit);
                rpass.set_bind_group(0, &tmp_bg, &[]);
                rpass.draw(0..6, 0..1);
            }
            gpu.queue.submit(Some(enc.finish()));

            Ok(())
        }

        //---------------------------- present -----------------------
        fn present(&mut self) -> Result<(), JsValue> {
            let ctx = self.canvas.as_ref().ok_or("canvas missing")?;
            let gpu = self.gpu.as_ref().unwrap();
            let work_tex = self.work_tex.as_ref().ok_or("work_tex missing")?;

            // ------------ uniform (scale / offset) calculation -----------------
            let (img_w, img_h) = { (work_tex.size().width as f32, work_tex.size().height as f32) };
            let (can_w, can_h) = (ctx.config.width as f32, ctx.config.height as f32);

            let img_ar = img_w / img_h;
            let can_ar = can_w / can_h;

            let mut scale = [1.0f32, 1.0];
            let offset = [0.0f32, 0.0];
            match self.draw_mode {
                DrawMode::Fit => {
                    if img_ar > can_ar {
                        scale[1] = can_ar / img_ar;
                    } else {
                        scale[0] = img_ar / can_ar;
                    }
                }
                DrawMode::Fill => {
                    if img_ar > can_ar {
                        scale[0] = img_ar / can_ar;
                    } else {
                        scale[1] = can_ar / img_ar;
                    }
                }
                DrawMode::Stretch => {}
            }

            // Always update the general uniform_buf as present_vs.wgsl always uses it
            if self.uniform_buf.is_none() {
                self.uniform_buf = Some(gpu.device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("uniform_buf"),
                    size: PRESENT_UNIFORM_BYTES,
                    usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                }));
            }
            let data: [f32; 4] = [scale[0], scale[1], offset[0], offset[1]];
            gpu.queue.write_buffer(
                self.uniform_buf.as_ref().unwrap(),
                0,
                bytemuck::cast_slice(&data),
            );

            let uni_bg = gpu.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("uni_bg"),
                layout: &gpu.uni_bgl,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                        buffer: self.uniform_buf.as_ref().unwrap(),
                        offset: 0,
                        size: wgpu::BufferSize::new(PRESENT_UNIFORM_BYTES),
                    }),
                }],
            });

            let mapping = self.config.as_ref().map(|c| c.mapping).unwrap_or_default();

            let mapping_frag_bg_to_use: Option<wgpu::BindGroup> = match mapping {
                Mapping::Smoothed | Mapping::Palettized => {
                    let gpu_config_data = GpuConfig::from_config(
                        self.config.as_ref().unwrap(),
                        work_tex.size().width,
                        work_tex.size().height,
                    );

                    if self.config_buf.is_none() {
                        self.config_buf = Some(gpu.device.create_buffer(&wgpu::BufferDescriptor {
                            label: Some("config_buf"),
                            size: CONFIG_UNIFORM_BYTES,
                            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                            mapped_at_creation: false,
                        }));
                    }
                    gpu.queue.write_buffer(
                        self.config_buf.as_ref().unwrap(),
                        0,
                        bytemuck::cast_slice(&[gpu_config_data]),
                    );

                    Some(
                        gpu.device.create_bind_group(&wgpu::BindGroupDescriptor {
                            label: Some("mapping_frag_bg"),
                            layout: &gpu.mapping_frag_bgl, // Use the new layout
                            entries: &[
                                wgpu::BindGroupEntry {
                                    binding: 0,
                                    resource: wgpu::BindingResource::Sampler(&gpu.sampler),
                                },
                                wgpu::BindGroupEntry {
                                    binding: 1,
                                    resource: wgpu::BindingResource::TextureView(
                                        &work_tex.create_view(&Default::default()),
                                    ),
                                },
                                wgpu::BindGroupEntry {
                                    binding: 2,
                                    resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                                        buffer: self.config_buf.as_ref().unwrap(),
                                        offset: 0,
                                        size: wgpu::BufferSize::new(CONFIG_UNIFORM_BYTES),
                                    }),
                                },
                            ],
                        }),
                    )
                }
            };

            // ------------ render -----------------------------------
            let frame = ctx
                .surface
                .get_current_texture()
                .map_err(|e| JsValue::from_str(&format!("frame: {:?}", e)))?;
            let view = frame.texture.create_view(&Default::default());

            let mut enc = gpu
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("present_enc"),
                });
            {
                let mut rpass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("present_pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                });

                let pipe = gpu.present.get(&mapping).unwrap();
                rpass.set_pipeline(pipe);

                // Set group(0) bind group
                match mapping {
                    Mapping::Smoothed | Mapping::Palettized => {
                        rpass.set_bind_group(0, mapping_frag_bg_to_use.as_ref().unwrap(), &[]);
                    }
                }
                // Set group(1) bind group (used by present_vs.wgsl for all mappings)
                rpass.set_bind_group(1, &uni_bg, &[]);

                rpass.draw(0..6, 0..1);
            }

            gpu.queue.submit(Some(enc.finish()));
            frame.present();
            Ok(())
        }
    }

    #[wasm_bindgen]
    pub struct Renderer {
        instance: wgpu::Instance,
        gpu: Option<Gpu>,
        using_webgpu: bool,

        canvas: Option<CanvasCtx>,

        // image data
        full_tex: Option<wgpu::Texture>,  // original pixels (linear)
        work_tex: Option<wgpu::Texture>,  // possibly down-scaled copy
        work_bg: Option<wgpu::BindGroup>, // sampler + work_tex view

        uniform_buf: Option<wgpu::Buffer>, // For general scale/offset uniform (group 1)
        config_buf: Option<wgpu::Buffer>,  // For palettum config uniform (group 0, binding 2)

        last_bitmap: Option<ImageBitmap>,

        draw_mode: DrawMode,
        config: Option<Config>,
    }

    impl Renderer {
        //------------------------------------------------------------------
        // GPU creation – only once per tab
        //------------------------------------------------------------------
        async fn ensure_gpu(&mut self, surface_hint: &wgpu::Surface<'static>) -> Result<(), JsValue> {
            if self.gpu.is_some() && self.using_webgpu {
                return Ok(());
            }

            // adapter
            let adapter = self
                .instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::HighPerformance,
                    compatible_surface: Some(surface_hint),
                    force_fallback_adapter: false,
                })
                .await
                .map_err(|e| JsValue::from_str(&format!("No adapter: {:?}", e)))?;

            log::info!("Adapter: {:?}", adapter.get_info());

            // device / queue
            let (device, queue) = adapter
                .request_device(&wgpu::DeviceDescriptor {
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                    ..Default::default()
                })
                .await
                .map_err(|e| JsValue::from_str(&format!("Device request failed: {:?}", e)))?;

            // common objects ----------------------------------------------------
            let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
                label: Some("linear_sampler"),
                mag_filter: wgpu::FilterMode::Nearest,
                min_filter: wgpu::FilterMode::Linear,
                ..Default::default()
            });

            let tex_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("tex_bgl"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            multisampled: false,
                            view_dimension: wgpu::TextureViewDimension::D2,
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        },
                        count: None,
                    },
                ],
            });

            let uni_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("uniform_bgl"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: wgpu::BufferSize::new(PRESENT_UNIFORM_BYTES),
                    },
                    count: None,
                }],
            });

            let mapping_frag_bgl =
                device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: Some("mapping_frag_bgl"),
                    entries: &[
                        wgpu::BindGroupLayoutEntry {
                            binding: 0, // Sampler
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                            count: None,
                        },
                        wgpu::BindGroupLayoutEntry {
                            binding: 1, // Texture
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Texture {
                                multisampled: false,
                                view_dimension: wgpu::TextureViewDimension::D2,
                                sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            },
                            count: None,
                        },
                        wgpu::BindGroupLayoutEntry {
                            binding: 2,                               // Config Uniform
                            visibility: wgpu::ShaderStages::FRAGMENT, // Config data needed in fragment
                            ty: wgpu::BindingType::Buffer {
                                ty: wgpu::BufferBindingType::Uniform,
                                has_dynamic_offset: false,
                                min_binding_size: wgpu::BufferSize::new(CONFIG_UNIFORM_BYTES),
                            },
                            count: None,
                        },
                    ],
                });

            // shader modules ----------------------------------------------------
            let quad_vs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("quad_vs"),
                source: wgpu::ShaderSource::Wgsl(include_str!("shaders/quad_vs.wgsl").into()),
            });
            let blit_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("blit_fs"),
                source: wgpu::ShaderSource::Wgsl(include_str!("shaders/blit_fs.wgsl").into()),
            });

            // helper to build a pipeline quickly
            let make_pipe = |vs: &wgpu::ShaderModule,
                             fs: &wgpu::ShaderModule,
                             layout: &[&wgpu::BindGroupLayout],
                             fmt: wgpu::TextureFormat,
                             label: &str|
             -> wgpu::RenderPipeline {
                let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some(label),
                    bind_group_layouts: layout,
                    push_constant_ranges: &[],
                });
                device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                    label: Some(label),
                    layout: Some(&pl),
                    vertex: wgpu::VertexState {
                        module: vs,
                        entry_point: Some("vs_main"),
                        buffers: &[],
                        compilation_options: Default::default(),
                    },
                    fragment: Some(wgpu::FragmentState {
                        module: fs,
                        entry_point: Some("fs_main"),
                        targets: &[Some(wgpu::ColorTargetState {
                            format: fmt,
                            blend: Some(wgpu::BlendState::REPLACE),
                            write_mask: wgpu::ColorWrites::ALL,
                        })],
                        compilation_options: Default::default(),
                    }),
                    primitive: Default::default(),
                    depth_stencil: None,
                    multisample: Default::default(),
                    multiview: None,
                    cache: None,
                })
            };

            let blit_pipe = make_pipe(
                &quad_vs,
                &blit_fs,
                &[&tex_bgl],
                wgpu::TextureFormat::Rgba8Unorm,
                "blit",
            );

            // store everything
            self.gpu = Some(Gpu {
                device,
                adapter,
                queue,
                sampler,
                tex_bgl,
                uni_bgl,
                mapping_frag_bgl,
                blit: blit_pipe,
                present: std::collections::HashMap::new(),
                present_fmt: None,
            });

            Ok(())
        }

        //------------------------------------------------------------------
        // helper: build (or rebuild) all present pipelines for a format
        //------------------------------------------------------------------
        fn build_present_pipelines(&mut self, fmt: wgpu::TextureFormat) {
            let gpu = self.gpu.as_mut().unwrap();

            let vs = gpu
                .device
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("present_vs"),
                    source: wgpu::ShaderSource::Wgsl(
                        include_str!("shaders/present_vs.wgsl").into(),
                    ),
                });

            // palettized
            let palettized_fs = gpu
                .device
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("present_palettized_fs"),
                    source: wgpu::ShaderSource::Wgsl(
                        include_str!("shaders/palettized_fs.wgsl").into(),
                    ),
                });

            // smoothed
            let smoothed_fs = gpu
                .device
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("present_smoothed_fs"),
                    source: wgpu::ShaderSource::Wgsl(
                        include_str!("shaders/smoothed_fs.wgsl").into(),
                    ),
                });

            let make = |vs: &wgpu::ShaderModule,
                        fs: &wgpu::ShaderModule,
                        group0_bgl: &wgpu::BindGroupLayout, // Group 0 layout
                        mapping: Mapping|
             -> wgpu::RenderPipeline {
                // All present pipelines use vs (consuming group 1) and a specific group 0.
                let layout = [group0_bgl, &gpu.uni_bgl];
                let pl = gpu
                    .device
                    .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                        label: Some(&format!("present_{:?}_layout", mapping)),
                        bind_group_layouts: &layout,
                        push_constant_ranges: &[],
                    });
                gpu.device
                    .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                        label: Some(&format!("present_{:?}_pipe", mapping)),
                        layout: Some(&pl),
                        vertex: wgpu::VertexState {
                            module: vs,
                            entry_point: Some("vs_main"),
                            buffers: &[],
                            compilation_options: Default::default(),
                        },
                        fragment: Some(wgpu::FragmentState {
                            module: fs,
                            entry_point: Some("fs_main"),
                            targets: &[Some(wgpu::ColorTargetState {
                                format: fmt,
                                blend: Some(wgpu::BlendState::REPLACE),
                                write_mask: wgpu::ColorWrites::ALL,
                            })],
                            compilation_options: Default::default(),
                        }),
                        primitive: Default::default(),
                        depth_stencil: None,
                        multisample: Default::default(),
                        multiview: None,
                        cache: None,
                    })
            };

            gpu.present.insert(
                Mapping::Palettized,
                make(
                    &vs,
                    &palettized_fs,
                    &gpu.mapping_frag_bgl,
                    Mapping::Palettized,
                ),
            );

            gpu.present.insert(
                Mapping::Smoothed,
                make(
                    &vs,
                    &smoothed_fs,
                    &gpu.mapping_frag_bgl, // Group 0 for Smoothed
                    Mapping::Smoothed,
                ),
            );

            gpu.present_fmt = Some(fmt);
        }

        //------------------------------------------------------------------
        // linear texture descriptor helper
        //------------------------------------------------------------------
        fn linear_tex<'a>(label: &'a str, w: u32, h: u32) -> wgpu::TextureDescriptor<'a> {
            wgpu::TextureDescriptor {
                label: Some(label),
                size: wgpu::Extent3d {
                    width: w,
                    height: h,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: wgpu::TextureUsages::TEXTURE_BINDING
                    | wgpu::TextureUsages::COPY_DST
                    | wgpu::TextureUsages::RENDER_ATTACHMENT,
                view_formats: &[],
            }
        }
    }

    #[derive(Debug)]
    struct MyError(String);

    impl From<&str> for MyError {
        fn from(s: &str) -> Self {
            MyError(s.to_owned())
        }
    }

    impl From<MyError> for JsValue {
        fn from(e: MyError) -> Self {
            JsValue::from_str(&e.0)
        }
    }
}
