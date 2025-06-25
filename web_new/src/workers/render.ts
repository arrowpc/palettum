import { expose } from "comlink";
import { getRenderer, disposeRenderer } from "./core/renderer";
import { createPlayerForFile, type Player } from "./players";
import type { Config, Palette, Rgb } from "palettum";

let player: Player | null = null;
let canvas: OffscreenCanvas | null = null;

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
  async setCanvas(cvs: OffscreenCanvas) {
    canvas = cvs;
    const renderer = await getRenderer();
    await renderer.set_canvas(canvas);
    let palette: Palette = {
      colors: [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 255],
      ],
      id: "whocares",
    };
    let config: Config = {
      palette: palette,
      diffFormula: "CIEDE2000",
      ditherAlgorithm: "Bn",
      ditherStrength: 0.5,
      filter: "Nearest",
      mapping: "Smoothed",
      quantLevel: 0,
      smoothFormula: "Rq",
      smoothStrength: 0.1,
      transparencyThreshold: 128,
    };
    renderer.set_config(config);
    renderer.set_filter("smoothed");
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
    canvas = null;
  },
};

export type RendererAPI = typeof api;

expose(api);
