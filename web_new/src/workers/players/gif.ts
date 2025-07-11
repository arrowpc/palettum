import { parseGIF, decompressFrames } from "gifuct-js";
import { type Player } from "./interface";
import { getRenderer } from "../core/renderer";

import type { Config } from "palettum";

export class GifPlayer implements Player {
  private buffer: ArrayBuffer;
  private frames: { bmp: ImageBitmap; dur: number }[] = [];
  private idx = 0;
  private playing = true;
  private loopHandle: number | undefined;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
  }

  async init() {
    const gif = parseGIF(this.buffer);
    const rawFrames = decompressFrames(gif, true);

    for (const f of rawFrames) {
      const c = new OffscreenCanvas(f.dims.width, f.dims.height);
      const ctx = c.getContext("2d")!;
      const imgData = ctx.createImageData(f.dims.width, f.dims.height);
      imgData.data.set(f.patch);
      ctx.putImageData(imgData, 0, 0);
      const bmp = await createImageBitmap(c);
      this.frames.push({ bmp, dur: f.delay || 100 });
    }
    this.loop();
  }

  private async loop() {
    const r = await getRenderer();

    const draw = async () => {
      if (!this.playing) {
        this.loopHandle = self.setTimeout(draw, 50);
        return;
      }
      const { bmp, dur } = this.frames[this.idx];
      r.draw(bmp);
      this.idx = (this.idx + 1) % this.frames.length;
      this.loopHandle = self.setTimeout(draw, dur);
    };
    draw();
  }

  play() {
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  seek(t: number) {
    let acc = 0;
    for (let i = 0; i < this.frames.length; i++) {
      acc += this.frames[i].dur;
      if (t < acc) {
        this.idx = i;
        break;
      }
    }
  }
  async dispose() {
    self.clearTimeout(this.loopHandle);
    this.frames.forEach((f) => f.bmp.close());
  }

  async export(config: Config): Promise<Blob> {
    const { palettify } = await import("palettum");
    const palettizedBytes = await palettify(
      new Uint8Array(this.buffer),
      config,
    );

    return new Blob([palettizedBytes], { type: "image/gif" });
  }
}
