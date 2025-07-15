import { create } from "zustand";
import { mutative } from "zustand-mutative";
import { type Config, type Palette } from "palettum";

interface ConfigState {
  config: Config;
  setConfig: <K extends keyof Config>(key: K, value: Config[K]) => void;
  setSelectedPalette: (palette: Palette) => void; // This will be called from palettes store
}

export const useConfigStore = create<ConfigState>()(
  mutative((set) => ({
    config: {
      palette: {} as Palette, // Placeholder, will be set by palettes store
      mapping: "Smoothed",
      diffFormula: "CIEDE2000",
      smoothFormula: "Idw",
      smoothStrength: 0.5,
      transparencyThreshold: 128,
      ditherAlgorithm: "None",
      ditherStrength: 0.5,
      quantLevel: 0,
      filter: "Nearest",
    },
    setConfig: (key, value) =>
      set((state) => {
        state.config[key] = value;
      }),
    setSelectedPalette: (palette) =>
      set((state) => {
        state.config.palette = palette;
      }),
  }))
);
