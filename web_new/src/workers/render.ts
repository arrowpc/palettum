import { expose, proxy } from "comlink";
import { getRenderer } from "./core/renderer";
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
    renderer.set_draw_mode("aspect-fit");
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

  async load(file: File) {
    if (mediaHandler) await mediaHandler.dispose();
    mediaHandler = await createMediaHandlerForFile(file);
    await mediaHandler.init();

    const mediaInfo: MediaInfo = {
      canPlay: typeof mediaHandler.play === "function",
      canPause: typeof mediaHandler.pause === "function",
      canSeek: typeof mediaHandler.seek === "function",
      width: mediaHandler.width,
      height: mediaHandler.height,
    };
    return mediaInfo;
  },

  async getMediaInfo(): Promise<MediaInfo | null> {
    if (!mediaHandler) {
      return null;
    }
    return {
      canPlay: typeof mediaHandler.play === "function",
      canPause: typeof mediaHandler.pause === "function",
      canSeek: typeof mediaHandler.seek === "function",
      width: mediaHandler.width,
      height: mediaHandler.height,
    };
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
  width: number;
  height: number;
}

export type RendererAPI = Omit<typeof api, "export" | "load"> & {
  export: (config: Config, onProgress?: (progress: number, message: string) => void) => Promise<Blob>;
  load: (file: File) => Promise<MediaInfo>;
};

expose(api);
