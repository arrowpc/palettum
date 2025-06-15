import { Config, process_pixels } from "palettum";
import LibAV, {
  type LibAV as LibAVInstance,
} from "@libav.js/variant-webcodecs";
import * as LibAVWebCodecsBridge from "libavjs-webcodecs-bridge";
import * as LibAVWebCodecs from "libavjs-webcodecs-polyfill";

export type ProgressCallback = (progress: {
  percentage: number;
  message: string;
}) => void;

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

interface TranscoderState {
  libav: LibAVInstance | undefined;
  bridge: typeof LibAVWebCodecsBridge | undefined;
  initializing: Promise<void> | undefined;
}

const state: TranscoderState = {
  libav: undefined,
  bridge: undefined,
  initializing: undefined,
};

type Stage = "INIT" | "SETUP" | "DECODE" | "ENCODE" | "MUX";

class ProgressManager {
  private onProgress: ProgressCallback;
  private totalDuration: number;
  private stageBaselines: Record<Stage, number> = {
    INIT: 0,
    SETUP: 5,
    DECODE: 7,
    ENCODE: 20,
    MUX: 99,
  };
  private stageWeights: Record<Stage, number> = {
    INIT: 5,
    SETUP: 10,
    DECODE: 5,
    ENCODE: 75,
    MUX: 5,
  };

  constructor(onProgress: ProgressCallback, totalDuration: number) {
    this.onProgress = onProgress;
    this.totalDuration = totalDuration > 0 ? totalDuration : 1;
  }

  update(stage: Stage, stageProgress: number, message: string) {
    const base = this.stageBaselines[stage];
    const weight = this.stageWeights[stage];
    const percentage = base + stageProgress * weight;

    this.onProgress({
      percentage: Math.min(100, Math.round(percentage)),
      message,
    });
  }

  /** Reports progress based on a timestamp relative to the total video duration */
  updateFromTimestamp(stage: Stage, timestamp: number, message: string) {
    const stageProgress = timestamp / this.totalDuration;
    this.update(stage, stageProgress, message);
  }
}

async function initialize(progressManager: ProgressManager): Promise<void> {
  if (state.libav) return;
  if (state.initializing) return state.initializing;

  state.initializing = (async () => {
    try {
      progressManager.update("INIT", 0, "Loading libraries...");
      await LibAVWebCodecs.load({
        polyfill: true,
        LibAV: LibAV,
        libavOptions: { yesthreads: true, base: "/_libav" },
      });
      progressManager.update("INIT", 0.5, "Initializing LibAV...");
      state.libav = await LibAV.LibAV({ base: "/_libav" });
      state.bridge = LibAVWebCodecsBridge;
    } catch (error) {
      console.error("Initialization failed:", error);
      throw new Error("Failed to initialize transcoding libraries.");
    } finally {
      state.initializing = undefined;
    }
  })();
  return state.initializing;
}

class BufferStream extends ReadableStream<any> {
  private buf: any[] = [];
  private res: (() => void) | null = null;
  constructor() {
    super({
      pull: async (controller) => {
        while (this.buf.length === 0) {
          await new Promise<void>((res) => (this.res = res));
        }
        const next = this.buf.shift();
        if (next !== null) controller.enqueue(next);
        else controller.close();
      },
    });
  }
  push(next: any) {
    this.buf.push(next);
    if (this.res) {
      const res = this.res;
      this.res = null;
      res();
    }
  }
}

function createFrameModifier(config: Config) {
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;
  return async function palettify(frame: any): Promise<VideoFrame> {
    if (!canvas) {
      canvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!ctx) throw new Error("Could not get canvas context");
    let imageBitmap = await createImageBitmap(frame);
    ctx.drawImage(imageBitmap, 0, 0);

    const imageData = ctx.getImageData(
      0,
      0,
      frame.codedWidth,
      frame.codedHeight,
    );
    await process_pixels(
      new Uint8Array(imageData.data.buffer),
      frame.codedWidth,
      frame.codedHeight,
      config,
    );

    ctx.putImageData(imageData, 0, 0);

    const frameInit: VideoFrameBufferInit = {
      duration: frame.duration,
      timestamp: frame.timestamp,
      codedWidth: frame.codedWidth,
      codedHeight: frame.codedHeight,
      format: "BGRA",
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

export async function transcode(
  file: File,
  config: Config,
  onProgress: ProgressCallback,
): Promise<Blob> {
  const tempLibav = await LibAV.LibAV({ base: "/_libav" });
  await tempLibav.mkreadaheadfile("input-probe", file);
  const [probeIfc, probeStreams] =
    await tempLibav.ff_init_demuxer_file("input-probe");

  const videoStream = probeStreams.find(
    (s) => s.codec_type === tempLibav.AVMEDIA_TYPE_VIDEO,
  );

  if (!videoStream || !videoStream.duration || !videoStream.time_base_num) {
    throw new Error("Could not determine video duration from stream metadata.");
  }

  const durationInSeconds = videoStream.duration * videoStream.time_base_num;
  const totalDuration = durationInSeconds * 1_000_000;

  await tempLibav.avformat_close_input_js(probeIfc);
  tempLibav.terminate();

  const progressManager = new ProgressManager(onProgress, totalDuration);

  await initialize(progressManager);
  const { libav, bridge } = state;
  if (!libav) throw new Error("LibAV not initialized");
  if (!bridge) throw new Error("Bridge not initialized");

  progressManager.update("SETUP", 0, "Analyzing input file...");
  await libav.mkreadaheadfile("input", file);
  const [ifc, istreams] = await libav.ff_init_demuxer_file("input");
  const rpkt = await libav.av_packet_alloc();
  const wpkt = await libav.av_packet_alloc();

  progressManager.update("SETUP", 0.5, "Configuring decoders & encoders...");

  // --- Stream Setup ---
  const iToO: number[] = [];
  const decoders: (VideoDecoder | AudioDecoder)[] = [];
  const decoderStreams: BufferStream[] = [];
  const encoders: {
    encoder: VideoEncoder | AudioEncoder;
    config: VideoEncoderConfig | AudioEncoderConfig;
  }[] = [];
  const encoderStreams: BufferStream[] = [];
  const ostreams: any[] = [];
  let ostreamIndex = 0;

  // https://www.webmproject.org/vp9/mp4/
  const vc = "vp09.01.50.08.03.01.01.00.01";

  for (let i = 0; i < istreams.length; i++) {
    const istream = istreams[i];
    iToO.push(-1);
    if (istream.codec_type === libav.AVMEDIA_TYPE_VIDEO) {
      const decoderConfig = await bridge.videoStreamToConfig(libav, istream);
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
          throw new Error("Codec is notRsupported");
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
      ostreams.push(await bridge.configToVideoStream(libav, encConfig));
    } else if (istream.codec_type === libav.AVMEDIA_TYPE_AUDIO) {
      const decoderConfig = await bridge.audioStreamToConfig(libav, istream);
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
      ostreams.push(await bridge.configToAudioStream(libav, encConfig));
    }
  }

  if (ostreamIndex === 0) throw new Error("No decodable streams found.");

  // --- Pipeline Execution ---
  const demuxerPromise = (async () => {
    while (true) {
      const [res, packets] = await libav.ff_read_frame_multi(ifc, rpkt);

      // Report progress based on how much of the input file has been read
      const ifcWithPb = ifc as LibAVFormatContext;
      if (ifcWithPb.pb && ifcWithPb.pb.size > 0) {
        const demuxProgress = ifcWithPb.pb.pos / ifcWithPb.pb.size;
        progressManager.update("DECODE", demuxProgress, "Decoding video...");
      }

      for (const idx in packets) {
        const oidx = iToO[Number(idx)];
        if (oidx < 0) continue;
        const dec = decoders[oidx];
        const istream = istreams[Number(idx)];
        for (const packet of packets[idx]) {
          const chunk =
            istream.codec_type === libav.AVMEDIA_TYPE_VIDEO
              ? bridge.packetToEncodedVideoChunk(packet, istream)
              : bridge.packetToEncodedAudioChunk(packet, istream);
          dec.decode(chunk);
        }
      }
      if (res === libav.AVERROR_EOF) break;
    }
    for (let i = 0; i < decoders.length; i++) {
      await decoders[i].flush();
      decoderStreams[i].push(null);
    }
  })();

  const modifyFrame = createFrameModifier(config);

  const encoderPromises = encoders.map(({ encoder, config }, i) => {
    return (async () => {
      const reader = decoderStreams[i].getReader();
      while (true) {
        const { done, value: frame } = await reader.read();
        if (done) break;

        if (encoder instanceof VideoEncoder) {
          progressManager.updateFromTimestamp(
            "ENCODE",
            frame.timestamp,
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
          } else if (codecId.startsWith("hvc1") || codecId.startsWith("hev1")) {
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
  const [ofc, , pb] = await libav.ff_init_muxer(
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
      ostream.codec_type === libav.AVMEDIA_TYPE_VIDEO
        ? await bridge.encodedVideoChunkToPacket(
          libav,
          value.chunk,
          value.meta,
          ostream,
          i,
        )
        : await bridge.encodedAudioChunkToPacket(
          libav,
          value.chunk,
          value.meta,
          ostream,
          i,
        );
    starterPackets.push(packet);
  }

  await libav.avformat_write_header(ofc, 0);
  await libav.ff_write_multi(ofc, wpkt, starterPackets);

  const muxerPromises = encoderReaders.map((reader, i) => {
    return (async () => {
      const ostream = ostreams[i];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const packet =
          ostream.codec_type === libav.AVMEDIA_TYPE_VIDEO
            ? await bridge.encodedVideoChunkToPacket(
              libav,
              value.chunk,
              value.meta,
              ostream,
              i,
            )
            : await bridge.encodedAudioChunkToPacket(
              libav,
              value.chunk,
              value.meta,
              ostream,
              i,
            );
        await libav.ff_write_multi(ofc, wpkt, [packet]);

        if (ostream.codec_type === libav.AVMEDIA_TYPE_VIDEO) {
          progressManager.updateFromTimestamp(
            "MUX",
            value.chunk.timestamp,
            "Assembling final file...",
          );
        }
      }
    })();
  });

  await Promise.all([demuxerPromise, ...encoderPromises, ...muxerPromises]);

  await libav.av_write_trailer(ofc);

  // --- Cleanup ---
  await libav.avformat_close_input_js(ifc);
  await libav.ff_free_muxer(ofc, pb);
  await libav.av_packet_free(rpkt);
  await libav.av_packet_free(wpkt);

  const output = await libav.readFile("output.mkv");
  libav.terminate();
  state.libav = undefined; // Reset for next run

  onProgress({ percentage: 100, message: "Done!" });
  return new Blob([output.buffer], { type: "video/x-matroska" });
}

export async function getDemuxer(file: File) {
  if (!state.libav) throw new Error("LibAV not initialized");

  await state.libav.mkreadaheadfile("input", file);
  const [ifc, istreams] = await state.libav.ff_init_demuxer_file("input");
  return { ifc, istreams, libav: state.libav, bridge: state.bridge };
}

export async function* decodeFrames(
  demuxerCtx: any,
  videoStreamIndex: number,
): AsyncGenerator<any, void, void> {
  const { ifc, istreams, libav, bridge } = demuxerCtx;
  const istream = istreams[videoStreamIndex];
  const config = await bridge.videoStreamToConfig(libav, istream);
  if (!(await VideoDecoder.isConfigSupported(config)).supported) {
    throw new Error("Video format not supported for decoding.");
  }

  const frameBuffer = new BufferStream();
  const decoder = new VideoDecoder({
    output: (frame) => frameBuffer.push(frame),
    error: (e) => console.error("Decoder Error:", e),
  });
  decoder.configure(config);

  const reader = frameBuffer.getReader();
  const rpkt = await libav.av_packet_alloc();

  (async () => {
    try {
      while (true) {
        const [res, packets] = await libav.ff_read_frame_multi(ifc, rpkt);
        if (packets[videoStreamIndex]) {
          for (const packet of packets[videoStreamIndex]) {
            const chunk = bridge.packetToEncodedVideoChunk(packet, istream);
            decoder.decode(chunk);
          }
        }
        if (res === libav.AVERROR_EOF) {
          await decoder.flush();
          decoder.close();
          frameBuffer.push(null);
          break;
        }
      }
    } finally {
      await libav.av_packet_free(rpkt);
    }
  })();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}
