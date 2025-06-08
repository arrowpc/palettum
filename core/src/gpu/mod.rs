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

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::GpuConfig;
    use crate::{config::Config, Mapping};
    use std::result::Result as StdResult;
    use wasm_bindgen::prelude::*;
    use web_sys::{HtmlCanvasElement, HtmlVideoElement, ImageBitmap};
    use wgpu::util::DeviceExt;

    #[wasm_bindgen]
    pub struct ImageFilter {
        adapter: wgpu::Adapter,
        device: wgpu::Device,
        queue: wgpu::Queue,
        surface: wgpu::Surface<'static>,
        pipelines: Vec<wgpu::RenderPipeline>,
        current_shader_index: usize,
        config_buffer: wgpu::Buffer,
        texture: Option<wgpu::Texture>,
        bind_group: Option<wgpu::BindGroup>,
        bind_group_layout: wgpu::BindGroupLayout,
        sampler: wgpu::Sampler,
    }

    #[wasm_bindgen]
    impl ImageFilter {
        #[wasm_bindgen(constructor)]
        pub async fn new(canvas: HtmlCanvasElement) -> StdResult<ImageFilter, JsValue> {
            console_error_panic_hook::set_once();

            let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::GL,
                ..Default::default()
            });

            let surface = instance
                .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
                .map_err(|e| JsValue::from_str(&format!("Surface creation failed: {:?}", e)))?;

            let adapter = instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::default(),
                    compatible_surface: Some(&surface),
                    force_fallback_adapter: false,
                })
                .await
                .unwrap();

            let (device, queue) = adapter
                .request_device(&wgpu::DeviceDescriptor {
                    label: None,
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                    memory_hints: wgpu::MemoryHints::default(),
                    trace: wgpu::Trace::Off,
                })
                .await
                .map_err(|e| JsValue::from_str(&format!("Device request failed: {:?}", e)))?;

            let width = canvas.width();
            let height = canvas.height();
            let surface_caps = surface.get_capabilities(&adapter);
            let surface_format = surface_caps
                .formats
                .iter()
                .copied()
                .find(|f| f.is_srgb())
                .unwrap_or(surface_caps.formats[0]);

            surface.configure(
                &device,
                &wgpu::SurfaceConfiguration {
                    usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                    format: surface_format,
                    width,
                    height,
                    present_mode: wgpu::PresentMode::Fifo,
                    alpha_mode: surface_caps.alpha_modes[0],
                    view_formats: vec![],
                    desired_maximum_frame_latency: 2,
                },
            );

            let dummy_config = Config::default();
            let config = GpuConfig::from_config(&dummy_config, width, height);
            let config_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Config Buffer"),
                contents: bytemuck::bytes_of(&config),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            });

            const VERTEX_SHADER: &str = include_str!("shaders/vertex.wgsl");
            const FRAGMENT_ORIGINAL: &str = include_str!("shaders/fs_original.wgsl");
            const FRAGMENT_SMOOTHED: &str = include_str!("shaders/fs_smoothed.wgsl");
            const FRAGMENT_PALETTIZED: &str = include_str!("shaders/fs_palettized.wgsl");

            let vs_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("Vertex Shader"),
                source: wgpu::ShaderSource::Wgsl(VERTEX_SHADER.into()),
            });
            let fs_modules = [
                device.create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("Original Shader"),
                    source: wgpu::ShaderSource::Wgsl(FRAGMENT_ORIGINAL.into()),
                }),
                device.create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("Smoothed Shader"),
                    source: wgpu::ShaderSource::Wgsl(FRAGMENT_SMOOTHED.into()),
                }),
                device.create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("Palettized Shader"),
                    source: wgpu::ShaderSource::Wgsl(FRAGMENT_PALETTIZED.into()),
                }),
            ];

            let bind_group_layout =
                device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: Some("Media Bind Group Layout"),
                    entries: &[
                        wgpu::BindGroupLayoutEntry {
                            binding: 0,
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Texture {
                                sample_type: wgpu::TextureSampleType::Float { filterable: true },
                                view_dimension: wgpu::TextureViewDimension::D2,
                                multisampled: false,
                            },
                            count: None,
                        },
                        wgpu::BindGroupLayoutEntry {
                            binding: 1,
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                            count: None,
                        },
                        wgpu::BindGroupLayoutEntry {
                            binding: 2,
                            visibility: wgpu::ShaderStages::FRAGMENT,
                            ty: wgpu::BindingType::Buffer {
                                ty: wgpu::BufferBindingType::Uniform,
                                has_dynamic_offset: false,
                                min_binding_size: wgpu::BufferSize::new(
                                    std::mem::size_of::<GpuConfig>() as u64,
                                ),
                            },
                            count: None,
                        },
                    ],
                });

            let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("Render Pipeline Layout"),
                bind_group_layouts: &[&bind_group_layout],
                push_constant_ranges: &[],
            });

            let fragment_entry_points = ["fs_original", "fs_smoothed", "fs_palettized"];
            let pipelines = fs_modules
                .iter()
                .enumerate()
                .map(|(i, fs_module)| {
                    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                        label: Some(&format!("Render Pipeline {}", fragment_entry_points[i])),
                        layout: Some(&pipeline_layout),
                        vertex: wgpu::VertexState {
                            module: &vs_module,
                            entry_point: Some("vs_main"),
                            buffers: &[],
                            compilation_options: Default::default(),
                        },
                        fragment: Some(wgpu::FragmentState {
                            module: fs_module,
                            entry_point: Some(fragment_entry_points[i]),
                            targets: &[Some(wgpu::ColorTargetState {
                                format: surface_format,
                                blend: Some(wgpu::BlendState::REPLACE),
                                write_mask: wgpu::ColorWrites::ALL,
                            })],
                            compilation_options: Default::default(),
                        }),
                        primitive: wgpu::PrimitiveState::default(),
                        depth_stencil: None,
                        multisample: wgpu::MultisampleState::default(),
                        multiview: None,
                        cache: None,
                    })
                })
                .collect();

            let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
                address_mode_u: wgpu::AddressMode::ClampToEdge,
                address_mode_v: wgpu::AddressMode::ClampToEdge,
                mag_filter: wgpu::FilterMode::Linear,
                min_filter: wgpu::FilterMode::Linear,
                ..Default::default()
            });

            Ok(ImageFilter {
                adapter,
                device,
                queue,
                surface,
                pipelines,
                current_shader_index: 0,
                config_buffer,
                texture: None,
                bind_group: None,
                bind_group_layout,
                sampler,
            })
        }

        #[wasm_bindgen]
        pub fn resize_canvas(&mut self, width: u32, height: u32) -> StdResult<(), JsValue> {
            let surface_caps = self.surface.get_capabilities(&self.adapter);
            let surface_format = surface_caps
                .formats
                .iter()
                .copied()
                .find(|f| f.is_srgb())
                .unwrap_or(surface_caps.formats[0]);

            self.surface.configure(
                &self.device,
                &wgpu::SurfaceConfiguration {
                    usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                    format: surface_format,
                    width,
                    height,
                    present_mode: wgpu::PresentMode::Fifo,
                    alpha_mode: surface_caps.alpha_modes[0],
                    view_formats: vec![],
                    desired_maximum_frame_latency: 2,
                },
            );

            if self.texture.is_some() {
                self.render()?;
            }
            Ok(())
        }

        #[wasm_bindgen]
        pub fn update_from_video_frame(
            &mut self,
            video: &HtmlVideoElement,
        ) -> StdResult<(), JsValue> {
            let width = video.video_width();
            let height = video.video_height();

            if width == 0 || height == 0 {
                return Ok(());
            }

            let needs_new_texture = self.texture.as_ref().map_or(true, |t| {
                let size = t.size();
                size.width != width || size.height != height
            });

            if needs_new_texture {
                let texture = self.device.create_texture(&wgpu::TextureDescriptor {
                    label: Some("Media Texture"),
                    size: wgpu::Extent3d {
                        width,
                        height,
                        depth_or_array_layers: 1,
                    },
                    mip_level_count: 1,
                    sample_count: 1,
                    dimension: wgpu::TextureDimension::D2,
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    usage: wgpu::TextureUsages::TEXTURE_BINDING
                        | wgpu::TextureUsages::COPY_DST
                        | wgpu::TextureUsages::RENDER_ATTACHMENT,
                    view_formats: &[],
                });

                let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
                let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("Media Bind Group"),
                    layout: &self.bind_group_layout,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::TextureView(&view),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(&self.sampler),
                        },
                        wgpu::BindGroupEntry {
                            binding: 2,
                            resource: self.config_buffer.as_entire_binding(),
                        },
                    ],
                });

                self.texture = Some(texture);
                self.bind_group = Some(bind_group);
            }

            let texture = self.texture.as_ref().unwrap();

            let source = wgpu::CopyExternalImageSourceInfo {
                source: wgpu::ExternalImageSource::HTMLVideoElement(video.clone()),
                origin: wgpu::Origin2d::ZERO,
                flip_y: false,
            };

            let dest = wgpu::CopyExternalImageDestInfo {
                texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
                color_space: wgpu::PredefinedColorSpace::Srgb,
                premultiplied_alpha: false,
            };

            let extent = wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            };

            self.queue
                .copy_external_image_to_texture(&source, dest, extent);

            self.render()?;
            Ok(())
        }

        pub fn update_from_image_bitmap(&mut self, bitmap: &ImageBitmap) -> StdResult<(), JsValue> {
            let width = bitmap.width();
            let height = bitmap.height();

            if width == 0 || height == 0 {
                return Ok(());
            }

            let needs_new_texture = self.texture.as_ref().map_or(true, |t| {
                let size = t.size();
                size.width != width || size.height != height
            });

            if needs_new_texture {
                let texture = self.device.create_texture(&wgpu::TextureDescriptor {
                    label: Some("Media Texture"),
                    size: wgpu::Extent3d {
                        width,
                        height,
                        depth_or_array_layers: 1,
                    },
                    mip_level_count: 1,
                    sample_count: 1,
                    dimension: wgpu::TextureDimension::D2,
                    format: wgpu::TextureFormat::Rgba8UnormSrgb,
                    usage: wgpu::TextureUsages::TEXTURE_BINDING
                        | wgpu::TextureUsages::COPY_DST
                        | wgpu::TextureUsages::RENDER_ATTACHMENT,
                    view_formats: &[],
                });

                let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

                let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("Media Bind Group"),
                    layout: &self.bind_group_layout,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::TextureView(&view),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(&self.sampler),
                        },
                        wgpu::BindGroupEntry {
                            binding: 2,
                            resource: self.config_buffer.as_entire_binding(),
                        },
                    ],
                });

                self.texture = Some(texture);
                self.bind_group = Some(bind_group);
            }

            self.queue.copy_external_image_to_texture(
                &wgpu::CopyExternalImageSourceInfo {
                    source: wgpu::ExternalImageSource::ImageBitmap(bitmap.clone()),
                    origin: wgpu::Origin2d::ZERO,
                    flip_y: false,
                },
                wgpu::CopyExternalImageDestInfo {
                    texture: self.texture.as_ref().unwrap(),
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                    color_space: wgpu::PredefinedColorSpace::Srgb,
                    premultiplied_alpha: false,
                },
                wgpu::Extent3d {
                    width,
                    height,
                    depth_or_array_layers: 1,
                },
            );

            self.render()?;
            Ok(())
        }

        pub fn set_config(&mut self, config: &Config) -> StdResult<(), JsValue> {
            let (texture_width, texture_height) = if let Some(texture) = &self.texture {
                let size = texture.size();
                (size.width, size.height)
            } else {
                return Err(JsValue::from_str(
                    "Cannot apply filter: No media has been set",
                ));
            };

            match config.mapping {
                Mapping::Smoothed => self.current_shader_index = 1,
                Mapping::Palettized => self.current_shader_index = 2,
            }

            let gpu_config = GpuConfig::from_config(config, texture_width, texture_height);
            self.queue
                .write_buffer(&self.config_buffer, 0, bytemuck::bytes_of(&gpu_config));

            self.render()?;
            Ok(())
        }

        pub fn set_shader_index(&mut self, index: u32) -> StdResult<(), JsValue> {
            if index as usize >= self.pipelines.len() {
                return Err(JsValue::from_str("Invalid shader index"));
            }
            self.current_shader_index = index as usize;
            self.render()?;
            Ok(())
        }

        pub fn render(&self) -> StdResult<(), JsValue> {
            let frame = self.surface.get_current_texture().map_err(|e| {
                JsValue::from_str(&format!("Failed to get current texture: {:?}", e))
            })?;
            let view = frame
                .texture
                .create_view(&wgpu::TextureViewDescriptor::default());
            let mut encoder = self
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("Render Encoder"),
                });

            {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Render Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                });

                if let Some(bind_group) = &self.bind_group {
                    render_pass.set_pipeline(&self.pipelines[self.current_shader_index]);
                    render_pass.set_bind_group(0, bind_group, &[]);
                    render_pass.draw(0..3, 0..1);
                }
            }

            self.queue.submit(Some(encoder.finish()));
            frame.present();
            Ok(())
        }

        pub fn update_texture_data(&mut self, data: &[u8]) -> StdResult<(), JsValue> {
            if let Some(texture) = &self.texture {
                let size = texture.size();
                self.queue.write_texture(
                    texture.as_image_copy(),
                    data,
                    wgpu::TexelCopyBufferLayout {
                        offset: 0,
                        bytes_per_row: Some(4 * size.width),
                        rows_per_image: Some(size.height),
                    },
                    size,
                );
                self.render()?;
                Ok(())
            } else {
                Err(JsValue::from_str("No texture initialized"))
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub use wasm::ImageFilter;
