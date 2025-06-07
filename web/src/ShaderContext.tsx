import {
  createContext,
  useState,
  useContext,
  Dispatch,
  SetStateAction,
  ReactNode,
} from "react";
import type { ImageFilter } from "palettum";

export interface ShaderState {
  filter: ImageFilter | null;
  canvas: OffscreenCanvas | null;
  sourceMediaType: "image" | "video" | "gif" | null;
  sourceDimensions?: { width: number; height: number };
}

const initialShaderState: ShaderState = {
  filter: null,
  canvas: null,
  sourceMediaType: null,
  sourceDimensions: undefined,
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
