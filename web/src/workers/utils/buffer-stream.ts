export class BufferStream<T = any> extends ReadableStream<T | null> {
  private buf: (T | null)[] = [];
  private resume: (() => void) | null = null;

  constructor() {
    super({
      pull: async (ctrl) => {
        while (this.buf.length === 0) {
          await new Promise<void>((r) => (this.resume = r));
        }
        const next = this.buf.shift();
        if (next === null) ctrl.close();
        else ctrl.enqueue(next);
      },
    });
  }
  push(v: T | null) {
    this.buf.push(v);
    this.resume?.();
    this.resume = null;
  }

  size(): number {
    return this.buf.length;
  }

  clear() {
    // Close any VideoFrame or AudioData objects in the buffer before clearing
    for (const item of this.buf) {
      if (item && typeof (item as any).close === "function") {
        (item as any).close();
      }
    }
    this.buf = [];
    if (this.resume) {
      this.resume(); // Resolve any pending pull requests
      this.resume = null;
    }
  }
}
