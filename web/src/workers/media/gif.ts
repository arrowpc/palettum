import { getRenderer } from "../core/renderer";
import type { Config, Gif } from "palettum";

const LOOP = true;

export class GifHandler {
  private gif: Gif | null = null;
  private frames: { bmp: ImageBitmap; dur: number }[] = [];
  private idx = 0;
  private playing = true;
  private loopHandle: number | undefined;
  private file: File;
  public width = 0;
  public height = 0;

  constructor(file: File) {
    this.file = file;
  }

  async init() {
    const { Gif } = await import("palettum");
    const buffer = await this.file.arrayBuffer();
    this.gif = new Gif(new Uint8Array(buffer));
    this.width = this.gif.width;
    this.height = this.gif.height;
    await this.reinitializeFrames();
    this.loop();
  }

  private async reinitializeFrames() {
    if (!this.gif) return;

    this.frames.forEach((f) => f.bmp.close());
    this.frames = [];

    for (let i = 0; i < this.gif.num_frames; i++) {
      const frameData = this.gif.get_frame_data(i);
      const imageData = new ImageData(
        new Uint8ClampedArray(frameData.buffer),
        this.gif.width,
        this.gif.height,
      );
      const bmp = await createImageBitmap(imageData);
      const dur = this.gif.get_frame_delay(i) * 10; // cs->ms;
      this.frames.push({ bmp, dur });
    }
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
      if (this.idx === 0 && !LOOP) {
        return;
      }
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

  seek(frameIndex: number) {
    if (this.gif && frameIndex >= 0 && frameIndex < this.gif.num_frames) {
      this.idx = frameIndex;
      getRenderer().then((r) => r.draw(this.frames[this.idx].bmp));
    }
  }

  async dispose() {
    self.clearTimeout(this.loopHandle);
    this.frames.forEach((f) => f.bmp.close());
    if (this.gif) {
      this.gif.free();
      this.gif = null;
    }
  }

  async export(
    config: Config,
    onProgress?: (progress: number, message: string) => void,
  ): Promise<Blob> {
    if (!this.gif) {
      throw new Error("GIF not initialized");
    }

    this.pause();

    onProgress?.(0, "palettifying...");
    await this.gif.palettify(config);

    onProgress?.(100, "");
    const palettizedBytes = this.gif.to_bytes();

    this.play();

    return new Blob([palettizedBytes], { type: "image/gif" });
  }
}
