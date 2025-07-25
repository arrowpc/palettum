import { getRenderer } from "../core/renderer";
import type { Gif } from "palettum";
import wasm from "@/lib/wasm";

const LOOP = true;

interface GifHandlerOptions {
  onProgress?: (progress: number) => void;
}

export class GifHandler {
  private gif: Gif | null = null;
  private frames: { bmp: ImageBitmap; dur: number }[] = [];
  private idx = 0;
  private playing = true;
  private loopHandle: number | undefined;
  private file: File;
  private onProgress?: (progress: number) => void;
  public width = 0;
  public height = 0;
  public duration = 0;
  public type = "Gif";

  constructor(file: File, opts?: GifHandlerOptions) {
    this.file = file;
    this.onProgress = opts?.onProgress;
  }

  async init() {
    const { Gif } = await wasm;
    const buffer = await this.file.arrayBuffer();
    this.gif = new Gif(new Uint8Array(buffer));
    this.gif = new Gif(new Uint8Array(buffer));
    if (!this.gif) throw new Error("Failed to initialize GIF");
    this.width = this.gif.width;
    this.height = this.gif.height;
    this.duration = this.gif.num_frames;
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
      this.onProgress?.(this.idx);
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

  isPlaying() {
    return this.playing;
  }

  seek(frameIndex: number) {
    if (this.gif && frameIndex >= 0 && frameIndex < this.gif.num_frames) {
      this.idx = frameIndex;
      this.onProgress?.(this.idx);
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
    onProgress?: (progress: number, message: string) => void,
  ): Promise<Blob> {
    if (!this.gif) {
      throw new Error("GIF not initialized");
    }

    this.pause();

    onProgress?.(0, "resizing...");
    await this.gif.resize();
    onProgress?.(10, "palettifying...");
    await this.gif.palettify();

    onProgress?.(100, "");
    const palettizedBytes = this.gif.to_bytes();

    this.play();

    return new Blob([palettizedBytes], { type: "image/gif" });
  }
}
