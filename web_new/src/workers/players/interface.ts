import type { Config } from "palettum";

export interface Player {
  init(): Promise<void> | void;
  play(): void;
  pause(): void;
  seek(t: number): void; // ms
  dispose(): Promise<void>;
  export(config: Config, onProgress?: (progress: number, message: string) => void): Promise<Blob>;
}
