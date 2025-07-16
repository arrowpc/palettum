use super::utils::{get_gpu_instance, preprocess, GpuConfig, GpuInstance};
use crate::{Config, Filter, Mapping};
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
    pub nearest_sampler: wgpu::Sampler,
    pub tex_bgl: wgpu::BindGroupLayout,
    pub uni_bgl: wgpu::BindGroupLayout,
    pub mapping_frag_bgl: wgpu::BindGroupLayout,
    pub blue_noise_bgl: wgpu::BindGroupLayout,
    pub blue_noise_tex: wgpu::Texture,
    pub resize_pipelines: HashMap<Filter, wgpu::RenderPipeline>,
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
    resized_tex: Option<wgpu::Texture>,
    work_tex: Option<wgpu::Texture>,
    work_bg: Option<wgpu::BindGroup>,

    present_buf: Option<wgpu::Buffer>,
    config_buf: Option<wgpu::Buffer>,

    resize_mode: ResizeMode,

    last_bmp: Option<ImageBitmap>,
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
            resized_tex: None,
            work_tex: None,
            work_bg: None,
            present_buf: None,
            config_buf: None,
            resize_mode: ResizeMode::default(),
            last_bmp: None,
        }
    }

    pub async fn register_canvas(
        &mut self,
        canvas_id: String,
        canvas: OffscreenCanvas,
    ) -> Result<(), JsValue> {
        if self.canvas_cache.contains_key(&canvas_id) {
            log::warn!(
                "A canvas with id: {} has already been registered",
                canvas_id
            );
            return Ok(());
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
            if self.context.is_some() {
                log::debug!(
                    "New canvas registration is replacing an old context. Invalidating resources."
                );
                self.full_tex = None;
                self.work_tex = None;
                self.work_bg = None;
                self.present_buf = None;
                self.config_buf = None;
            }
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

        if !self.instance.as_ref().using_webgpu {
            if let Some(new_ctx) = self.context_cache.get(canvas_id) {
                let is_switching_context = self
                    .context
                    .as_ref()
                    .map_or(true, |current_ctx| !Arc::ptr_eq(current_ctx, new_ctx));

                if is_switching_context {
                    log::info!("Switching WebGL context, invalidating GPU resources.");
                    self.context = Some(new_ctx.clone());

                    self.full_tex = None;
                    self.work_tex = None;
                    self.work_bg = None;
                    self.present_buf = None;
                    self.config_buf = None;
                }
            } else {
                return Err(JsValue::from_str("Context for canvas not found"));
            }
        }

        self.canvas = Some(canvas);

        if self.last_bmp.is_some() {
            self.try_draw()?;
        }
        Ok(())
    }

    pub fn drop_canvas(&mut self, canvas_id: &str) -> Result<(), JsValue> {
        self.canvas_cache
            .remove(canvas_id)
            .ok_or_else(|| JsValue::from_str("Could not find canvas in registry to drop"))?;
        Ok(())
    }

    pub fn draw(&mut self, bmp: ImageBitmap) -> Result<(), JsValue> {
        self.last_bmp = Some(bmp.clone());
        self.upload_full_texture(&bmp)?;
        self.ensure_work_tex_size()?;
        self.blit_full_to_work()?;
        self.present()
    }

    pub fn try_draw(&mut self) -> Result<(), JsValue> {
        if self.last_bmp.is_none() {
            log::warn!("draw() has not been called yet");
            return Ok(());
        }
        let bitmap = self.last_bmp.as_ref().unwrap().clone();
        if bitmap.width() == 0 || bitmap.height() == 0 {
            return Err(JsValue::from_str(
                "last bitmap is invalid (closed or zero size)",
            ));
        }
        if self.full_tex.is_none() {
            self.upload_full_texture(&bitmap)?;
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
        *self.instance.config.write() = config;
        if self.full_tex.is_some() {
            self.try_draw()?;
        }
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

        let blue_noise_size = wgpu::Extent3d {
            width: 64,
            height: 64,
            depth_or_array_layers: 1,
        };
        let blue_noise_tex = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("blue_noise_tex"),
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
                texture: &blue_noise_tex,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &crate::palettized::BLUE_NOISE_64X64,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(64),
                rows_per_image: None,
            },
            blue_noise_size,
        );

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("linear_sampler"),
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let nearest_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("nearest_sampler"),
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        let tex_bgl = self.build_tex_bgl(&device);
        let uni_bgl = self.build_uni_bgl(&device);
        let mapping_frag_bgl = self.build_mapping_frag_bgl(&device);
        let blue_noise_bgl = self.build_blue_noise_bgl(&device);

        let (resize_pipelines, present_pipelines, present_fmt) = self
            .build_pipelines(
                &device,
                &adapter,
                surface,
                &tex_bgl,
                &uni_bgl,
                &mapping_frag_bgl,
                &blue_noise_bgl,
            );

        Ok(Context {
            adapter,
            device,
            queue,
            sampler,
            nearest_sampler,
            tex_bgl,
            uni_bgl,
            mapping_frag_bgl,
            blue_noise_bgl,
            blue_noise_tex,
            resize_pipelines,
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

    fn get_resize_dims(&self, full_w: u32, full_h: u32) -> (u32, u32) {
        let config = self.instance.config.read();
        let mut new_w = full_w;
        let mut new_h = full_h;

        if let Some(width) = config.resize_width {
            new_w = width;
        }
        if let Some(height) = config.resize_height {
            new_h = height;
        }
        if let Some(scale) = config.resize_scale {
            new_w = (full_w as f32 * scale).round() as u32;
            new_h = (full_h as f32 * scale).round() as u32;
        }

        (new_w.max(1), new_h.max(1))
    }

    fn desired_resized_dims(&self) -> Option<(u32, u32)> {
        let full = self.full_tex.as_ref().unwrap();
        Some(self.get_resize_dims(full.size().width, full.size().height))
    }

    fn desired_work_dims(&self) -> Option<(u32, u32)> {
        let resized = self.resized_tex.as_ref().unwrap();
        let ctx = self.canvas.as_ref().unwrap();
        let scale = (ctx.config.width as f32 / resized.size().width as f32)
            .min(ctx.config.height as f32 / resized.size().height as f32)
            .clamp(0.0, 1.0);
        Some((
            (resized.size().width as f32 * scale).max(1.0).round() as u32,
            (resized.size().height as f32 * scale).max(1.0).round() as u32,
        ))
    }

    fn ensure_work_tex_size(&mut self) -> Result<(), JsValue> {
        let (resized_w, resized_h) = self
            .desired_resized_dims()
            .ok_or(JsValue::from_str("no full_tex"))?;

        if self
            .resized_tex
            .as_ref()
            .map(|t| t.size().width != resized_w || t.size().height != resized_h)
            .unwrap_or(true)
        {
            let context = self.context.as_ref().unwrap();
            self.resized_tex = Some(context.device.create_texture(&Self::linear_tex(
                "resized_tex",
                resized_w,
                resized_h,
            )));
        }

        let (work_w, work_h) = self
            .desired_work_dims()
            .ok_or(JsValue::from_str("no resized_tex"))?;

        if self
            .work_tex
            .as_ref()
            .map(|t| t.size().width != work_w || t.size().height != work_h)
            .unwrap_or(true)
        {
            let context = self.context.as_ref().unwrap();
            self.work_tex = Some(
                context
                    .device
                    .create_texture(&Self::linear_tex("work_tex", work_w, work_h)),
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
                                resource: wgpu::BindingResource::TextureView(&view),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::Sampler(&context.sampler),
                            },
                        ],
                    }),
            );
        }
        Ok(())
    }

    fn blit_full_to_work(&mut self) -> Result<(), JsValue> {
        let context = self.context.as_ref().unwrap();
        let config = self.instance.config.read();

        // Blit from full_tex to resized_tex with selected filter
        let src_view = self
            .full_tex
            .as_ref()
            .unwrap()
            .create_view(&Default::default());
        let dst_view = self
            .resized_tex
            .as_ref()
            .unwrap()
            .create_view(&Default::default());

        let tmp_bg = context
            .device
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("resize_bg"),
                layout: &context.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&context.sampler),
                    },
                ],
            });

        let mut enc = context
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("resize_enc"),
            });
        {
            let mut rpass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("resize_pass"),
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
            let resize_pipeline = context.resize_pipelines.get(&config.filter).unwrap();
            rpass.set_pipeline(resize_pipeline);
            rpass.set_bind_group(0, &tmp_bg, &[]);
            rpass.draw(0..6, 0..1);
        }
        context.queue.submit(Some(enc.finish()));

        // Blit from resized_tex to work_tex
        let src_view = self
            .resized_tex
            .as_ref()
            .unwrap()
            .create_view(&Default::default());
        let dst_view = self
            .work_tex
            .as_ref()
            .unwrap()
            .create_view(&Default::default());

        let tmp_bg = context
            .device
            .create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("work_blit_bg"),
                layout: &context.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&context.sampler),
                    },
                ],
            });

        let mut enc = context
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("work_blit_enc"),
            });
        {
            let mut rpass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("work_blit_pass"),
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
            rpass.set_pipeline(context.resize_pipelines.get(&Filter::Nearest).unwrap());
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

        let config = self.instance.config.read();
        let mapping = config.mapping;

        let mapping_frag_bg_to_use: Option<wgpu::BindGroup> = match mapping {
            Mapping::Smoothed | Mapping::Palettized => {
                let gpu_config_data =
                    GpuConfig::from_config(&config, work_tex.size().width, work_tex.size().height);

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

        let blue_noise_bg_to_use: Option<wgpu::BindGroup> = if mapping == Mapping::Palettized {
            Some(
                context
                    .device
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("blue_noise_bg"),
                        layout: &context.blue_noise_bgl,
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::TextureView(
                                    &context.blue_noise_tex.create_view(&Default::default()),
                                ),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::Sampler(&context.nearest_sampler),
                            },
                        ],
                    }),
            )
        } else {
            None
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

            if let Some(bg) = blue_noise_bg_to_use.as_ref() {
                rpass.set_bind_group(2, bg, &[]);
            }

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
            format,
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
                    ty: wgpu::BindingType::Texture {
                        multisampled: false,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
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

    fn build_blue_noise_bgl(&self, device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("blue_noise_bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        multisampled: false,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
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
        blue_noise_bgl: &wgpu::BindGroupLayout,
    ) -> (
        HashMap<Filter, wgpu::RenderPipeline>,
        HashMap<Mapping, wgpu::RenderPipeline>,
        wgpu::TextureFormat,
    ) {
        let quad_vs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("quad_vs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/quad_vs.wgsl").into()),
        });
        

        let base_surface_format = surface.get_capabilities(adapter).formats[0];
        let present_render_target_format = base_surface_format.add_srgb_suffix();

        

        let nearest_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("nearest_fs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/resize/nearest.wgsl").into()),
        });

        let triangle_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("triangle_fs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/resize/triangle.wgsl").into()),
        });

        let lanczos_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("lanczos_fs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/resize/lanczos.wgsl").into()),
        });

        let make_resize_pipeline = |fs: &wgpu::ShaderModule, filter: Filter| {
            let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(&format!("resize_{:?}_layout", filter)),
                bind_group_layouts: &[tex_bgl],
                push_constant_ranges: &[],
            });
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(&format!("resize_{:?}_pipe", filter)),
                layout: Some(&pl),
                vertex: wgpu::VertexState {
                    module: &quad_vs,
                    entry_point: Some("vs_main"),
                    buffers: &[],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: fs,
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

        let mut resize_pipelines = HashMap::new();
        resize_pipelines.insert(
            Filter::Nearest,
            make_resize_pipeline(&nearest_fs, Filter::Nearest),
        );
        resize_pipelines.insert(
            Filter::Triangle,
            make_resize_pipeline(&triangle_fs, Filter::Triangle),
        );
        resize_pipelines.insert(
            Filter::Lanczos3,
            make_resize_pipeline(&lanczos_fs, Filter::Lanczos3),
        );

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

        let make = |fs: &wgpu::ShaderModule, mapping: Mapping| {
            let mut layout = vec![mapping_frag_bgl, uni_bgl];
            if mapping == Mapping::Palettized {
                layout.push(blue_noise_bgl);
            }

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
                        format: present_render_target_format,
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

        let mut present_pipelines = HashMap::new();
        present_pipelines.insert(
            Mapping::Palettized,
            make(&palettized_fs, Mapping::Palettized),
        );
        present_pipelines.insert(Mapping::Smoothed, make(&smoothed_fs, Mapping::Smoothed));

        (
            resize_pipelines,
            present_pipelines,
            present_render_target_format,
        )
    }
}
