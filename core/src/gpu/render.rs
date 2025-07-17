use super::utils::{get_gpu_instance, preprocess, GpuConfig, GpuInstance};
use crate::{Config, Filter, Mapping};
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::{ImageBitmap, OffscreenCanvas};

const PRESENT_UNIFORM_BYTES: u64 = 16; // two vec2<f32>
const RESIZE_UNIFORM_BYTES: u64 = 16; // two vec2<f32>
const CONFIG_UNIFORM_BYTES: u64 = std::mem::size_of::<GpuConfig>() as u64;

struct Canvas {
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
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
    pub resize_uni_bgl: wgpu::BindGroupLayout,
    pub mapping_frag_bgl: wgpu::BindGroupLayout,
    pub blue_noise_bgl: wgpu::BindGroupLayout,
    pub blue_noise_tex: wgpu::Texture,
    pub blit_pipeline: wgpu::RenderPipeline,
    pub resize_horizontal_pipelines: HashMap<Filter, wgpu::RenderPipeline>,
    pub resize_vertical_pipelines: HashMap<Filter, wgpu::RenderPipeline>,
    pub present_pipelines: HashMap<Mapping, wgpu::RenderPipeline>,
    pub present_fmt: wgpu::TextureFormat,

    pub full_tex: RwLock<Option<wgpu::Texture>>,
    pub resized_tex: RwLock<Option<wgpu::Texture>>,
    pub horizontal_pass_tex: RwLock<Option<wgpu::Texture>>,
    pub work_tex: RwLock<Option<wgpu::Texture>>,
    pub work_bg: RwLock<Option<wgpu::BindGroup>>,
    pub present_buf: RwLock<Option<wgpu::Buffer>>,
    pub config_buf: RwLock<Option<wgpu::Buffer>>,
}

#[wasm_bindgen]
pub struct Renderer {
    instance: Arc<GpuInstance>,

    context: Option<Arc<Context>>,
    context_cache: HashMap<String, Arc<Context>>,

    canvas: Option<Arc<Canvas>>,
    canvas_cache: HashMap<String, Arc<Canvas>>,

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
        log::info!("Registering canvas with id: {}", canvas_id);

        let raw_surface = self
            .instance
            .instance
            .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas.clone()))
            .map_err(|e| JsValue::from_str(&format!("surface: {:?}", e)))?;
        let surface: wgpu::Surface<'static> =
            unsafe { std::mem::transmute::<_, wgpu::Surface<'static>>(raw_surface) };

        // Context selection/creation
        let new_ctx: Arc<Context>;
        if self.instance.using_webgpu {
            // WebGPU: one global context, create if needed
            if let Some(ctx) = &self.context {
                new_ctx = ctx.clone();
            } else {
                new_ctx = Arc::new(self.create_context(&surface, &canvas_id).await?);
                self.context = Some(new_ctx.clone());
            }
        } else {
            // WebGL: per-canvas context
            new_ctx = Arc::new(self.create_context(&surface, &canvas_id).await?);
            self.context_cache
                .insert(canvas_id.clone(), new_ctx.clone());
        };

        let config = self.configure_surface(&new_ctx, &surface, &canvas);
        surface.configure(&new_ctx.device, &config);

        let canvas_handle = Arc::new(Canvas { surface, config });

        self.canvas_cache.insert(canvas_id, canvas_handle);

        Ok(())
    }

    pub fn switch_canvas(&mut self, canvas_id: &str) -> Result<(), JsValue> {
        let canvas = self
            .canvas_cache
            .get(canvas_id)
            .ok_or_else(|| JsValue::from_str("Canvas not found"))?
            .clone();
        log::info!("Switching to canvas with id: {}", canvas_id);

        if !self.instance.as_ref().using_webgpu {
            if let Some(new_ctx) = self.context_cache.get(canvas_id) {
                // For WebGL, we switch the active context. The new context's mutable
                // resources will initially be None, and will be created on the next draw.
                let is_switching_context = self
                    .context
                    .as_ref()
                    .map_or(true, |current_ctx| !Arc::ptr_eq(current_ctx, new_ctx));

                if is_switching_context {
                    log::info!("Switching WebGL context...");
                    self.context = Some(new_ctx.clone());
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

        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))?;

        // Check if full_tex exists and is valid before reuploading
        let full_tex_exists = {
            let full_tex_guard = ctx
                .full_tex
                .read()
                .map_err(|_| JsValue::from_str("Failed to read full_tex"))?;
            full_tex_guard.is_some()
        };

        if !full_tex_exists {
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
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))?;
        let full_tex_exists = {
            let full_tex_guard = ctx
                .full_tex
                .read()
                .map_err(|_| JsValue::from_str("Failed to read full_tex"))?;
            full_tex_guard.is_some()
        };
        if full_tex_exists {
            self.try_draw()?;
        }
        Ok(())
    }

    pub fn clear_current_canvas(&mut self) -> Result<(), JsValue> {
        let canvas = self.canvas.as_ref().ok_or("canvas missing")?;
        let context = self.context.as_ref().unwrap();

        let frame = canvas
            .surface
            .get_current_texture()
            .map_err(|e| JsValue::from_str(&format!("clear_current_canvas: {:?}", e)))?;

        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor {
            format: Some(context.present_fmt),
            ..Default::default()
        });

        let mut enc = context
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("clear_canvas_enc"),
            });

        {
            enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("clear_canvas_pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });
        }

        context.queue.submit(Some(enc.finish()));
        frame.present();

        self.last_bmp = None;

        *context
            .full_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear full_tex"))? = None;
        *context
            .resized_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear resized_tex"))? = None;
        *context
            .horizontal_pass_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear horizontal_pass_tex"))? = None;
        *context
            .work_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear work_tex"))? = None;
        *context
            .work_bg
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear work_bg"))? = None;
        *context
            .present_buf
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear present_buf"))? = None;
        *context
            .config_buf
            .write()
            .map_err(|_| JsValue::from_str("Failed to clear config_buf"))? = None;

        Ok(())
    }
}

impl Renderer {
    async fn create_context(
        &self,
        surface: &wgpu::Surface<'static>,
        canvas_id: &str,
    ) -> Result<Context, JsValue> {
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
                required_limits: wgpu::Limits {
                    // Sorry Firefox Android users...
                    // https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE
                    max_texture_dimension_2d: 8192,
                    max_texture_dimension_1d: 8192,
                    ..wgpu::Limits::downlevel_webgl2_defaults()
                },
                label: Some(canvas_id),
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
        let resize_uni_bgl = self.build_resize_uni_bgl(&device);
        let mapping_frag_bgl = self.build_mapping_frag_bgl(&device);
        let blue_noise_bgl = self.build_blue_noise_bgl(&device);

        let (
            blit_pipeline,
            resize_horizontal_pipelines,
            resize_vertical_pipelines,
            present_pipelines,
            present_fmt,
        ) = self.build_pipelines(
            &device,
            &adapter,
            surface,
            &tex_bgl,
            &uni_bgl,
            &resize_uni_bgl,
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
            resize_uni_bgl,
            mapping_frag_bgl,
            blue_noise_bgl,
            blue_noise_tex,
            blit_pipeline,
            resize_horizontal_pipelines,
            resize_vertical_pipelines,
            present_pipelines,
            present_fmt,
            full_tex: RwLock::new(None),
            resized_tex: RwLock::new(None),
            horizontal_pass_tex: RwLock::new(None),
            work_tex: RwLock::new(None),
            work_bg: RwLock::new(None),
            present_buf: RwLock::new(None),
            config_buf: RwLock::new(None),
        })
    }

    fn upload_full_texture(&mut self, bmp: &ImageBitmap) -> Result<(), JsValue> {
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))?;
        let (w, h) = (bmp.width() as u32, bmp.height() as u32);

        let mut full_tex_guard = ctx
            .full_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to acquire write lock for full_tex"))?;

        if full_tex_guard
            .as_ref()
            .map(|t| t.size().width != w || t.size().height != h)
            .unwrap_or(true)
        {
            *full_tex_guard = Some(
                ctx.device
                    .create_texture(&Self::linear_tex("full_tex", w, h)),
            );
        }

        ctx.queue.copy_external_image_to_texture(
            &wgpu::CopyExternalImageSourceInfo {
                source: wgpu::ExternalImageSource::ImageBitmap(bmp.clone()),
                origin: wgpu::Origin2d::ZERO,
                flip_y: false,
            },
            wgpu::CopyExternalImageDestInfo {
                texture: full_tex_guard.as_ref().unwrap(),
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
                color_space: wgpu::PredefinedColorSpace::Srgb,
                premultiplied_alpha: false,
            },
            full_tex_guard.as_ref().unwrap().size(),
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
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))
            .ok()?;
        let full_tex_guard = ctx
            .full_tex
            .read()
            .map_err(|_| JsValue::from_str("Failed to read full_tex"))
            .ok()?;
        let full = full_tex_guard.as_ref()?;
        Some(self.get_resize_dims(full.size().width, full.size().height))
    }

    fn desired_work_dims(&self) -> Option<(u32, u32)> {
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))
            .ok()?;
        let resized_tex_guard = ctx
            .resized_tex
            .read()
            .map_err(|_| JsValue::from_str("Failed to read resized_tex"))
            .ok()?;
        let resized = resized_tex_guard.as_ref()?;
        let canvas = self.canvas.as_ref().unwrap();
        let scale = (canvas.config.width as f32 / resized.size().width as f32)
            .min(canvas.config.height as f32 / resized.size().height as f32)
            .clamp(0.0, 1.0);
        Some((
            (resized.size().width as f32 * scale).max(1.0).round() as u32,
            (resized.size().height as f32 * scale).max(1.0).round() as u32,
        ))
    }

    fn ensure_work_tex_size(&mut self) -> Result<(), JsValue> {
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))?;

        let (resized_w, resized_h) = self
            .desired_resized_dims()
            .ok_or(JsValue::from_str("no full_tex in context"))?;

        let mut resized_tex_guard = ctx
            .resized_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to write resized_tex"))?;
        if resized_tex_guard
            .as_ref()
            .map(|t| t.size().width != resized_w || t.size().height != resized_h)
            .unwrap_or(true)
        {
            *resized_tex_guard = Some(ctx.device.create_texture(&Self::linear_tex(
                "resized_tex",
                resized_w,
                resized_h,
            )));

            let full_tex_size = ctx
                .full_tex
                .read()
                .map_err(|_| JsValue::from_str("Failed to read full_tex"))?
                .as_ref()
                .unwrap()
                .size();
            let mut horizontal_pass_tex_guard = ctx
                .horizontal_pass_tex
                .write()
                .map_err(|_| JsValue::from_str("Failed to write horizontal_pass_tex"))?;
            if horizontal_pass_tex_guard
                .as_ref()
                .map(|t| t.size().width != resized_w || t.size().height != full_tex_size.height)
                .unwrap_or(true)
            {
                *horizontal_pass_tex_guard = Some(ctx.device.create_texture(&Self::linear_tex(
                    "horizontal_pass_tex",
                    resized_w,
                    full_tex_size.height,
                )));
            }
        }
        drop(resized_tex_guard);

        let (work_w, work_h) = self
            .desired_work_dims()
            .ok_or(JsValue::from_str("no resized_tex in context"))?;

        let mut work_tex_guard = ctx
            .work_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to write work_tex"))?;
        if work_tex_guard
            .as_ref()
            .map(|t| t.size().width != work_w || t.size().height != work_h)
            .unwrap_or(true)
        {
            *work_tex_guard = Some(
                ctx.device
                    .create_texture(&Self::linear_tex("work_tex", work_w, work_h)),
            );
            let view = work_tex_guard
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            *ctx.work_bg
                .write()
                .map_err(|_| JsValue::from_str("Failed to write work_bg"))? =
                Some(ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("work_bg"),
                    layout: &ctx.tex_bgl,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::TextureView(&view),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: wgpu::BindingResource::Sampler(&ctx.sampler),
                        },
                    ],
                }));
        }
        Ok(())
    }

    fn blit_full_to_work(&mut self) -> Result<(), JsValue> {
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))?;
        let config = self.instance.config.read();

        let full_tex = ctx
            .full_tex
            .read()
            .map_err(|_| JsValue::from_str("Failed to read full_tex"))?
            .as_ref()
            .unwrap()
            .clone();
        let full_tex_size = full_tex.size();

        let (desired_resized_w, desired_resized_h) = self
            .desired_resized_dims()
            .ok_or(JsValue::from_str("no desired resized dims"))?;

        let skip_initial_resize =
            full_tex_size.width == desired_resized_w && full_tex_size.height == desired_resized_h;

        if skip_initial_resize {
            let src_view = full_tex.create_view(&Default::default());

            let resized_tex_guard = ctx
                .resized_tex
                .write()
                .map_err(|_| JsValue::from_str("Failed to write resized_tex"))?;
            let dst_view = resized_tex_guard
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            let dst_size = resized_tex_guard.as_ref().unwrap().size();
            drop(resized_tex_guard);

            let tmp_bg = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("full_to_resized_blit_bg"),
                layout: &ctx.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&src_view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&ctx.sampler),
                    },
                ],
            });

            let mut enc = ctx
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("full_to_resized_blit_enc"),
                });
            {
                let mut rpass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("full_to_resized_blit_pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &dst_view,
                        depth_slice: None,
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

                let resize_uniform_buf = ctx.device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("Full to Resized Blit Resize Uniform Buffer"),
                    size: RESIZE_UNIFORM_BYTES,
                    usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });

                let resize_data: [f32; 4] = [
                    full_tex_size.width as f32,
                    full_tex_size.height as f32,
                    dst_size.width as f32,
                    dst_size.height as f32,
                ];
                ctx.queue
                    .write_buffer(&resize_uniform_buf, 0, bytemuck::cast_slice(&resize_data));

                let resize_uni_bg = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("full_to_resized_blit_resize_uni_bg"),
                    layout: &ctx.resize_uni_bgl,
                    entries: &[wgpu::BindGroupEntry {
                        binding: 0,
                        resource: resize_uniform_buf.as_entire_binding(),
                    }],
                });

                rpass.set_pipeline(&ctx.blit_pipeline);
                rpass.set_bind_group(0, &tmp_bg, &[]);
                rpass.set_bind_group(1, &resize_uni_bg, &[]);
                rpass.draw(0..6, 0..1);
            }
            ctx.queue.submit(Some(enc.finish()));
        } else {
            // First pass: Blit from full_tex to horizontal_pass_tex with horizontal filter
            let src_view_h = full_tex.create_view(&Default::default());

            let horizontal_pass_tex_guard = ctx
                .horizontal_pass_tex
                .write()
                .map_err(|_| JsValue::from_str("Failed to write horizontal_pass_tex"))?;
            let dst_view_h = horizontal_pass_tex_guard
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            let horizontal_pass_tex_size = horizontal_pass_tex_guard.as_ref().unwrap().size();
            drop(horizontal_pass_tex_guard);

            let tmp_bg_h = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("resize_horizontal_bg"),
                layout: &ctx.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&src_view_h),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&ctx.sampler),
                    },
                ],
            });

            let resize_uniform_buf_h = ctx.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Resize Horizontal Uniform Buffer"),
                size: RESIZE_UNIFORM_BYTES,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });

            let resize_data_h: [f32; 4] = [
                full_tex_size.width as f32,
                full_tex_size.height as f32,
                horizontal_pass_tex_size.width as f32,
                horizontal_pass_tex_size.height as f32,
            ];
            ctx.queue.write_buffer(
                &resize_uniform_buf_h,
                0,
                bytemuck::cast_slice(&resize_data_h),
            );

            let resize_uni_bg_h = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("resize_horizontal_uni_bg"),
                layout: &ctx.resize_uni_bgl,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: resize_uniform_buf_h.as_entire_binding(),
                }],
            });

            let mut enc_h = ctx
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("resize_horizontal_enc"),
                });
            {
                let mut rpass_h = enc_h.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("resize_horizontal_pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &dst_view_h,
                        resolve_target: None,
                        depth_slice: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                });
                let resize_pipeline_h =
                    ctx.resize_horizontal_pipelines.get(&config.filter).unwrap();
                rpass_h.set_pipeline(resize_pipeline_h);
                rpass_h.set_bind_group(0, &tmp_bg_h, &[]);
                rpass_h.set_bind_group(1, &resize_uni_bg_h, &[]);
                rpass_h.draw(0..6, 0..1);
            }
            ctx.queue.submit(Some(enc_h.finish()));

            // Second pass: Blit from horizontal_pass_tex to resized_tex with vertical filter
            let horizontal_pass_tex = ctx
                .horizontal_pass_tex
                .read()
                .map_err(|_| JsValue::from_str("Failed to read horizontal_pass_tex"))?
                .as_ref()
                .unwrap()
                .clone();
            let src_view_v = horizontal_pass_tex.create_view(&Default::default());
            let resized_tex_guard = ctx
                .resized_tex
                .write()
                .map_err(|_| JsValue::from_str("Failed to write resized_tex"))?;
            let dst_view_v = resized_tex_guard
                .as_ref()
                .unwrap()
                .create_view(&Default::default());
            let resized_tex_size = resized_tex_guard.as_ref().unwrap().size();
            drop(resized_tex_guard);

            let tmp_bg_v = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("resize_vertical_bg"),
                layout: &ctx.tex_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&src_view_v),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&ctx.sampler),
                    },
                ],
            });

            let resize_uniform_buf_v = ctx.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Resize Vertical Uniform Buffer"),
                size: RESIZE_UNIFORM_BYTES,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });

            let resize_data_v: [f32; 4] = [
                horizontal_pass_tex_size.width as f32,
                horizontal_pass_tex_size.height as f32,
                resized_tex_size.width as f32,
                resized_tex_size.height as f32,
            ];
            ctx.queue.write_buffer(
                &resize_uniform_buf_v,
                0,
                bytemuck::cast_slice(&resize_data_v),
            );

            let resize_uni_bg_v = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("resize_vertical_uni_bg"),
                layout: &ctx.resize_uni_bgl,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: resize_uniform_buf_v.as_entire_binding(),
                }],
            });

            let mut enc_v = ctx
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("resize_vertical_enc"),
                });
            {
                let mut rpass_v = enc_v.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("resize_vertical_pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &dst_view_v,
                        resolve_target: None,
                        depth_slice: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                });
                let resize_pipeline_v = ctx.resize_vertical_pipelines.get(&config.filter).unwrap();
                rpass_v.set_pipeline(resize_pipeline_v);
                rpass_v.set_bind_group(0, &tmp_bg_v, &[]);
                rpass_v.set_bind_group(1, &resize_uni_bg_v, &[]);
                rpass_v.draw(0..6, 0..1);
            }
            ctx.queue.submit(Some(enc_v.finish()));
        }

        let resized_tex = ctx
            .resized_tex
            .read()
            .map_err(|_| JsValue::from_str("Failed to read resized_tex"))?
            .as_ref()
            .unwrap()
            .clone();
        let src_view = resized_tex.create_view(&Default::default());

        let work_tex_guard = ctx
            .work_tex
            .write()
            .map_err(|_| JsValue::from_str("Failed to write work_tex"))?;
        let dst_view = work_tex_guard
            .as_ref()
            .unwrap()
            .create_view(&Default::default());
        let dst_size = work_tex_guard.as_ref().unwrap().size();
        drop(work_tex_guard);

        let tmp_bg = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("work_blit_bg"),
            layout: &ctx.tex_bgl,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&src_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&ctx.sampler),
                },
            ],
        });

        let mut enc = ctx
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("work_blit_enc"),
            });
        {
            let mut rpass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("work_blit_pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &dst_view,
                    depth_slice: None,
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
            let src_size = resized_tex.size();

            let resize_uniform_buf = ctx.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Work Blit Resize Uniform Buffer"),
                size: RESIZE_UNIFORM_BYTES,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });

            let resize_data: [f32; 4] = [
                src_size.width as f32,
                src_size.height as f32,
                dst_size.width as f32,
                dst_size.height as f32,
            ];
            ctx.queue
                .write_buffer(&resize_uniform_buf, 0, bytemuck::cast_slice(&resize_data));

            let resize_uni_bg = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("work_blit_resize_uni_bg"),
                layout: &ctx.resize_uni_bgl,
                entries: &[wgpu::BindGroupEntry {
                    binding: 0,
                    resource: resize_uniform_buf.as_entire_binding(),
                }],
            });

            rpass.set_pipeline(&ctx.blit_pipeline);
            rpass.set_bind_group(0, &tmp_bg, &[]);
            rpass.set_bind_group(1, &resize_uni_bg, &[]);
            rpass.draw(0..6, 0..1);
        }
        ctx.queue.submit(Some(enc.finish()));

        Ok(())
    }

    fn present(&mut self) -> Result<(), JsValue> {
        let canvas = self.canvas.as_ref().ok_or("canvas missing")?;
        let ctx = self
            .context
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No active context"))?;

        let work_tex = ctx
            .work_tex
            .read()
            .map_err(|_| JsValue::from_str("Failed to read work_tex"))?
            .as_ref()
            .ok_or("work_tex missing in context")?
            .clone();

        let (img_w, img_h) = { (work_tex.size().width as f32, work_tex.size().height as f32) };
        let (can_w, can_h) = (canvas.config.width as f32, canvas.config.height as f32);

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

        let mut present_buf_guard = ctx
            .present_buf
            .write()
            .map_err(|_| JsValue::from_str("Failed to write present_buf"))?;
        if present_buf_guard.is_none() {
            *present_buf_guard = Some(ctx.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("present_buf"),
                size: PRESENT_UNIFORM_BYTES,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            }));
        }
        let data: [f32; 4] = [scale[0], scale[1], offset[0], offset[1]];
        ctx.queue.write_buffer(
            present_buf_guard.as_ref().unwrap(),
            0,
            bytemuck::cast_slice(&data),
        );
        drop(present_buf_guard);

        let present_buf = ctx
            .present_buf
            .read()
            .map_err(|_| JsValue::from_str("Failed to read present_buf"))?
            .as_ref()
            .unwrap()
            .clone();
        let uni_bg = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("uni_bg"),
            layout: &ctx.uni_bgl,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                    buffer: &present_buf,
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

                let mut config_buf_guard = ctx
                    .config_buf
                    .write()
                    .map_err(|_| JsValue::from_str("Failed to write config_buf"))?;
                if config_buf_guard.is_none() {
                    *config_buf_guard = Some(ctx.device.create_buffer(&wgpu::BufferDescriptor {
                        label: Some("config_buf"),
                        size: CONFIG_UNIFORM_BYTES,
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                        mapped_at_creation: false,
                    }));
                }
                ctx.queue.write_buffer(
                    config_buf_guard.as_ref().unwrap(),
                    0,
                    bytemuck::cast_slice(&[gpu_config_data]),
                );
                drop(config_buf_guard);

                let config_buf = ctx
                    .config_buf
                    .read()
                    .map_err(|_| JsValue::from_str("Failed to read config_buf"))?
                    .as_ref()
                    .unwrap()
                    .clone();

                Some(ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: Some("mapping_frag_bg"),
                    layout: &ctx.mapping_frag_bgl,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: wgpu::BindingResource::Sampler(&ctx.sampler),
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
                                buffer: &config_buf,
                                offset: 0,
                                size: wgpu::BufferSize::new(CONFIG_UNIFORM_BYTES),
                            }),
                        },
                    ],
                }))
            }
        };

        let blue_noise_bg_to_use: Option<wgpu::BindGroup> = if mapping == Mapping::Palettized {
            Some(ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("blue_noise_bg"),
                layout: &ctx.blue_noise_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(
                            &ctx.blue_noise_tex.create_view(&Default::default()),
                        ),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&ctx.nearest_sampler),
                    },
                ],
            }))
        } else {
            None
        };

        let frame = canvas
            .surface
            .get_current_texture()
            .map_err(|e| JsValue::from_str(&format!("frame: {:?}", e)))?;

        let view = frame.texture.create_view(&wgpu::TextureViewDescriptor {
            format: Some(ctx.present_fmt),
            ..Default::default()
        });

        let mut enc = ctx
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
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });

            let pipe = ctx.present_pipelines.get(&mapping).unwrap();
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

        ctx.queue.submit(Some(enc.finish()));
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

    fn build_resize_uni_bgl(&self, device: &wgpu::Device) -> wgpu::BindGroupLayout {
        device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("resize_uniform_bgl"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: wgpu::BufferSize::new(RESIZE_UNIFORM_BYTES),
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
        resize_uni_bgl: &wgpu::BindGroupLayout,
        mapping_frag_bgl: &wgpu::BindGroupLayout,
        blue_noise_bgl: &wgpu::BindGroupLayout,
    ) -> (
        wgpu::RenderPipeline,
        HashMap<Filter, wgpu::RenderPipeline>,
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

        let nearest_horizontal_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("nearest_horizontal_fs"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("shaders/resize/nearest_horizontal.wgsl").into(),
            ),
        });

        let nearest_vertical_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("nearest_vertical_fs"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("shaders/resize/nearest_vertical.wgsl").into(),
            ),
        });

        let triangle_horizontal_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("triangle_horizontal_fs"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("shaders/resize/triangle_horizontal.wgsl").into(),
            ),
        });

        let triangle_vertical_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("triangle_vertical_fs"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("shaders/resize/triangle_vertical.wgsl").into(),
            ),
        });

        let lanczos_horizontal_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("lanczos_horizontal_fs"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("shaders/resize/lanczos_horizontal.wgsl").into(),
            ),
        });

        let lanczos_vertical_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("lanczos_vertical_fs"),
            source: wgpu::ShaderSource::Wgsl(
                include_str!("shaders/resize/lanczos_vertical.wgsl").into(),
            ),
        });

        let blit_fs = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("blit_fs"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/blit.wgsl").into()),
        });

        let blit_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("blit_pipe"),
            layout: Some(
                &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("blit_layout"),
                    bind_group_layouts: &[tex_bgl, resize_uni_bgl],
                    push_constant_ranges: &[],
                }),
            ),
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
        });

        let make_resize_pipeline = |fs: &wgpu::ShaderModule, filter: Filter, direction: &str| {
            let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(&format!("resize_{:?}_{}_layout", filter, direction)),
                bind_group_layouts: &[tex_bgl, resize_uni_bgl],
                push_constant_ranges: &[],
            });
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(&format!("resize_{:?}_{}_pipe", filter, direction)),
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

        let mut resize_horizontal_pipelines = HashMap::new();
        resize_horizontal_pipelines.insert(
            Filter::Nearest,
            make_resize_pipeline(&nearest_horizontal_fs, Filter::Nearest, "horizontal"),
        );
        resize_horizontal_pipelines.insert(
            Filter::Triangle,
            make_resize_pipeline(&triangle_horizontal_fs, Filter::Triangle, "horizontal"),
        );
        resize_horizontal_pipelines.insert(
            Filter::Lanczos3,
            make_resize_pipeline(&lanczos_horizontal_fs, Filter::Lanczos3, "horizontal"),
        );

        let mut resize_vertical_pipelines = HashMap::new();
        resize_vertical_pipelines.insert(
            Filter::Nearest,
            make_resize_pipeline(&nearest_vertical_fs, Filter::Nearest, "vertical"),
        );
        resize_vertical_pipelines.insert(
            Filter::Triangle,
            make_resize_pipeline(&triangle_vertical_fs, Filter::Triangle, "vertical"),
        );
        resize_vertical_pipelines.insert(
            Filter::Lanczos3,
            make_resize_pipeline(&lanczos_vertical_fs, Filter::Lanczos3, "vertical"),
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
            blit_pipeline,
            resize_horizontal_pipelines,
            resize_vertical_pipelines,
            present_pipelines,
            present_render_target_format,
        )
    }
}
