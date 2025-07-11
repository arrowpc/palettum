import { expose, proxy } from "comlink";
import { getRenderer, disposeRenderer } from "./core/renderer";
import { createPlayerForFile, type Player } from "./players";
import type { Config } from "palettum";

let player: Player | null = null;

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
    if (player) await player.dispose();
    player = await createPlayerForFile(file);
    await player.init();
  },

  play() {
    player?.play();
  },

  pause() {
    player?.pause();
  },

  seek(ms: number) {
    player?.seek(ms);
  },

  dispose() {
    player?.dispose();
    disposeRenderer();
    player = null;
  },

  async export(config: Config, onProgress?: (progress: number, message: string) => void): Promise<Blob> {
    if (!player) {
      throw new Error("No player loaded to export");
    }
    
    const proxiedOnProgress = onProgress ? proxy(onProgress) : undefined;
    return player.export(config, proxiedOnProgress);
  },
};

export type RendererAPI = Omit<typeof api, "export"> & {
  export: (config: Config, onProgress?: (progress: number, message: string) => void) => Promise<Blob>;
};

expose(api);
