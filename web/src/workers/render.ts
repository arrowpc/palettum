import { expose, proxy } from "comlink";
import { getRenderer } from "./core/renderer";
import { createMediaHandlerForFile } from "./media";
import type { Config } from "palettum";

let mediaHandler: any | null = null;
let renderer: any | null = null;

const api = {
  async init() {
    renderer = await getRenderer();
    renderer.set_draw_mode("aspect-fit");
  },

  async registerCanvas(id: string, canvas: OffscreenCanvas) {
    await renderer.register_canvas(id, canvas);
  },

   switchCanvas(id: string) {
     renderer.switch_canvas(id);

  },

  dropCanvas(id: string) {
    renderer.drop_canvas(id);
  },

  clearCanvas() {
    renderer.clear_current_canvas();
  },

  setConfig(cfg: Config) {
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

  async export(
    onProgress?: (progress: number, message: string) => void
  ): Promise<Blob> {
    if (!mediaHandler) {
      throw new Error("No media handler loaded to export");
    }

    const proxiedOnProgress = onProgress ? proxy(onProgress) : undefined;
    return mediaHandler.export(proxiedOnProgress);
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
  export: (
    onProgress?: (progress: number, message: string) => void
  ) => Promise<Blob>;
  load: (file: File) => Promise<MediaInfo>;
};

expose(api);
