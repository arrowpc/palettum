use super::utils::{get_gpu_instance, preprocess, GpuConfig, GpuInstance, GpuRgba};
use crate::{
    config::Config,
    error::{Error, Result},
    palettized::Dithering,
    Mapping,
};
use std::{borrow::Cow, collections::HashMap, path::PathBuf, sync::Arc};
use wgpu::util::DeviceExt;

struct Context {
    device: wgpu::Device,
    queue: wgpu::Queue,
    palettized_pipeline: wgpu::ComputePipeline,
    smoothed_pipeline: wgpu::ComputePipeline,
    mapping_layout: wgpu::BindGroupLayout,
    blue_noise_bind_group: wgpu::BindGroup,
}

pub struct Processor {
    #[allow(dead_code)]
    instance: Arc<GpuInstance>,
    context: Arc<Context>,
}

const WORKGROUP_SIZE_X: u32 = 16;
const WORKGROUP_SIZE_Y: u32 = 16;

impl Processor {
    pub async fn new() -> Result<Self> {
        let instance = get_gpu_instance().await?;

        // On Wasm, we can only use compute shaders with WebGPU.
        #[cfg(target_arch = "wasm32")]
        if !instance.using_webgpu {
            return Err(Error::Gpu(
                "Compute shaders require WebGPU on wasm.".to_string(),
            ));
        }

        let context = Arc::new(Self::create_context(instance.as_ref()).await?);
        Ok(Self { instance, context })
    }

    async fn create_context(instance: &GpuInstance) -> Result<Context> {
        let adapter = instance
            .instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| Error::Gpu(format!("No suitable GPU adapter found: {e}")))?;

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                required_limits: wgpu::Limits::default(),
                ..Default::default()
            })
            .await
            .map_err(|e| Error::Gpu(format!("Device request failed: {e}")))?;

        let mapping_layout = Self::create_bind_group_layout(&device);

        let blue_noise_size = wgpu::Extent3d {
            width: 64,
            height: 64,
            depth_or_array_layers: 1,
        };

        let blue_noise_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Blue Noise Texture"),
            size: blue_noise_size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &blue_noise_texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &crate::palettized::BLUE_NOISE_64X64,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(64),
                rows_per_image: Some(64),
            },
            blue_noise_size,
        );

        let blue_noise_texture_view =
            blue_noise_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let blue_noise_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Blue Noise Sampler"),
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            address_mode_w: wgpu::AddressMode::ClampToEdge,

            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Nearest,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        let blue_noise_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Blue Noise Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: false },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::NonFiltering),
                        count: None,
                    },
                ],
            });

        let blue_noise_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Blue Noise Bind Group"),
            layout: &blue_noise_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&blue_noise_texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&blue_noise_sampler),
                },
            ],
        });

        let palettized_pipeline = Self::create_palettized_pipeline(
            &device,
            &mapping_layout,
            &blue_noise_bind_group_layout,
        );
        let smoothed_pipeline = Self::create_smoothed_pipeline(&device, &mapping_layout);

        Ok(Context {
            device,
            queue,
            palettized_pipeline,
            smoothed_pipeline,
            mapping_layout,
            blue_noise_bind_group,
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
            return Err(Error::Gpu(
                "bytes_per_row_for_rgba is zero with non-zero width.".to_string(),
            ));
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
            return Err(Error::Gpu(format!(
                "Cannot determine a valid chunk size (max_rows_per_chunk is 0 but height {height} > 0). \
                 Image width ({width}) might be too large. Max buffer size: {max_buffer_size}, max binding size: {max_bindable_storage_buffer_size}"
            )));
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
                        label: Some(&format!("RGBA Image Chunk Buffer {chunk_index}")),
                        contents: current_image_data_slice,
                        usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
                    });

            let gpu_chunk_config = GpuConfig::from_config(config, width, current_chunk_height);
            let config_chunk_buffer =
                self.context
                    .device
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some(&format!("Config Chunk Buffer {chunk_index}")),
                        contents: bytemuck::bytes_of(&gpu_chunk_config),
                        usage: wgpu::BufferUsages::UNIFORM,
                    });

            let result_chunk_buffer_size = current_image_data_slice.len() as u64;
            let result_chunk_buffer = self.context.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(&format!("Result RGBA Chunk Buffer {chunk_index}")),
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
                        label: Some(&format!("Image Proc. Commands Chunk {chunk_index}")),
                    });

            let general_bind_group =
                self.context
                    .device
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some(&format!("General Bind Group Chunk {chunk_index}")),
                        layout: &self.context.mapping_layout,
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

            {
                let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                    label: Some(&format!("Compute Pass Chunk {chunk_index}")),
                    timestamp_writes: None,
                });

                compute_pass.set_bind_group(0, &general_bind_group, &[]);

                match config.mapping {
                    Mapping::Palettized => {
                        compute_pass.set_pipeline(&self.context.palettized_pipeline);
                        match config.dither_algorithm {
                            Dithering::Fs => {
                                compute_pass.dispatch_workgroups(1, 1, 1);
                            }
                            Dithering::Bn => {
                                compute_pass.set_bind_group(
                                    1,
                                    &self.context.blue_noise_bind_group,
                                    &[],
                                );
                                let dispatch_x =
                                    gpu_chunk_config.image_width.div_ceil(WORKGROUP_SIZE_X);
                                let dispatch_y =
                                    gpu_chunk_config.image_height.div_ceil(WORKGROUP_SIZE_Y);
                                compute_pass.dispatch_workgroups(dispatch_x, dispatch_y, 1);
                            }
                            Dithering::None => {
                                compute_pass.set_bind_group(
                                    1,
                                    &self.context.blue_noise_bind_group,
                                    &[],
                                );
                                let dispatch_x =
                                    gpu_chunk_config.image_width.div_ceil(WORKGROUP_SIZE_X);
                                let dispatch_y =
                                    gpu_chunk_config.image_height.div_ceil(WORKGROUP_SIZE_Y);
                                compute_pass.dispatch_workgroups(dispatch_x, dispatch_y, 1);
                            }
                        }
                    }
                    Mapping::Smoothed => {
                        compute_pass.set_pipeline(&self.context.smoothed_pipeline);
                        let dispatch_x = gpu_chunk_config.image_width.div_ceil(WORKGROUP_SIZE_X);
                        let dispatch_y = gpu_chunk_config.image_height.div_ceil(WORKGROUP_SIZE_Y);
                        compute_pass.dispatch_workgroups(dispatch_x, dispatch_y, 1);
                    }
                }
            }

            let staging_chunk_buffer = self.context.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(&format!("Staging Chunk Buffer {chunk_index}")),
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

            self.context.device.poll(wgpu::PollType::Wait)?;

            match receiver.await {
                Ok(Ok(())) => {
                    let data = buffer_slice.get_mapped_range();
                    all_results.extend_from_slice(&data);
                    drop(data);
                    staging_chunk_buffer.unmap();
                }
                Ok(Err(e)) => {
                    return Err(Error::Gpu(format!(
                        "Buffer mapping error for chunk {chunk_index}: {e}"
                    )));
                }
                Err(e) => {
                    return Err(Error::Gpu(format!(
                        "Channel receive error for chunk {chunk_index}: {e}"
                    )));
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
        mapping_layout: &wgpu::BindGroupLayout,
        blue_noise_layout: &wgpu::BindGroupLayout,
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
            bind_group_layouts: &[mapping_layout, blue_noise_layout],
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
