import { type Player } from "./interface";
import { getRenderer } from "../core/renderer";

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
}
