use std::{collections::HashMap, sync::Arc};

use wasm_bindgen::prelude::*;
use web_sys::{ImageBitmap, OffscreenCanvas};

use crate::{config::Config, Mapping};

use super::context::GpuContext;
use super::compute::GpuConfig;

const PRESENT_UNIFORM_BYTES: u64 = 16; // two vec2<f32>
const CONFIG_UNIFORM_BYTES: u64 = std::mem::size_of::<GpuConfig>() as u64;

#[derive(Debug, Clone, Copy, PartialEq, Default)]
enum DrawMode {
    #[default]
    Fit,
    Fill,
    Stretch,
}

struct CanvasCtx {
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
}

// ==============================================================
// ===============  PUBLIC  WASM  API  ==========================
// ==============================================================
#[wasm_bindgen]
pub struct Renderer {
    context: Arc<GpuContext>,
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

    // Render pipelines and layouts
    sampler: wgpu::Sampler,
    tex_bgl: wgpu::BindGroupLayout,
    uni_bgl: wgpu::BindGroupLayout,
    mapping_frag_bgl: wgpu::BindGroupLayout,
    blit_pipeline: wgpu::RenderPipeline,
    present_pipelines: HashMap<Mapping, wgpu::RenderPipeline>,
    present_fmt: Option<wgpu::TextureFormat>,
}

#[wasm_bindgen]
impl Renderer {
    #[wasm_bindgen(constructor)]
    pub async fn new() -> Renderer {
        let context = super::context::get_gpu_context().await.expect("Failed to get GPU context");
        // common objects ----------------------------------------------------
        let sampler = context.device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("linear_sampler"),
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let tex_bgl = context
            .device
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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

        let uni_bgl = context
            .device
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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

        let mapping_frag_bgl = context
            .device
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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
        let quad_vs = context
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("quad_vs"),
                source: wgpu::ShaderSource::Wgsl(include_str!("shaders/quad_vs.wgsl").into()),
            });
        let blit_fs = context
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
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
            let pl = context
                .device
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some(label),
                    bind_group_layouts: layout,
                    push_constant_ranges: &[],
                });
            context
                .device
                .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
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

        let blit_pipeline = make_pipe(
            &quad_vs,
            &blit_fs,
            &[&tex_bgl],
            wgpu::TextureFormat::Rgba8Unorm,
            "blit",
        );

        Renderer {
            context,
            canvas: None,
            full_tex: None,
            work_tex: None,
            work_bg: None,
            uniform_buf: None,
            config_buf: None,
            last_bitmap: None,
            draw_mode: DrawMode::default(),
            config: None,
            sampler,
            tex_bgl,
            uni_bgl,
            mapping_frag_bgl,
            blit_pipeline,
            present_pipelines: HashMap::new(),
            present_fmt: None,
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
            .context
            .instance
            .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas.clone()))
            .map_err(|e| JsValue::from_str(&format!("surface: {:?}", e)))?;
        // extend lifetime
        let surface: wgpu::Surface<'static> =
            unsafe { std::mem::transmute::<_, wgpu::Surface<'static>>(raw_surface) };

        // configure swap-chain
        let caps = surface.get_capabilities(&self.context.adapter);
        let mut fmt = caps.formats[0];
        for &f in caps.formats.iter() {
            if f == wgpu::TextureFormat::Rgba8Unorm {
                fmt = f;
                break;
            }
        }

        let mut alpha_mode = wgpu::CompositeAlphaMode::Opaque;
        if self.context.using_webgpu {
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
        surface.configure(&self.context.device, &config);

        if self.present_fmt.is_none() {
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
        let (w, h) = (bmp.width() as u32, bmp.height() as u32);
        if self
            .full_tex
            .as_ref()
            .map(|t| t.size().width != w || t.size().height != h)
            .unwrap_or(true)
        {
            self.full_tex = Some(
                self.context
                    .device
                    .create_texture(&Self::linear_tex("full_tex", w, h)),
            );
        }

        self.context.queue.copy_external_image_to_texture(
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
                self.context
                    .device
                    .create_texture(&Self::linear_tex("work_tex", w, h)),
            );
            let view = self
                .work_tex
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            self.work_bg = Some(
                self.context
                    .device
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("work_bg"),
                        layout: &self.tex_bgl,
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::Sampler(&self.sampler),
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

    //----------------------------- blit -------------------------
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

        let tmp_bg = self
            .context
            .device
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("blit_bg"),
                layout: &self.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::Sampler(&self.sampler),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                ],
            });

        let mut enc = self
            .context
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
            rpass.set_pipeline(&self.blit_pipeline);
            rpass.set_bind_group(0, &tmp_bg, &[]);
            rpass.draw(0..6, 0..1);
        }
        self.context.queue.submit(Some(enc.finish()));

        Ok(())
    }

    //---------------------------- present -----------------------
    fn present(&mut self) -> Result<(), JsValue> {
        let ctx = self.canvas.as_ref().ok_or("canvas missing")?;
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
            self.uniform_buf = Some(
                self.context
                    .device
                    .create_buffer(&wgpu::BufferDescriptor {
                        label: Some("uniform_buf"),
                        size: PRESENT_UNIFORM_BYTES,
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                        mapped_at_creation: false,
                    }),
            );
        }
        let data: [f32; 4] = [scale[0], scale[1], offset[0], offset[1]];
        self.context.queue.write_buffer(
            self.uniform_buf.as_ref().unwrap(),
            0,
            bytemuck::cast_slice(&data),
        );

        let uni_bg = self
            .context
            .device
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("uni_bg"),
                layout: &self.uni_bgl,
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
                    self.config_buf = Some(
                        self.context
                            .device
                            .create_buffer(&wgpu::BufferDescriptor {
                                label: Some("config_buf"),
                                size: CONFIG_UNIFORM_BYTES,
                                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                                mapped_at_creation: false,
                            }),
                    );
                }
                self.context.queue.write_buffer(
                    self.config_buf.as_ref().unwrap(),
                    0,
                    bytemuck::cast_slice(&[gpu_config_data]),
                );

                Some(
                    self.context
                        .device
                        .create_bind_group(&wgpu::BindGroupDescriptor {
                            label: Some("mapping_frag_bg"),
                            layout: &self.mapping_frag_bgl, // Use the new layout
                            entries: &[
                                wgpu::BindGroupEntry {
                                    binding: 0,
                                    resource: wgpu::BindingResource::Sampler(&self.sampler),
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

        let mut enc = self
            .context
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

            let pipe = self.present_pipelines.get(&mapping).unwrap();
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

        self.context.queue.submit(Some(enc.finish()));
        frame.present();
        Ok(())
    }

    //------------------------------------------------------------------
    // helper: build (or rebuild) all present pipelines for a format
    //------------------------------------------------------------------
    fn build_present_pipelines(&mut self, fmt: wgpu::TextureFormat) {
        let vs = self
            .context
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("present_vs"),
                source: wgpu::ShaderSource::Wgsl(
                    include_str!("shaders/present_vs.wgsl").into(),
                ),
            });

        // palettized
        let palettized_fs = self
            .context
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("present_palettized_fs"),
                source: wgpu::ShaderSource::Wgsl(
                    include_str!("shaders/palettized_fs.wgsl").into(),
                ),
            });

        // smoothed
        let smoothed_fs = self
            .context
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
            let layout = [group0_bgl, &self.uni_bgl];
            let pl = self
                .context
                .device
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some(&format!("present_{:?}_layout", mapping)),
                    bind_group_layouts: &layout,
                    push_constant_ranges: &[],
                });
            self.context
                .device
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

        self.present_pipelines.insert(
            Mapping::Palettized,
            make(
                &vs,
                &palettized_fs,
                &self.mapping_frag_bgl,
                Mapping::Palettized,
            ),
        );

        self.present_pipelines.insert(
            Mapping::Smoothed,
            make(
                &vs,
                &smoothed_fs,
                &self.mapping_frag_bgl, // Group 0 for Smoothed
                Mapping::Smoothed,
            ),
        );

        self.present_fmt = Some(fmt);
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
