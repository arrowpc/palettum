import type { Config } from "palettum";
import type { ProgressCallback } from "./video";

export interface Player {
  init(): Promise<void> | void;
  play(): void;
  pause(): void;
  seek(t: number): void; // ms
  dispose(): Promise<void>;
  export(config: Config, onProgress: ProgressCallback): Promise<Blob>;
}
