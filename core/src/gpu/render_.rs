use super::compute::GpuConfig;
use crate::{Config, Mapping};
use std::collections::HashMap;
use std::sync::Arc;
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

pub struct Renderer {
    instance: Arc<wgpu::Instance>,
    using_webgpu: bool,

    context: Option<Arc<Context>>,
    context_cache: HashMap<String, Arc<Context>>,

    canvas: Option<Arc<Canvas>>,
    canvas_cache: HashMap<String, Arc<Canvas>>,

    full_tex: Option<wgpu::Texture>,
    work_tex: Option<wgpu::Texture>,

    present_buf: Option<wgpu::Buffer>,
    config_buf: Option<wgpu::Buffer>,

    config: Option<Config>,
    resize_mode: ResizeMode,
}

impl Renderer {
    // r = await Renderer();
    // r.register_canvas(canvas_id, offscreen_canvas);
    // r.switch_canvas(canvas_id);
    // r.drop_canavs(canvas_id);
    //     //

    pub async fn new() {
        // set instance
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

        let raw_surface = self
            .instance
            .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas.clone()))
            .map_err(|e| JsValue::from_str(&format!("surface: {:?}", e)))?;
        let surface: wgpu::Surface<'static> =
            unsafe { std::mem::transmute::<_, wgpu::Surface<'static>>(raw_surface) };

        // Context selection/creation
        let context = if self.using_webgpu {
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
            ctx
        };

        let config = configure_surface(&context, &surface, &canvas, self.using_webgpu);
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
        if !self.using_webgpu {
            if let Some(ctx) = self.context_cache.get(canvas_id) {
                self.context = Some(ctx.clone());
            } else {
                return Err(JsValue::from_str("Context for canvas not found"));
            }
        }

        self.canvas = Some(canvas);

        self.try_draw();
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

    async fn create_context(&self, surface: &wgpu::Surface<'static>) -> Result<Context, JsValue> {
        let adapter = self
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

        let tex_bgl = build_tex_bgl(&device);
        let uni_bgl = build_uni_bgl(&device);
        let mapping_frag_bgl = build_mapping_frag_bgl(&device);

        let (blit_pipeline, present_pipelines, present_fmt) = build_pipelines(
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
}

fn configure_surface(
    ctx: &Arc<Context>,
    surface: &wgpu::Surface,
    canvas: &OffscreenCanvas,
    using_webgpu: bool,
) -> wgpu::SurfaceConfiguration {
    let caps = surface.get_capabilities(&ctx.adapter);
    let format = caps.formats[0];

    let alpha_mode = if using_webgpu {
        wgpu::CompositeAlphaMode::PreMultiplied
    } else {
        wgpu::CompositeAlphaMode::Opaque
    };

    wgpu::SurfaceConfiguration {
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        format: format.remove_srgb_suffix(),
        width: canvas.width(),
        height: canvas.height(),
        present_mode: wgpu::PresentMode::Fifo,
        alpha_mode,
        view_formats: vec![format.add_srgb_suffix()],
        desired_maximum_frame_latency: 2,
    }
}

fn build_tex_bgl(device: &wgpu::Device) -> wgpu::BindGroupLayout {
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

fn build_uni_bgl(device: &wgpu::Device) -> wgpu::BindGroupLayout {
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

fn build_mapping_frag_bgl(device: &wgpu::Device) -> wgpu::BindGroupLayout {
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

    let palettized_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("present_palettized_fs"),
        source: wgpu::ShaderSource::Wgsl(include_str!("shaders/palettized_fs.wgsl").into()),
    });

    let smoothed_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("present_smoothed_fs"),
        source: wgpu::ShaderSource::Wgsl(include_str!("shaders/smoothed_fs.wgsl").into()),
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
