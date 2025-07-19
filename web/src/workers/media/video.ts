import type {
  LibAV as LibAVInstance,
  Stream,
} from "@libav.js/variant-webcodecs";
import type * as LibAVWebCodecsBridge from "libavjs-webcodecs-bridge";
import { initLibAV } from "../libav";
import { getRenderer } from "../core/renderer";
import { BufferStream } from "../utils/buffer-stream";

type TimestampUs = number;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toLibAVTimestamp(value: number): [number, number] {
  if (value < 0) {
    console.warn(
      "Negative timestamp provided to toLibAVTimestamp, treating as 0.",
    );
    value = 0;
  }

  const bigIntValue = BigInt(Math.round(value));
  const low = Number(bigIntValue & 0xffffffffn);
  const high = Number(bigIntValue >> 32n);
  return [low, high];
}

type LibAVFormatContext = number & {
  pb?: {
    pos: number;
    size: number;
  };
};

interface VideoEncoderEncodeOptions {
  vp9?: {
    quantizer?: number;
  };
  av1?: {
    quantizer?: number;
  };
  avc?: {
    quantizer?: number;
  };
  hevc?: {
    quantizer?: number;
  };
}

interface Queued {
  frame: VideoFrame;
  pts: TimestampUs;
  duration: TimestampUs;
  arrival: DOMHighResTimeStamp;
}

class AdaptiveFrameBuffer {
  private readonly maxFrames: number;
  private readonly initialWatermark: number;
  private readonly queue: Queued[] = [];
  private playing = true;

  constructor(opts?: { initialWatermark?: number; maxFrames?: number }) {
    this.initialWatermark = opts?.initialWatermark ?? 6;
    this.maxFrames = opts?.maxFrames ?? 200;
  }

  enqueue(frame: VideoFrame): void {
    this.queue.push({
      frame,
      pts: frame.timestamp ?? 0,
      duration: frame.duration ?? 33_333,
      arrival: performance.now(),
    });

    // keep pts ordered
    // This is extremely important!! depending on the codecs and how it's implemented
    // For more info learn about b-frames here: https://ottverse.com/i-p-b-frames-idr-keyframes-differences-usecases/#What_is_a_B-frame
    this.queue.sort((a, b) => a.pts - b.pts);

    while (this.queue.length > this.maxFrames) {
      this.queue.shift()!.frame.close();
    }
  }

  clear(): void {
    this.queue.forEach((q) => q.frame.close());
    this.queue.length = 0;
  }

  size(): number {
    return this.queue.length;
  }

  bufferedDurationMs(): number {
    if (this.queue.length < 2) return 0;
    const first = this.queue[0].pts;
    const last = this.queue[this.queue.length - 1].pts;
    return (last - first) / 1_000; // μs -> ms
  }

  consume(): Queued | null {
    if (!this.playing) return null;
    if (
      this.queue.length === 0 ||
      (this.queue.length < this.initialWatermark && !this.started)
    ) {
      return null;
    }
    this.started = true;
    return this.queue.shift() ?? null;
  }

  peek(): Queued | null {
    return this.queue[0] ?? null;
  }

  setPlaying(p: boolean): void {
    this.playing = p;
  }

  private started = false;
}

interface VideoHandlerOptions {
  bufferGoalMs?: number;
  readChunkBytes?: number;
  loop?: boolean;
  onProgress?: (progress: number) => void;
}

export class VideoHandler {
  constructor(file: File, opts?: VideoHandlerOptions) {
    this.file = file;
    this.bufferGoalMs = opts?.bufferGoalMs ?? 100;
    this.readChunkBytes = opts?.readChunkBytes ?? 64 * 1024;
    this.loopEnabled = opts?.loop ?? true;
    this.onProgress = opts?.onProgress;
  }

  public width = 0;
  public height = 0;
  public duration = 0; // in seconds
  public type = "Video";

  play(): void {
    if (this.playing) return;
    const now = performance.now();
    if (this.pauseMark !== null) {
      this.playStart += now - this.pauseMark;
      this.pauseMark = null;
    }
    this.playing = true;
    this.frames.setPlaying(true);
  }

  pause(): void {
    if (!this.playing) return;
    this.pauseMark = performance.now();
    this.playing = false;
    this.frames.setPlaying(false);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  async seek(timestampMs: number): Promise<void> {
    if (this.disposed || !this.libav || !this.vStream) return;

    const wasPlaying = this.playing;
    this.pause();
    this.pausedBySeek = true;

    await this.decoder.flush();
    this.frames.clear();
    this.decoder.reset();
    this.decoder.configure(this.vConfig);

    this.firstPts = -1;

    const timestamp =
      (timestampMs / 1000) *
      (this.vStream.time_base_den / this.vStream.time_base_num);
    const [ts_lo, ts_hi] = toLibAVTimestamp(timestamp);

    await this.libav.av_seek_frame(
      this.ifc,
      this.vStreamIndex,
      ts_lo,
      ts_hi,
      this.libav.AVSEEK_FLAG_BACKWARD,
    );

    this.pausedBySeek = false;
    if (wasPlaying) {
      this.play();
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    cancelAnimationFrame(this.raf);
    this.frames.clear();
    this.decoder?.close();

    if (this.libav) {
      try {
        await this.libav.unlink("input");
      } catch {}
      if (this.ifc) await this.libav.avformat_close_input_js(this.ifc);
      if (this.rpkt) await this.libav.av_packet_free(this.rpkt);
    }
  }

  async init(): Promise<void> {
    this.frames = new AdaptiveFrameBuffer();

    const { libav, bridge } = await initLibAV();
    this.libav = libav;
    this.bridge = bridge;

    await libav.mkreadaheadfile("input", this.file);
    const [ifc, streams] = await libav.ff_init_demuxer_file("input");
    this.ifc = ifc;

    const vIdx = streams.findIndex(
      (s) => s.codec_type === libav.AVMEDIA_TYPE_VIDEO,
    );
    if (vIdx === -1) throw new Error("no video stream");

    // Store the video stream and its index for later use (seeking)
    this.vStreamIndex = vIdx;
    this.vStream = streams[vIdx];

    this.duration = this.vStream.duration * 1000;

    const cfg = (await bridge.videoStreamToConfig(
      libav,
      this.vStream,
    )) as VideoDecoderConfig;
    if (!(await VideoDecoder.isConfigSupported(cfg)).supported) {
      throw new Error("codec not supported");
    }

    this.vConfig = cfg;
    this.width = cfg.codedWidth ?? 0;
    this.height = cfg.codedHeight ?? 0;

    this.decoder = new VideoDecoder({
      output: (frame) => this.frames.enqueue(frame),
      error: (e) => console.error("decoder:", e),
    });
    this.decoder.configure(cfg);

    this.rpkt = await libav.av_packet_alloc();

    this.demuxLoop(this.vStreamIndex, this.vStream).catch(console.error);
    this.drawLoop().catch(console.error);
  }
  private file: File;
  private libav!: LibAVInstance;
  private bridge!: typeof LibAVWebCodecsBridge;
  private vConfig!: VideoDecoderConfig;
  private decoder!: VideoDecoder;
  private frames!: AdaptiveFrameBuffer;
  private vStream!: Stream;
  private vStreamIndex = -1;

  private ifc = 0;
  private rpkt = 0;

  private playing = true;
  private playStart = 0;
  private pauseMark: number | null = null;
  private loopEnabled = true;
  private disposed = false;
  private pausedBySeek = false;

  private firstPts: TimestampUs = -1;
  private raf = 0;

  private readonly bufferGoalMs: number;
  private readonly readChunkBytes: number;
  private readonly onProgress?: (progress: number) => void;

  private async demuxLoop(vIdx: number, vStream: Stream): Promise<void> {
    if (!this.libav || !this.bridge) return;

    while (!this.disposed) {
      if (!this.playing || this.pausedBySeek) {
        await sleep(20);
        continue;
      }

      const bufMs = this.frames.bufferedDurationMs();
      if (bufMs > this.bufferGoalMs || this.frames.size() >= this.framesMax()) {
        await sleep(20);
        continue;
      }

      const [res, packets] = await this.libav.ff_read_frame_multi(
        this.ifc,
        this.rpkt,
        { limit: this.readChunkBytes },
      );

      if (packets[vIdx]) {
        for (const pkt of packets[vIdx]) {
          const chunk = this.bridge.packetToEncodedVideoChunk(pkt, vStream);
          this.decoder.decode(chunk);
        }
      }

      if (res === this.libav.AVERROR_EOF) {
        await this.decoder.flush();
        if (this.loopEnabled) {
          // If looping, seek back to the beginning
          const [ts_lo, ts_hi] = toLibAVTimestamp(0);
          await this.libav.av_seek_frame(
            this.ifc,
            -1,
            ts_lo,
            ts_hi,
            this.libav.AVSEEK_FLAG_BACKWARD,
          );
          this.decoder.reset();
          this.decoder.configure(this.vConfig);
          this.frames.clear();
          this.firstPts = -1;
          continue;
        }
        break;
      }
    }
  }

  private framesMax(): number {
    // 1 second of 60 fps ≈ 60 frames
    return 60;
  }

  private async drawLoop(): Promise<void> {
    const renderer = await getRenderer();

    const draw = async (): Promise<void> => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(draw);
      if (!this.playing) return;

      const peek = this.frames.peek();
      if (!peek) return;

      if (this.firstPts === -1) {
        this.firstPts = peek.pts;
        this.playStart = performance.now();
      }

      const ptsMs = (peek.pts - this.firstPts) / 1_000;
      this.onProgress?.(peek.pts / 1_000);
      const drawAt = this.playStart + ptsMs;
      if (performance.now() < drawAt) return;

      const q = this.frames.consume();
      if (!q) return;
      try {
        const bmp = await createImageBitmap(q.frame);
        renderer.draw(bmp);
      } finally {
        q.frame.close();
      }
    };

    this.raf = requestAnimationFrame(draw);
  }

  // The way I resize here is nothing short of disgusting; it's 5am and I'm done thinking about this
  private createFrameModifier() {
    let canvas: OffscreenCanvas | null = null;
    let ctx: OffscreenCanvasRenderingContext2D | null = null;
    return async function palettify(frame: any): Promise<VideoFrame> {
      const { palettify_frame, resize_frame } = await import("palettum");

      const tempCanvas = new OffscreenCanvas(
        frame.codedWidth,
        frame.codedHeight,
      );
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
      if (!tempCtx) throw new Error("Could not get temporary canvas context");

      let imageBitmap = await createImageBitmap(frame);
      tempCtx.drawImage(imageBitmap, 0, 0);

      const originalImageData = tempCtx.getImageData(
        0,
        0,
        frame.codedWidth,
        frame.codedHeight,
      );

      const resizedFrame = await resize_frame(
        new Uint8Array(originalImageData.data.buffer),
        frame.codedWidth,
        frame.codedHeight,
      );

      const resizedWidth = resizedFrame.width;
      const resizedHeight = resizedFrame.height;
      const resizedBytes = resizedFrame.bytes;

      if (
        !canvas ||
        canvas.width !== resizedWidth ||
        canvas.height !== resizedHeight
      ) {
        canvas = new OffscreenCanvas(resizedWidth, resizedHeight);
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      }
      if (!ctx) throw new Error("Could not get canvas context");

      const currentImageData = new ImageData(
        new Uint8ClampedArray(resizedBytes),
        resizedWidth,
        resizedHeight,
      );

      ctx.putImageData(currentImageData, 0, 0);

      await palettify_frame(
        new Uint8Array(currentImageData.data.buffer),
        resizedWidth,
        resizedHeight,
      );

      ctx.putImageData(currentImageData, 0, 0);

      const frameInit: VideoFrameBufferInit = {
        duration: frame.duration,
        timestamp: frame.timestamp,
        codedWidth: resizedWidth,
        codedHeight: resizedHeight,
        format: "RGBA",
        colorSpace: {
          primaries: "bt709",
          transfer: "bt709",
          matrix: "bt709",
          fullRange: true,
        },
      };
      let newFrame = new VideoFrame(canvas, frameInit);
      frame.close();
      return newFrame;
    };
  }

  async export(
    onProgress?: (progress: number, message: string) => void,
    opts?: any,
  ): Promise<Blob> {
    if (!this.libav || !this.bridge) {
      throw new Error("LibAV not initialized for export.");
    }

    this.pause();

    const tempLibav = this.libav;
    const bridge = this.bridge;

    // Probe for duration
    await tempLibav.mkreadaheadfile("input-export-probe", this.file);
    const [probeIfc, probeStreams] =
      await tempLibav.ff_init_demuxer_file("input-export-probe");

    const videoStream = probeStreams.find(
      (s) => s.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO,
    );

    if (!videoStream || !videoStream.duration || !videoStream.time_base_num) {
      throw new Error(
        "Could not determine video duration from stream metadata.",
      );
    }

    const durationInSeconds = videoStream.duration * videoStream.time_base_num;
    const totalDuration = durationInSeconds * 1_000_000;

    await tempLibav.avformat_close_input_js(probeIfc);
    await tempLibav.unlink("input-export-probe");

    onProgress?.(0, "Analyzing input file...");
    await tempLibav.mkreadaheadfile("input-export", this.file);
    const [ifc, istreams] =
      await tempLibav.ff_init_demuxer_file("input-export");
    const rpkt = await tempLibav.av_packet_alloc();
    const wpkt = await tempLibav.av_packet_alloc();

    onProgress?.(0, "Configuring decoders & encoders...");

    // --- Stream Setup ---
    const iToO: number[] = [];
    const decoders: (VideoDecoder | AudioDecoder)[] = [];
    const decoderStreams: BufferStream<any>[] = [];
    const encoders: {
      encoder: VideoEncoder | AudioEncoder;
      config: VideoEncoderConfig | AudioEncoderConfig;
    }[] = [];
    const encoderStreams: BufferStream<any>[] = [];
    const ostreams: any[] = [];
    let ostreamIndex = 0;

    // https://www.webmproject.org/vp9/mp4/
    const vc = "vp09.01.50.08.03.01.01.00.01";

    for (let i = 0; i < istreams.length; i++) {
      const istream = istreams[i];
      iToO.push(-1);
      if (istream.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO) {
        const decoderConfig = await bridge.videoStreamToConfig(
          tempLibav,
          istream,
        );
        if (!decoderConfig) continue;
        if (
          !(
            await VideoDecoder.isConfigSupported(
              decoderConfig as VideoDecoderConfig,
            )
          ).supported
        )
          continue;

        const decoder = new VideoDecoder({
          output: (frame) => decoderStreams[o].push(frame),
          error: (e) => console.error("Video Decoder Error:", e),
        });
        decoder.configure(decoderConfig as VideoDecoderConfig);

        let encConfig: VideoEncoderConfig;
        if (decoderConfig.codedWidth && decoderConfig.codedHeight) {
          encConfig = {
            codec: vc,
            width: decoderConfig.codedWidth,
            height: decoderConfig.codedHeight,
            bitrateMode: "quantizer",
            latencyMode: "quality",
            // TODO: Figure out why this breaks
            // hardwareAcceleration: "prefer-hardware",
          };
        } else {
          throw new Error("Width or height undefined");
        }

        // TODO: Use a preferential system instead of giving up if the base config isn't supported
        VideoDecoder.isConfigSupported(encConfig).then((result) => {
          if (!result.supported) {
            throw new Error("Codec is not supported");
          }
        });

        const encoder = new VideoEncoder({
          output: (chunk, meta) => encoderStreams[o].push({ chunk, meta }),
          error: (e) => console.error("Video Encoder Error:", e),
        });
        encoder.configure(encConfig);

        const o = ostreamIndex++;
        iToO[i] = o;
        decoders.push(decoder);
        encoders.push({ encoder, config: encConfig });
        decoderStreams.push(new BufferStream());
        encoderStreams.push(new BufferStream());
        ostreams.push(await bridge.configToVideoStream(tempLibav, encConfig));
      } else if (istream.codec_type === tempLibav.AVMEDIA_TYPE_AUDIO) {
        const decoderConfig = await bridge.audioStreamToConfig(
          tempLibav,
          istream,
        );
        if (!decoderConfig) continue;
        if (
          !(
            await AudioDecoder.isConfigSupported(
              decoderConfig as AudioDecoderConfig,
            )
          ).supported
        )
          continue;

        const decoder = new AudioDecoder({
          output: (frame) => decoderStreams[o].push(frame),
          error: (e) => console.error("Audio Decoder Error:", e),
        });
        decoder.configure(decoderConfig as AudioDecoderConfig);

        const encConfig = {
          codec: "opus",
          sampleRate: decoderConfig.sampleRate,
          numberOfChannels: decoderConfig.numberOfChannels,
        };
        const encoder = new AudioEncoder({
          output: (chunk, meta) => encoderStreams[o].push({ chunk, meta }),
          error: (e) => console.error("Audio Encoder Error:", e),
        });
        encoder.configure(encConfig);

        const o = ostreamIndex++;
        iToO[i] = o;
        decoders.push(decoder);
        encoders.push({ encoder, config: encConfig });
        decoderStreams.push(new BufferStream());
        encoderStreams.push(new BufferStream());
        ostreams.push(await bridge.configToAudioStream(tempLibav, encConfig));
      }
    }

    if (ostreamIndex === 0) throw new Error("No decodable streams found.");

    // --- Pipeline Execution ---
    const demuxerPromise = (async () => {
      while (true) {
        const [res, packets] = await tempLibav.ff_read_frame_multi(ifc, rpkt);

        // Report progress based on how much of the input file has been read
        const ifcWithPb = ifc as LibAVFormatContext;
        if (ifcWithPb.pb && ifcWithPb.pb.size > 0) {
          const demuxProgress = ifcWithPb.pb.pos / ifcWithPb.pb.size;
          onProgress?.(Math.round(demuxProgress * 100), "Decoding video...");
        }

        for (const idx in packets) {
          const oidx = iToO[Number(idx)];
          if (oidx < 0) continue;
          const dec = decoders[oidx];
          const istream = istreams[Number(idx)];
          for (const packet of packets[idx]) {
            const chunk =
              istream.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO
                ? bridge.packetToEncodedVideoChunk(packet, istream)
                : bridge.packetToEncodedAudioChunk(packet, istream);
            dec.decode(chunk);
          }
        }
        if (res === tempLibav.AVERROR_EOF) break;
      }
      for (let i = 0; i < decoders.length; i++) {
        await decoders[i].flush();
        decoderStreams[i].push(null);
      }
    })();

    const modifyFrame = this.createFrameModifier();

    const encoderPromises = encoders.map(({ encoder, config }, i) => {
      return (async () => {
        const reader = decoderStreams[i].getReader();
        while (true) {
          const { done, value: frame } = await reader.read();
          if (done) break;

          if (encoder instanceof VideoEncoder) {
            onProgress?.(
              Math.round((frame.timestamp / totalDuration) * 100),
              "palettifying...",
            );

            const modifiedFrame = await modifyFrame(frame);
            const encOptions: VideoEncoderEncodeOptions = {};
            const codecId = config.codec;
            const qp = 0;

            if (codecId.startsWith("vp09")) {
              encOptions.vp9 = { quantizer: qp };
            } else if (codecId.startsWith("av01")) {
              encOptions.av1 = { quantizer: qp };
            } else if (codecId.startsWith("avc")) {
              encOptions.avc = { quantizer: qp };
            } else if (
              codecId.startsWith("hvc1") ||
              codecId.startsWith("hev1")
            ) {
              encOptions.hevc = { quantizer: qp };
            }

            encoder.encode(modifiedFrame, encOptions as any);
            modifiedFrame.close();
          } else {
            encoder.encode(frame);
            frame.close();
          }
        }
        await encoder.flush();
        encoderStreams[i].push(null);
      })();
    });

    // --- Muxing ---
    const [ofc, , pb] = await tempLibav.ff_init_muxer(
      { filename: "output.mkv", open: true, codecpars: true },
      ostreams,
    );

    const starterPackets: any[] = [];
    const encoderReaders = encoderStreams.map((s) => s.getReader());
    for (let i = 0; i < ostreams.length; i++) {
      const { done, value } = await encoderReaders[i].read();
      if (done) continue;
      const ostream = ostreams[i];
      const packet =
        ostream.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO
          ? await bridge.encodedVideoChunkToPacket(
              tempLibav,
              value.chunk,
              value.meta,
              ostream,
              i,
            )
          : await bridge.encodedAudioChunkToPacket(
              tempLibav,
              value.chunk,
              value.meta,
              ostream,
              i,
            );
      starterPackets.push(packet);
    }

    await tempLibav.avformat_write_header(ofc, 0);
    await tempLibav.ff_write_multi(ofc, wpkt, starterPackets);

    const muxerPromises = encoderReaders.map((reader, i) => {
      return (async () => {
        const ostream = ostreams[i];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const packet =
            ostream.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO
              ? await bridge.encodedVideoChunkToPacket(
                  tempLibav,
                  value.chunk,
                  value.meta,
                  ostream,
                  i,
                )
              : await bridge.encodedAudioChunkToPacket(
                  tempLibav,
                  value.chunk,
                  value.meta,
                  ostream,
                  i,
                );
          await tempLibav.ff_write_multi(ofc, wpkt, [packet]);

          if (ostream.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO) {
            onProgress?.(
              Math.round((value.chunk.timestamp / totalDuration) * 100),
              "Assembling final file...",
            );
          }
        }
      })();
    });

    await Promise.all([demuxerPromise, ...encoderPromises, ...muxerPromises]);

    await tempLibav.av_write_trailer(ofc);

    // --- Cleanup ---
    await tempLibav.avformat_close_input_js(ifc);
    await tempLibav.ff_free_muxer(ofc, pb);
    await tempLibav.av_packet_free(rpkt);
    await tempLibav.av_packet_free(wpkt);
    await tempLibav.unlink("input-export");

    const output = await tempLibav.readFile("output.mkv");

    onProgress?.(100, "Done!");

    this.play();
    return new Blob([output.buffer], { type: "video/x-matroska" });
  }
}
