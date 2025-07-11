import { type Player } from "./interface";
import { getRenderer } from "../core/renderer";
import { palettify } from "palettum";
import type { Config } from "palettum";

export class ImagePlayer implements Player {
  private bmp: ImageBitmap;
  private disposed = false;

  constructor(bmp: ImageBitmap) {
    this.bmp = bmp;
  }

  async init() {
    const r = await getRenderer();
    r.draw(this.bmp);
  }

  play() { }
  pause() { }
  seek() { }

  async dispose() {
    if (this.disposed) return;
    this.bmp.close();
    this.disposed = true;
  }

  async export(config: Config): Promise<Blob> {
    const canvas = new OffscreenCanvas(this.bmp.width, this.bmp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(this.bmp, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const palettizedBytes = await palettify(
      new Uint8Array(imageData.data.buffer),
      config,
    );

    return new Blob([palettizedBytes], { type: "image/png" });
  }
}
