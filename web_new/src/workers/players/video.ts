import type { LibAV as LibAVInstance } from "@libav.js/variant-webcodecs";
import type * as LibAVWebCodecsBridge from "libavjs-webcodecs-bridge";
import { type Player } from "./interface";
import { initLibAV } from "../libav";
import { getRenderer } from "../core/renderer";
import { BufferStream } from "../utils/buffer-stream";

export class VideoPlayer implements Player {
  private playing = true;
  private disposed = false;
  private frameQueue = new BufferStream<VideoFrame>();
  private drawHandle: number | undefined;
  private ifc = 0;
  private rpkt = 0;
  private decoder!: VideoDecoder;
  private frameReader: ReadableStreamDefaultReader<VideoFrame | null> | null =
    null;
  private libav: LibAVInstance | null = null;
  private bridge: typeof LibAVWebCodecsBridge | null = null;

  constructor(private file: Blob) { }

  async init(): Promise<void> {
    const { libav, bridge } = await initLibAV();
    this.libav = libav;
    this.bridge = bridge;
    await libav.mkreadaheadfile("input", this.file);
    const [ifc, istreams] = await libav.ff_init_demuxer_file("input");
    this.ifc = ifc;
    const vIdx = istreams.findIndex(
      (s) => s.codec_type === libav.AVMEDIA_TYPE_VIDEO,
    );
    if (vIdx < 0) throw new Error("No video stream found in file.");
    const vStream = istreams[vIdx];
    const vConfig = await bridge.videoStreamToConfig(libav, vStream);
    if (!vConfig) return;
    if (
      !(await VideoDecoder.isConfigSupported(vConfig as VideoDecoderConfig))
        .supported
    ) {
      throw new Error("Video codec not supported by WebCodecs.");
    }
    this.decoder = new VideoDecoder({
      output: (f) => this.frameQueue.push(f),
      error: (e) => console.error("VideoDecoder error:", e),
    });
    this.decoder.configure(vConfig as VideoDecoderConfig);
    this.rpkt = await libav.av_packet_alloc();
    this.startDemuxDecodeLoop(vIdx, vStream);
    this.loopDraw();
  }

  private async startDemuxDecodeLoop(vIdx: number, vStream: any) {
    (async () => {
      if (!(this.libav && this.bridge)) return;
      try {
        const READ_LIMIT = 64 * 1024;

        while (!this.disposed) {
          const [res, packets] = await this.libav.ff_read_frame_multi(
            this.ifc,
            this.rpkt,
            { limit: READ_LIMIT }, // Only read up to 64KB at a time
          );

          if (packets[vIdx]) {
            for (const pkt of packets[vIdx]) {
              const chunk = this.bridge.packetToEncodedVideoChunk(pkt, vStream);
              this.decoder.decode(chunk);
            }
          }

          if (res === this.libav.AVERROR_EOF) break;
        }
        await this.decoder.flush();
        this.frameQueue.push(null);
      } catch (err) {
        console.error("Demux/decode loop failed:", err);
      }
    })();
  }

  private async loopDraw() {
    this.frameReader = this.frameQueue.getReader();
    const { value: first } = await this.frameReader.read();
    if (!first) return;
    const r = await getRenderer();
    let nextFrame: VideoFrame | null = first;
    const drawNext = async () => {
      if (this.disposed) return;
      if (!this.playing) {
        this.drawHandle = self.setTimeout(drawNext, 50);
        return;
      }
      if (!nextFrame) {
        const { done, value } = await this.frameReader!.read();
        if (done) return;
        nextFrame = value;
      }
      if (!nextFrame) return;
      const bmp = await createImageBitmap(nextFrame);
      r.draw(bmp);
      bmp.close();
      const durMs =
        typeof nextFrame.duration === "number" ? nextFrame.duration / 1000 : 33;
      nextFrame.close();
      nextFrame = null;
      this.drawHandle = self.setTimeout(drawNext, durMs);
    };
    drawNext();
  }

  play() {
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  seek(_t: number) {
    console.warn("LibAVVideoPlayer.seek() not implemented.");
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    self.clearTimeout(this.drawHandle);

    // Drain and close all frames in the queue
    if (this.frameReader) {
      while (true) {
        const { done, value } = await this.frameReader.read();
        if (done) break;
        if (value) value.close();
      }
      this.frameReader = null;
    }

    if (this.libav) {
      try {
        await this.libav.unlink("input");
      } catch (e) { }
      if (this.ifc) await this.libav.avformat_close_input_js(this.ifc);
      if (this.rpkt) await this.libav.av_packet_free(this.rpkt);
    }
    this.decoder?.close();
  }

  async export(): Promise<Blob> {
    console.warn("VideoPlayer.export() not implemented.");
    return Promise.reject("Not implemented");
  }
}
