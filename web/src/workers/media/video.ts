const LOOP = true;

import type { LibAV as LibAVInstance } from "@libav.js/variant-webcodecs";
import type * as LibAVWebCodecsBridge from "libavjs-webcodecs-bridge";
import { initLibAV } from "../libav";
import { getRenderer } from "../core/renderer";
import { BufferStream } from "../utils/buffer-stream";

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

// The way I resize here is nothing short of disgusting; it's 5am and I'm done thinking about this
function createFrameModifier() {
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;
  return async function palettify(frame: any): Promise<VideoFrame> {
    const { palettify_frame, resize_frame } = await import("palettum");

    const tempCanvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
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

export class VideoHandler {
  private playing = true;
  private disposed = false;
  private frameQueue = new BufferStream<VideoFrame>();
  private vConfig: VideoDecoderConfig | null = null;
  private drawHandle: number | undefined;
  private ifc = 0;
  private rpkt = 0;
  private decoder!: VideoDecoder;
  private frameReader: ReadableStreamDefaultReader<VideoFrame | null> | null =
    null;
  private libav: LibAVInstance | null = null;
  private bridge: typeof LibAVWebCodecsBridge | null = null;
  private file: Blob;
  public width = 0;
  public height = 0;

  constructor(file: File) {
    this.file = file;
  }

  async init(): Promise<void> {
    this.frameQueue = new BufferStream<VideoFrame>();
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
    this.vConfig = vConfig as VideoDecoderConfig;
    this.width = this.vConfig.codedWidth || 0;
    this.height = this.vConfig.codedHeight || 0;
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
          // Pause demuxing if frameQueue is too full
          while (this.frameQueue.size() > 30 && !this.disposed) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

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

          if (res === this.libav.AVERROR_EOF) {
            if (LOOP) {
              await this.decoder.flush();

              this.frameQueue.push(null);

              await this.libav.avformat_seek_file(
                this.ifc,
                -1,
                0,
                0,
                0,
                0,
                0,
                0,
                this.libav.AVSEEK_FLAG_ANY,
              );

              this.decoder.reset();
              this.decoder.configure(this.vConfig!);

              this.frameQueue = new BufferStream<VideoFrame>();

              continue;
            } else {
              break;
            }
          }
        }
        if (!LOOP || this.disposed) {
          await this.decoder.flush();
          this.frameQueue.push(null);
        }
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

        if (done) {
          if (LOOP) {
            // The old stream has ended. We get a reader for the new stream
            this.frameReader?.releaseLock();
            this.frameReader = this.frameQueue.getReader();

            const { value: newFirstFrame } = await this.frameReader.read();

            if (newFirstFrame) {
              nextFrame = newFirstFrame;
            } else {
              // This case is less likely now but good for safety
              // It might happen if the video is disposed during the loop transition
              this.drawHandle = self.setTimeout(drawNext, 50);
              return;
            }
          } else {
            return; // Not looping, so stop drawing
          }
        } else {
          nextFrame = value || null;
        }
      }

      if (!nextFrame) {
        return;
      }

      const bmp = await createImageBitmap(nextFrame);
      r.draw(bmp);
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

  isPlaying() {
    return this.playing;
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
      } catch (e) {}
      if (this.ifc) await this.libav.avformat_close_input_js(this.ifc);
      if (this.rpkt) await this.libav.av_packet_free(this.rpkt);
    }
    this.decoder?.close();
  }

  async export(
    onProgress?: (progress: number, message: string) => void,
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

    const modifyFrame = createFrameModifier();

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
