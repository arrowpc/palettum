/**
 * @file transcoder.ts
 * A comprehensive, modular library for client-side video transcoding.
 *
 * This library uses LibAV.js (via WebAssembly) and the WebCodecs API (with a
 * polyfill for compatibility) to perform video operations in the browser.
 *
 * It is designed to run inside a Web Worker to avoid blocking the main UI thread.
 */

import { Config, process_pixels } from "@/wasm/pkg/wasm";
import LibAV from "@libav.js/variant-webcodecs";
import * as LibAVWebCodecsBridge from "libavjs-webcodecs-bridge";
import * as LibAVWebCodecs from "libavjs-webcodecs-polyfill";

// --- TYPE DEFINITIONS ---

export type ProgressCallback = (progress: {
  percentage: number;
  message: string;
}) => void;

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

// --- STATE MANAGEMENT ---
const state: {
  libav: any;
  bridge: any;
  initializing: Promise<void> | null;
} = {
  libav: null,
  bridge: null,
  initializing: null,
};

/**
 * Loads and initializes the required libraries (LibAV, WebCodecs Polyfill).
 * This function is idempotent and safe to call multiple times.
 */
async function initialize(onProgress: ProgressCallback): Promise<void> {
  if (state.libav) return;
  if (state.initializing) return state.initializing;

  state.initializing = (async () => {
    try {
      onProgress({ percentage: 0, message: "Loading libraries..." });

      onProgress({ percentage: 10, message: "Initializing WebCodecs..." });
      await LibAVWebCodecs.load({
        polyfill: false,
        LibAV: LibAV,
        libavOptions: { base: "/_libav" },
      });

      onProgress({ percentage: 10, message: "Initializing LibAV..." });
      state.libav = await LibAV.LibAV({ base: "/_libav" });

      state.bridge = LibAVWebCodecsBridge;
    } catch (error) {
      console.error("Initialization failed:", error);
      throw new Error("Failed to initialize transcoding libraries.");
    } finally {
      state.initializing = null;
    }
  })();
  return state.initializing;
}

// --- HELPER CLASSES AND FUNCTIONS ---

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

// --- HIGH-LEVEL API ---

/**
 * Transcodes a video file, applying a color modification to each frame.
 * @param file The input video file.
 * @param config The configuration for the pixel processing.
 * @param onProgress A callback to report progress updates.
 * @returns A Blob containing the transcoded video data.
 */
export async function transcode(
  file: File,
  config: Config,
  onProgress: ProgressCallback,
): Promise<Blob> {
  await initialize(onProgress);
  const { libav, bridge } = state;

  await libav.mkreadaheadfile("input", file);
  onProgress({ percentage: 25, message: "Demuxing input file..." });
  const [ifc, istreams] = await libav.ff_init_demuxer_file("input");
  const rpkt = await libav.av_packet_alloc();
  const wpkt = await libav.av_packet_alloc();

  const totalDuration = ifc.duration / 1000000; // in seconds

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
      if (!(await VideoDecoder.isConfigSupported(decoderConfig)).supported)
        continue;

      const decoder = new VideoDecoder({
        output: (frame) => decoderStreams[o].push(frame),
        error: (e) => console.error("Video Decoder Error:", e),
      });
      decoder.configure(decoderConfig);

      const encConfig: VideoEncoderConfig = {
        codec: vc,
        width: decoderConfig.codedWidth,
        height: decoderConfig.codedHeight,
        bitrateMode: "quantizer",
        latencyMode: "quality",
        // TODO: Figure out why this breaks
        // hardwareAcceleration: "prefer-hardware",
      };

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
      ostreams.push(await bridge.configToVideoStream(libav, encConfig, o));
    } else if (istream.codec_type === libav.AVMEDIA_TYPE_AUDIO) {
      const decoderConfig = await bridge.audioStreamToConfig(libav, istream);
      if (!(await AudioDecoder.isConfigSupported(decoderConfig)).supported)
        continue;

      const decoder = new AudioDecoder({
        output: (frame) => decoderStreams[o].push(frame),
        error: (e) => console.error("Audio Decoder Error:", e),
      });
      decoder.configure(decoderConfig);

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
      ostreams.push(await bridge.configToAudioStream(libav, encConfig, o));
    }
  }

  if (ostreamIndex === 0) throw new Error("No decodable streams found.");

  // --- Pipeline Execution ---
  const demuxerPromise = (async () => {
    while (true) {
      const [res, packets] = await libav.ff_read_frame_multi(ifc, rpkt);
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
          const percentage =
            30 + (value.chunk.timestamp / 1000000 / totalDuration) * 65;
          onProgress({
            percentage: Math.min(95, Math.round(percentage)),
            message: "Transcoding...",
          });
        }
      }
    })();
  });

  await Promise.all([demuxerPromise, ...encoderPromises, ...muxerPromises]);

  onProgress({ percentage: 98, message: "Finalizing file..." });
  await libav.av_write_trailer(ofc);

  // --- Cleanup ---
  await libav.avformat_close_input_js(ifc);
  await libav.ff_free_muxer(ofc, pb);
  await libav.av_packet_free(rpkt);
  await libav.av_packet_free(wpkt);

  const output = await libav.readFile("output.mkv");
  await libav.terminate();
  state.libav = null; // Reset for next run

  onProgress({ percentage: 100, message: "Done!" });
  return new Blob([output.buffer], { type: "video/x-matroska" });
}

// --- MODULAR API ---

/**
 * Initializes the system and returns a demuxer for a given file.
 */
export async function getDemuxer(file: File, onProgress: ProgressCallback) {
  await initialize(onProgress);
  await state.libav.mkreadaheadfile("input", file);
  const [ifc, istreams] = await state.libav.ff_init_demuxer_file("input");
  return { ifc, istreams, libav: state.libav, bridge: state.bridge };
}

/**
 * An async generator that decodes a video stream and yields VideoFrames.
 */
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
