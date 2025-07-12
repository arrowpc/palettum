import { expose, proxy } from "comlink";
import { getRenderer, disposeRenderer } from "./core/renderer";
import { createMediaHandlerForFile } from "./media";
import type { Config } from "palettum";

let mediaHandler: any | null = null;

type CanvasId = string;

const canvases = new Map<CanvasId, OffscreenCanvas>();
let currentCanvas: CanvasId | null = null;

async function applyCanvas(id: CanvasId) {
  const renderer = await getRenderer();
  const cvs = canvases.get(id);
  if (!cvs) throw new Error(`Canvas "${id}" is not registered in worker`);
  await renderer.set_canvas(cvs);
  currentCanvas = id;
}

const api = {
  async init() {
    const renderer = await getRenderer();
    renderer.set_draw_mode("aspect-fill");
  },

  async registerCanvas(id: CanvasId, canvas?: OffscreenCanvas) {
    if (canvas) canvases.set(id, canvas); // first call, object is transferred
    await applyCanvas(id); // make it the active target
  },

  async useCanvas(id: CanvasId) {
    await applyCanvas(id);
  },

  disposeCanvas(id: CanvasId) {
    canvases.delete(id);
    if (currentCanvas === id) currentCanvas = null;
  },

  async setConfig(cfg: Config) {
    const renderer = await getRenderer();
    renderer.set_config(cfg);
  },

  async load(file: Blob) {
    if (mediaHandler) await mediaHandler.dispose();
    mediaHandler = await createMediaHandlerForFile(file);
    await mediaHandler.init();

    const mediaInfo: MediaInfo = {
      canPlay: typeof mediaHandler.play === "function",
      canPause: typeof mediaHandler.pause === "function",
      canSeek: typeof mediaHandler.seek === "function",
      // Add other media-specific info here if needed, e.g., duration, dimensions
      // For now, we'll just include the capabilities.
    };
    return mediaInfo;
  },

  play() {
    mediaHandler?.play?.();
  },

  pause() {
    mediaHandler?.pause?.();
  },

  seek(ms: number) {
    mediaHandler?.seek?.(ms);
  },

  dispose() {
    mediaHandler?.dispose?.();
    disposeRenderer();
    mediaHandler = null;
  },

  async export(config: Config, onProgress?: (progress: number, message: string) => void): Promise<Blob> {
    if (!mediaHandler) {
      throw new Error("No media handler loaded to export");
    }
    
    const proxiedOnProgress = onProgress ? proxy(onProgress) : undefined;
    return mediaHandler.export(config, proxiedOnProgress);
  },
};

export interface MediaInfo {
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
}

export type RendererAPI = Omit<typeof api, "export" | "load"> & {
  export: (config: Config, onProgress?: (progress: number, message: string) => void) => Promise<Blob>;
  load: (file: Blob) => Promise<MediaInfo>;
};

expose(api);
