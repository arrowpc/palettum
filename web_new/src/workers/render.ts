import { expose } from "comlink";
import { getRenderer, disposeRenderer } from "./core/renderer";
import { createPlayerForFile, type Player } from "./players";
import type { Config, Palette } from "palettum";

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
  /**
   * Initializes the worker, primarily to warm up the renderer.
   */
  async init() {
    await getRenderer();
  },

  /**
   * Sets the OffscreenCanvas for rendering and connects it to the renderer.
   */
  // async setCanvas(cvs: OffscreenCanvas) {
  //   canvas = cvs;
  //   const renderer = await getRenderer();
  //   await renderer.set_canvas(canvas);
  //   let palette: Palette = {
  //     colors: [
  //       [0, 0, 0],
  //       [255, 255, 255],
  //       [255, 0, 255],
  //     ],
  //     id: "whocares",
  //   };
  //   let config: Config = {
  //     palette: palette,
  //     diffFormula: "CIEDE2000",
  //     ditherAlgorithm: "Bn",
  //     ditherStrength: 0.5,
  //     filter: "Nearest",
  //     mapping: "Smoothed",
  //     quantLevel: 0,
  //     smoothFormula: "Rq",
  //     smoothStrength: 0.1,
  //     transparencyThreshold: 128,
  //   };
  //   renderer.set_config(config);
  //   renderer.set_filter("smoothed");
  // },

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

  /**
   * Loads a new file, disposing of any previous player.
   */
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

  /**
   * Cleans up all resources used by the worker.
   */
  dispose() {
    player?.dispose();
    disposeRenderer();
    player = null;
  },
};

export type RendererAPI = typeof api;

expose(api);
