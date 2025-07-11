use super::shader_loader::preprocess;
use std::{borrow::Cow, collections::HashMap, path::PathBuf, sync::Arc};
use wgpu::util::DeviceExt;

use crate::{config::Config, error::Result, palettized::Dithering, Mapping};

use super::context::GpuContext;

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

pub struct GpuImageProcessor {
    context: Arc<GpuContext>,
    palettized_pipeline: wgpu::ComputePipeline,
    smoothed_pipeline: wgpu::ComputePipeline,
    mapping_layout: wgpu::BindGroupLayout,
}

const WORKGROUP_SIZE_X: u32 = 16;
const WORKGROUP_SIZE_Y: u32 = 16;

impl GpuImageProcessor {
    pub fn new(context: Arc<GpuContext>) -> Self {
        let mapping_layout = Self::create_bind_group_layout(&context.device);
        let palettized_pipeline =
            Self::create_palettized_pipeline(&context.device, &mapping_layout);
        let smoothed_pipeline = Self::create_smoothed_pipeline(&context.device, &mapping_layout);

        Self {
            context,
            palettized_pipeline,
            smoothed_pipeline,
            mapping_layout,
        }
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

        let max_buffer_size = self.context.device.limits().max_buffer_size;
        let max_rows_per_chunk_based_on_total_size = if bytes_per_row_for_rgba > 0 {
            (max_buffer_size / bytes_per_row_for_rgba) as u32
        } else {
            height
        };

        let max_bindable_storage_buffer_size =
            self.context.device.limits().max_storage_buffer_binding_size;
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
                self.context
                    .device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some(&format!("RGBA Image Chunk Buffer {}", chunk_index)),
                        contents: current_image_data_slice,
                        usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
                    });

            let gpu_chunk_config = GpuConfig::from_config(config, width, current_chunk_height);
            let config_chunk_buffer =
                self.context
                    .device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some(&format!("Config Chunk Buffer {}", chunk_index)),
                        contents: bytemuck::bytes_of(&gpu_chunk_config),
                        usage: wgpu::BufferUsages::UNIFORM,
                    });

            let result_chunk_buffer_size = current_image_data_slice.len() as u64;
            let result_chunk_buffer = self.context.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(&format!("Result RGBA Chunk Buffer {}", chunk_index)),
                size: result_chunk_buffer_size,
                usage: wgpu::BufferUsages::STORAGE
                    | wgpu::BufferUsages::COPY_SRC
                    | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });

            let mut encoder =
                self.context
                    .device
                    .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                        label: Some(&format!("Image Proc. Commands Chunk {}", chunk_index)),
                    });

            let general_bind_group =
                self.context
                    .device
                    .create_bind_group(&wgpu::BindGroupDescriptor {
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

            let staging_chunk_buffer = self.context.device.create_buffer(&wgpu::BufferDescriptor {
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

            self.context.queue.submit(std::iter::once(encoder.finish()));

            let buffer_slice = staging_chunk_buffer.slice(..);
            let (sender, receiver) = futures::channel::oneshot::channel();
            buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
                if sender.send(result).is_err() {
                    log::warn!("Receiver dropped before map_async result for staging buffer");
                }
            });

            self.context.device.poll(wgpu::MaintainBase::Wait).unwrap();

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
        let mut shaders = HashMap::new();
        shaders.insert(
            PathBuf::from("common.wgsl"),
            include_str!("shaders/common.wgsl").to_string(),
        );
        shaders.insert(
            PathBuf::from("palettized.wgsl"),
            include_str!("shaders/palettized.wgsl").to_string(),
        );

        let palettized_shader_code = preprocess(&shaders, "palettized.wgsl").unwrap();

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Palettized Mapping Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Owned(palettized_shader_code)),
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
        let mut shaders = HashMap::new();
        shaders.insert(
            PathBuf::from("common.wgsl"),
            include_str!("shaders/common.wgsl").to_string(),
        );
        shaders.insert(
            PathBuf::from("smoothed.wgsl"),
            include_str!("shaders/smoothed.wgsl").to_string(),
        );

        let smoothed_shader_code = preprocess(&shaders, "smoothed.wgsl").unwrap();

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Smoothed Shader"),
            source: wgpu::ShaderSource::Wgsl(Cow::Owned(smoothed_shader_code)),
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

#[cfg(not(target_arch = "wasm32"))]
static GPU_IMAGE_PROCESSOR_INSTANCE: async_once_cell::OnceCell<Arc<GpuImageProcessor>> =
    async_once_cell::OnceCell::new();

#[cfg(target_arch = "wasm32")]
thread_local! {
    static GPU_IMAGE_PROCESSOR_INSTANCE: std::cell::RefCell<Option<Arc<GpuImageProcessor>>> = std::cell::RefCell::new(None);
}

pub async fn get_gpu_image_processor(
    context: Arc<GpuContext>,
) -> Result<Option<Arc<GpuImageProcessor>>> {
    #[cfg(target_arch = "wasm32")]
    {
        let mut result = None;
        GPU_IMAGE_PROCESSOR_INSTANCE.with(|cell| {
            if let Some(p_arc) = cell.borrow().as_ref() {
                result = Some(p_arc.clone());
            }
        });
        if result.is_some() {
            return Ok(result);
        }
        let arc = Arc::new(GpuImageProcessor::new(context));
        GPU_IMAGE_PROCESSOR_INSTANCE.with(|cell| {
            *cell.borrow_mut() = Some(arc.clone());
        });
        Ok(Some(arc))
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let result = GPU_IMAGE_PROCESSOR_INSTANCE
            .get_or_try_init(async {
                let arc = Arc::new(GpuImageProcessor::new(context));
                log::debug!("GPU Image Processor initialized and cached");
                Ok(arc)
            })
            .await;

        match result {
            Ok(arc) => Ok(Some(arc.clone())),
            Err(_) => Ok(None),
        }
    }
}
