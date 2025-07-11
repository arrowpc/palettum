import { type Player } from "./interface";
import { getRenderer } from "../core/renderer";

import type { Config } from "palettum";

export class ImagePlayer implements Player {
  private disposed = false;
  private file: Blob;

  constructor(file: Blob) {
    this.file= file;
  }

  async init() {
    const r = await getRenderer();
    r.draw(await createImageBitmap(this.file));
  }

  play() { }
  pause() { }
  seek() { }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
  }

  async export(config: Config): Promise<Blob> {
    const { palettify } = await import("palettum");
    const palettizedBytes = await palettify(
      new Uint8Array(await this.file.arrayBuffer()),
      config,
    );

    return new Blob([palettizedBytes], { type: "image/png" });
  }
}
