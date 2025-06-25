import { create } from "zustand";
import { type Config } from "palettum";

interface ConfigState {
  config: Config;
  setConfig: <K extends keyof Config>(key: K, value: Config[K]) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: {
    mapping: "Smoothed",
    diffFormula: "CIEDE2000",
    smoothFormula: "Idw",
    smoothStrength: 0.5,
    transparencyThreshold: 128,
    ditherAlgorithm: "Bn",
    ditherStrength: 0.5,
    quantLevel: 0,
    filter: "Nearest",
  },
  setConfig: (key, value) =>
    set((state) => ({
      config: { ...state.config, [key]: value },
    })),
}));
