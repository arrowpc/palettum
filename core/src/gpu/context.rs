use crate::error::Result;
use std::sync::Arc;

#[cfg(not(target_arch = "wasm32"))]
use async_once_cell::OnceCell;
#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;

pub struct GpuContext {
    pub instance: wgpu::Instance,
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub using_webgpu: bool,
}

impl GpuContext {
    pub async fn new() -> Result<Self> {
        #[cfg(target_arch = "wasm32")]
        let using_webgpu = wgpu::util::is_browser_webgpu_supported().await;
        #[cfg(not(target_arch = "wasm32"))]
        let using_webgpu = false;

        let instance = if using_webgpu {
            wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::BROWSER_WEBGPU,
                ..Default::default()
            })
        } else {
            wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: wgpu::Backends::all(),
                ..Default::default()
            })
        };

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None, // No surface yet, will be set later by renderer
                force_fallback_adapter: false,
            })
            .await
            .or_else(|_| {
                Err(crate::error::Error::Gpu(
                    "No suitable GPU adapter found".to_string(),
                ))
            })?;

        log::info!("GPU Adapter: {:?}", adapter.get_info());

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("Palettum GPU Device"),
                required_features: wgpu::Features::empty(),
                // Maybe don't downlevel if not compiling to WASM? Or better yet why even downlevel
                // if WebGPU is supported...?
                required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                memory_hints: wgpu::MemoryHints::default(),
                trace: wgpu::Trace::default(),
            })
            .await
            .map_err(|e| {
                crate::error::Error::Gpu(format!("Failed to request GPU device: {:?}", e))
            })?;

        Ok(Self {
            instance,
            adapter,
            device,
            queue,
            using_webgpu,
        })
    }
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    static GPU_CONTEXT_INSTANCE: RefCell<Option<Arc<GpuContext>>> = RefCell::new(None);
}

#[cfg(not(target_arch = "wasm32"))]
static GPU_CONTEXT_INSTANCE: OnceCell<Arc<GpuContext>> = OnceCell::new();

pub async fn get_gpu_context() -> Result<Arc<GpuContext>> {
    #[cfg(target_arch = "wasm32")]
    {
        let mut result = None;
        GPU_CONTEXT_INSTANCE.with(|cell| {
            if let Some(p_arc) = cell.borrow().as_ref() {
                result = Some(p_arc.clone());
            }
        });
        if result.is_some() {
            return Ok(result.unwrap());
        }
        match GpuContext::new().await {
            Ok(context) => {
                let arc = Arc::new(context);
                GPU_CONTEXT_INSTANCE.with(|cell| {
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
        let result = GPU_CONTEXT_INSTANCE
            .get_or_try_init(async {
                match GpuContext::new().await {
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
