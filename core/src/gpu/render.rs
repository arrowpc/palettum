use super::utils::{get_gpu_instance, preprocess, GpuConfig, GpuInstance};
use crate::{Config, Mapping};
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::{ImageBitmap, OffscreenCanvas};

const PRESENT_UNIFORM_BYTES: u64 = 16; // two vec2<f32>
const CONFIG_UNIFORM_BYTES: u64 = std::mem::size_of::<GpuConfig>() as u64;

struct Canvas {
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    id: String,
}

#[derive(Default)]
enum ResizeMode {
    #[default]
    Fit,
    Fill,
    Stretch,
}

struct Context {
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,

    pub sampler: wgpu::Sampler,
    pub tex_bgl: wgpu::BindGroupLayout,
    pub uni_bgl: wgpu::BindGroupLayout,
    pub mapping_frag_bgl: wgpu::BindGroupLayout,
    pub blit_pipeline: wgpu::RenderPipeline,
    pub present_pipelines: HashMap<Mapping, wgpu::RenderPipeline>,
    pub present_fmt: wgpu::TextureFormat,
}

#[wasm_bindgen]
pub struct Renderer {
    instance: Arc<GpuInstance>,

    context: Option<Arc<Context>>,
    context_cache: HashMap<String, Arc<Context>>,

    canvas: Option<Arc<Canvas>>,
    canvas_cache: HashMap<String, Arc<Canvas>>,

    full_tex: Option<wgpu::Texture>,
    work_tex: Option<wgpu::Texture>,
    work_bg: Option<wgpu::BindGroup>,

    present_buf: Option<wgpu::Buffer>,
    config_buf: Option<wgpu::Buffer>,

    config: Option<Config>,
    resize_mode: ResizeMode,
}

#[wasm_bindgen]
impl Renderer {
    #[wasm_bindgen(constructor)]
    pub async fn new() -> Renderer {
        let instance = get_gpu_instance().await.expect("Failed to get GPU context");

        Renderer {
            instance,
            context: None,
            context_cache: HashMap::new(),
            canvas: None,
            canvas_cache: HashMap::new(),
            full_tex: None,
            work_tex: None,
            work_bg: None,
            present_buf: None,
            config_buf: None,
            config: None,
            resize_mode: ResizeMode::default(),
        }
    }

    pub async fn register_canvas(
        &mut self,
        canvas_id: String,
        canvas: OffscreenCanvas,
    ) -> Result<(), JsValue> {
        if self.canvas_cache.contains_key(&canvas_id) {
            return Err(JsValue::from_str(&format!(
                "A canvas with id: {} has already been registered",
                canvas_id
            )));
        }

        let instance = self.instance.as_ref();

        let raw_surface = self
            .instance
            .instance
            .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas.clone()))
            .map_err(|e| JsValue::from_str(&format!("surface: {:?}", e)))?;
        let surface: wgpu::Surface<'static> =
            unsafe { std::mem::transmute::<_, wgpu::Surface<'static>>(raw_surface) };

        // Context selection/creation
        let context = if instance.using_webgpu {
            // WebGPU: one global context, create if needed
            if let Some(ctx) = &self.context {
                ctx.clone()
            } else {
                let ctx: Arc<Context> = Arc::new(self.create_context(&surface).await?);
                self.context = Some(ctx.clone());
                ctx
            }
        } else {
            // WebGL: per-canvas context
            let ctx: Arc<Context> = Arc::new(self.create_context(&surface).await?);
            self.context_cache.insert(canvas_id.clone(), ctx.clone());
            self.context = Some(ctx.clone());
            ctx
        };

        let config = self.configure_surface(&context, &surface, &canvas);
        surface.configure(&context.device, &config);

        let canvas_handle = Arc::new(Canvas {
            id: canvas_id.clone(),
            surface,
            config,
        });

        self.canvas_cache.insert(canvas_id, canvas_handle);

        Ok(())
    }

    pub fn switch_canvas(&mut self, canvas_id: &str) -> Result<(), JsValue> {
        let canvas = self
            .canvas_cache
            .get(canvas_id)
            .ok_or_else(|| JsValue::from_str("Canvas not found"))?
            .clone();

        // For WebGPU, always use the global context
        // For WebGL, switch to the context for this canvas
        if !self.instance.as_ref().using_webgpu {
            if let Some(ctx) = self.context_cache.get(canvas_id) {
                self.context = Some(ctx.clone());
            } else {
                return Err(JsValue::from_str("Context for canvas not found"));
            }
        }

        self.canvas = Some(canvas);

        self.try_draw()?;
        Ok(())
    }

    pub fn draw(&mut self, bmp: ImageBitmap) -> Result<(), JsValue> {
        self.upload_full_texture(&bmp)?;
        self.ensure_work_tex_size()?;
        self.blit_full_to_work()?;
        self.present()
    }

    pub fn try_draw(&mut self) -> Result<(), JsValue> {
        if self.full_tex.is_none() {
            log::debug!("Nothing to draw");
            return Ok(());
        }
        self.ensure_work_tex_size()?;
        self.blit_full_to_work()?;
        self.present()
    }

    pub fn set_draw_mode(&mut self, mode: &str) -> Result<(), JsValue> {
        self.resize_mode = match mode {
            "stretch" => ResizeMode::Stretch,
            "aspect-fill" => ResizeMode::Fill,
            "aspect-fit" => ResizeMode::Fit,
            _ => {
                return Err(JsValue::from_str(
                    "mode must be stretch | aspect-fit | aspect-fill",
                ))
            }
        };
        Ok(())
    }

    pub fn set_config(&mut self, config: Config) -> Result<(), JsValue> {
        self.config = Some(config);
        self.try_draw()?;
        Ok(())
    }
}

impl Renderer {
    async fn create_context(&self, surface: &wgpu::Surface<'static>) -> Result<Context, JsValue> {
        let adapter = self
            .instance
            .as_ref()
            .instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|e| JsValue::from_str(&format!("No adapter: {:?}", e)))?;

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                ..Default::default()
            })
            .await
            .map_err(|e| JsValue::from_str(&format!("Device request failed: {:?}", e)))?;

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("linear_sampler"),
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let tex_bgl = self.build_tex_bgl(&device);
        let uni_bgl = self.build_uni_bgl(&device);
        let mapping_frag_bgl = self.build_mapping_frag_bgl(&device);

        let (blit_pipeline, present_pipelines, present_fmt) = self.build_pipelines(
            &device,
            &adapter,
            surface,
            &tex_bgl,
            &uni_bgl,
            &mapping_frag_bgl,
        );

        Ok(Context {
            adapter,
            device,
            queue,
            sampler,
            tex_bgl,
            uni_bgl,
            mapping_frag_bgl,
            blit_pipeline,
            present_pipelines,
            present_fmt,
        })
    }

    fn upload_full_texture(&mut self, bmp: &ImageBitmap) -> Result<(), JsValue> {
        let (w, h) = (bmp.width() as u32, bmp.height() as u32);
        if self
            .full_tex
            .as_ref()
            .map(|t| t.size().width != w || t.size().height != h)
            .unwrap_or(true)
        {
            self.full_tex = Some(
                self.context
                    .as_ref()
                    .unwrap()
                    .device
                    .create_texture(&Self::linear_tex("full_tex", w, h)),
            );
        }

        self.context
            .as_ref()
            .unwrap()
            .queue
            .copy_external_image_to_texture(
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

    fn desired_work_dims(&self) -> Option<(u32, u32)> {
        let full = self.full_tex.as_ref().unwrap();
        let ctx = self.canvas.as_ref().unwrap();
        let scale = (ctx.config.width as f32 / full.size().width as f32)
            .min(ctx.config.height as f32 / full.size().height as f32)
            .clamp(0.0, 1.0);
        Some((
            (full.size().width as f32 * scale).max(1.0).round() as u32,
            (full.size().height as f32 * scale).max(1.0).round() as u32,
        ))
    }

    fn ensure_work_tex_size(&mut self) -> Result<(), JsValue> {
        let (w, h) = self
            .desired_work_dims()
            .ok_or(JsValue::from_str("no canvas / full_tex"))?;
        if self
            .work_tex
            .as_ref()
            .map(|t| t.size().width != w || t.size().height != h)
            .unwrap_or(true)
        {
            let context = self.context.as_ref().unwrap();
            self.work_tex = Some(
                context
                    .device
                    .create_texture(&Self::linear_tex("work_tex", w, h)),
            );
            let view = self
                .work_tex
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            self.work_bg = Some(
                context
                    .device
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("work_bg"),
                        layout: &self.context.as_ref().unwrap().tex_bgl,
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::Sampler(&context.sampler),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::TextureView(&view),
                            },
                        ],
                    }),
            );
        }
        Ok(())
    }

    fn blit_full_to_work(&mut self) -> Result<(), JsValue> {
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

        let context = self.context.as_ref().unwrap();

        let tmp_bg = context
            .device
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("blit_bg"),
                layout: &context.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::Sampler(&context.sampler),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                ],
            });

        let mut enc = context
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
            rpass.set_pipeline(&context.blit_pipeline);
            rpass.set_bind_group(0, &tmp_bg, &[]);
            rpass.draw(0..6, 0..1);
        }
        context.queue.submit(Some(enc.finish()));

        Ok(())
    }

    fn present(&mut self) -> Result<(), JsValue> {
        let ctx = self.canvas.as_ref().ok_or("canvas missing")?;
        let work_tex = self.work_tex.as_ref().ok_or("work_tex missing")?;

        let (img_w, img_h) = { (work_tex.size().width as f32, work_tex.size().height as f32) };
        let (can_w, can_h) = (ctx.config.width as f32, ctx.config.height as f32);

        let img_ar = img_w / img_h;
        let can_ar = can_w / can_h;

        let mut scale = [1.0f32, 1.0];
        let offset = [0.0f32, 0.0];
        match self.resize_mode {
            ResizeMode::Fit => {
                if img_ar > can_ar {
                    scale[1] = can_ar / img_ar;
                } else {
                    scale[0] = img_ar / can_ar;
                }
            }
            ResizeMode::Fill => {
                if img_ar > can_ar {
                    scale[0] = img_ar / can_ar;
                } else {
                    scale[1] = can_ar / img_ar;
                }
            }
            ResizeMode::Stretch => {}
        }

        let context = self.context.as_ref().unwrap();

        if self.present_buf.is_none() {
            self.present_buf = Some(context.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("present_buf"),
                size: PRESENT_UNIFORM_BYTES,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            }));
        }
        let data: [f32; 4] = [scale[0], scale[1], offset[0], offset[1]];
        context.queue.write_buffer(
            self.present_buf.as_ref().unwrap(),
            0,
            bytemuck::cast_slice(&data),
        );

        let uni_bg = context
            .device
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("uni_bg"),
                layout: &context.uni_bgl,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                        buffer: self.present_buf.as_ref().unwrap(),
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
                    self.config_buf = Some(context.device.create_buffer(&wgpu::BufferDescriptor {
                        label: Some("config_buf"),
                        size: CONFIG_UNIFORM_BYTES,
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                        mapped_at_creation: false,
                    }));
                }
                context.queue.write_buffer(
                    self.config_buf.as_ref().unwrap(),
                    0,
                    bytemuck::cast_slice(&[gpu_config_data]),
                );

                Some(
                    context
                        .device
                        .create_bind_group(&wgpu::BindGroupDescriptor {
                            label: Some("mapping_frag_bg"),
                            layout: &context.mapping_frag_bgl,
                            entries: &[
                                wgpu::BindGroupEntry {
                                    binding: 0,
                                    resource: wgpu::BindingResource::Sampler(&context.sampler),
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

        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor {
            format: Some(context.present_fmt),
            ..Default::default()
        });

        let mut enc = context
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

            let pipe = context.present_pipelines.get(&mapping).unwrap();
            rpass.set_pipeline(pipe);

            match mapping {
                Mapping::Smoothed | Mapping::Palettized => {
                    rpass.set_bind_group(0, mapping_frag_bg_to_use.as_ref().unwrap(), &[]);
                }
            }
            rpass.set_bind_group(1, &uni_bg, &[]);

            rpass.draw(0..6, 0..1);
        }

        context.queue.submit(Some(enc.finish()));
        frame.present();
        Ok(())
    }

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
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST
                | wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        }
    }

    fn configure_surface(
        &self,
        ctx: &Arc<Context>,
        surface: &wgpu::Surface,
        canvas: &OffscreenCanvas,
    ) -> wgpu::SurfaceConfiguration {
        let caps = surface.get_capabilities(&ctx.adapter);
        let format = caps.formats[0];

        let alpha_mode = if self.instance.as_ref().using_webgpu {
            wgpu::CompositeAlphaMode::PreMultiplied
        } else {
            wgpu::CompositeAlphaMode::Opaque
        };

        let view_formats = if self.instance.as_ref().using_webgpu {
            vec![format.add_srgb_suffix()]
        } else {
            vec![]
        };

        wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: format.remove_srgb_suffix(),
            width: canvas.width(),
            height: canvas.height(),
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode,
            view_formats,
            desired_maximum_frame_latency: 2,
        }
    }

    fn build_tex_bgl(&self, device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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
        })
    }

    fn build_uni_bgl(&self, device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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
        })
    }

    fn build_mapping_frag_bgl(&self, device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("mapping_frag_bgl"),
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
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: wgpu::BufferSize::new(CONFIG_UNIFORM_BYTES),
                    },
                    count: None,
                },
            ],
        })
    }

    fn build_pipelines(
        &self,
        device: &wgpu::Device,
        adapter: &wgpu::Adapter,
        surface: &wgpu::Surface,
        tex_bgl: &wgpu::BindGroupLayout,
        uni_bgl: &wgpu::BindGroupLayout,
        mapping_frag_bgl: &wgpu::BindGroupLayout,
    ) -> (
        wgpu::RenderPipeline,
        HashMap<Mapping, wgpu::RenderPipeline>,
        wgpu::TextureFormat,
    ) {
        let quad_vs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("quad_vs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/quad_vs.wgsl").into()),
        });
        let blit_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("blit_fs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/blit_fs.wgsl").into()),
        });

        let blit_pipeline = {
            let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("blit"),
                bind_group_layouts: &[tex_bgl],
                push_constant_ranges: &[],
            });
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("blit"),
                layout: Some(&pl),
                vertex: wgpu::VertexState {
                    module: &quad_vs,
                    entry_point: Some("vs_main"),
                    buffers: &[],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &blit_fs,
                    entry_point: Some("fs_main"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: wgpu::TextureFormat::Rgba8UnormSrgb,
                        blend: Some(wgpu::BlendState::ALPHA_BLENDING),
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

        let vs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("present_vs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/present_vs.wgsl").into()),
        });

        let mut shaders = HashMap::new();
        shaders.insert(
            PathBuf::from("common.wgsl"),
            include_str!("shaders/common.wgsl").to_string(),
        );

        shaders.insert(
            PathBuf::from("palettized_fs.wgsl"),
            include_str!("shaders/palettized_fs.wgsl").to_string(),
        );

        let palettized_fs_code = preprocess(&shaders, "palettized_fs.wgsl").unwrap();

        let palettized_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("present_palettized_fs"),
            source: wgpu::ShaderSource::Wgsl(Cow::Owned(palettized_fs_code)),
        });

        shaders.insert(
            PathBuf::from("smoothed_fs.wgsl"),
            include_str!("shaders/smoothed_fs.wgsl").to_string(),
        );

        let smoothed_fs_code = preprocess(&shaders, "smoothed_fs.wgsl").unwrap();

        let smoothed_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("present_smoothed_fs"),
            source: wgpu::ShaderSource::Wgsl(Cow::Owned(smoothed_fs_code)),
        });

        let format = surface.get_capabilities(adapter).formats[0];

        let make = |fs: &wgpu::ShaderModule, mapping: Mapping| {
            let layout = [mapping_frag_bgl, uni_bgl];
            let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(&format!("present_{:?}_layout", mapping)),
                bind_group_layouts: &layout,
                push_constant_ranges: &[],
            });
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(&format!("present_{:?}_pipe", mapping)),
                layout: Some(&pl),
                vertex: wgpu::VertexState {
                    module: &vs,
                    entry_point: Some("vs_main"),
                    buffers: &[],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: fs,
                    entry_point: Some("fs_main"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format,
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

        let mut present_pipelines = HashMap::new();
        present_pipelines.insert(
            Mapping::Palettized,
            make(&palettized_fs, Mapping::Palettized),
        );
        present_pipelines.insert(Mapping::Smoothed, make(&smoothed_fs, Mapping::Smoothed));

        (blit_pipeline, present_pipelines, format.add_srgb_suffix())
    }
}
