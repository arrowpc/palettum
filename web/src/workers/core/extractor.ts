import wasm from "@/lib/wasm";
import type { Palette } from "palettum";

export class Extractor {
  static async extract(file: File, kColors: number): Promise<Palette> {
    const { palette_from_media } = await wasm;
    const bytes = new Uint8Array(await file.arrayBuffer());
    return palette_from_media(bytes, kColors);
  }
}
