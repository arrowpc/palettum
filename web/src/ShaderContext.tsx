import {
  createContext,
  useState,
  useContext,
  Dispatch,
  SetStateAction,
  ReactNode,
} from "react";
import type { ImageFilter, Config } from "palettum";
import {
  MAPPING_SMOOTHED,
  FORMULA_CIEDE2000,
  SMOOTHING_STYLE_IDW,
  DEFAULT_DITHERING_STYLE,
  DEFAULT_DITHERING_STRENGTH,
  DEFAULT_QUANT_LEVEL,
  DEFAULT_FILTER,
} from "@/components/adjustments/adjustments.types";

const DEFAULT_TRANSPARENCY_THRESHOLD = 128;
const DEFAULT_SMOOTHING_STRENGTH = 0.5;

export interface ShaderState {
  filter: ImageFilter | null;
  canvas: HTMLCanvasElement | null;
  sourceMediaType: "image" | "video" | "gif" | null;
  sourceDimensions?: { width: number; height: number };
  config: Config;
}

const initialConfig: Config = {
  mapping: MAPPING_SMOOTHED,
  diffFormula: FORMULA_CIEDE2000,
  smoothFormula: SMOOTHING_STYLE_IDW,
  smoothStrength: DEFAULT_SMOOTHING_STRENGTH,
  transparencyThreshold: DEFAULT_TRANSPARENCY_THRESHOLD,
  ditherAlgorithm: DEFAULT_DITHERING_STYLE,
  ditherStrength: DEFAULT_DITHERING_STRENGTH,
  quantLevel: DEFAULT_QUANT_LEVEL,
  filter: DEFAULT_FILTER,
};

const initialShaderState: ShaderState = {
  filter: null,
  canvas: null,
  sourceMediaType: null,
  sourceDimensions: undefined,
  config: initialConfig,
};

export const ShaderContext = createContext<
  | {
    shader: ShaderState;
    setShader: Dispatch<SetStateAction<ShaderState>>;
  }
  | undefined
>(undefined);

export const ShaderProvider = ({ children }: { children: ReactNode }) => {
  const [shader, setShader] = useState<ShaderState>(initialShaderState);
  return (
    <ShaderContext.Provider value={{ shader, setShader }}>
      {children}
    </ShaderContext.Provider>
  );
};

export const useShader = () => {
  const context = useContext(ShaderContext);
  if (context === undefined) {
    throw new Error("useShader must be used within a ShaderProvider");
  }
  return context;
};
