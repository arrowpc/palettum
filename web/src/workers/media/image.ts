import { getRenderer } from "../core/renderer";

export class ImageHandler {
  private disposed = false;
  private file: Blob;
  public width = 0;
  public height = 0;

  constructor(file: File) {
    this.file = file;
  }

  async init() {
    const r = await getRenderer();
    const bmp = await createImageBitmap(this.file);
    this.width = bmp.width;
    this.height = bmp.height;
    r.draw(bmp);
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
  }

  async export(
    onProgress?: (progress: number, message: string) => void,
  ): Promise<Blob> {
    const { palettify } = await import("palettum");
    onProgress?.(0, "palettifying...");
    const palettizedBytes = await palettify(
      new Uint8Array(await this.file.arrayBuffer()),
    );
    onProgress?.(100, "");

    return new Blob([palettizedBytes], { type: "image/png" });
  }
}
