import { getWasmPath } from "@/wasm-detect";
import type { Palette } from "palettum";

export class Extractor {
  static async extract(file: File, kColors: number): Promise<Palette> {
    const wasmPath = await getWasmPath();
    const { palette_from_media } = await import(wasmPath);
    const bytes = new Uint8Array(await file.arrayBuffer());
    return palette_from_media(bytes, kColors);
  }
}
