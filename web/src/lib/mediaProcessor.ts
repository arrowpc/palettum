import { ImageFilter } from "palettum";
import { LIMITS } from "@/lib/palettes";

interface MediaDimensions {
  width: number;
  height: number;
}

interface ProcessedMediaResult {
  sourceMediaType: "image" | "video";
  sourceDimensions: MediaDimensions;
  play: () => void;
  cleanup: () => void;
}

export function convertGifToVideo(
  file: File,
  onProgress: (progress: number) => void,
  onStatus: (message: string) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("@/lib/ffmpeg.worker.ts", import.meta.url),
      { type: "module" },
    );

    const handleWorkerMessage = (
      event: MessageEvent<{
        type: string;
        progress?: number;
        message?: string;
        blob?: Blob;
      }>,
    ) => {
      const { type, progress, message, blob } = event.data;
      switch (type) {
        case "status":
          if (message) onStatus(message);
          break;
        case "progress":
          if (progress) onProgress(progress);
          break;
        case "done":
          worker.terminate();
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Conversion finished but no blob was received."));
          }
          break;
        case "error":
          worker.terminate();
          reject(new Error(message || "An unknown conversion error occurred."));
          break;
      }
    };

    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", (err) => {
      worker.terminate();
      reject(new Error(`Worker error: ${err.message}`));
    });

    worker.postMessage({ file });
  });
}

export async function processImage(
  file: File,
  filter: ImageFilter,
): Promise<ProcessedMediaResult> {
  try {
    let bitmap = await createImageBitmap(file);
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;

    if (
      bitmap.width > LIMITS.MAX_DIMENSION ||
      bitmap.height > LIMITS.MAX_DIMENSION
    ) {
      const ratio = Math.min(
        LIMITS.MAX_DIMENSION / bitmap.width,
        LIMITS.MAX_DIMENSION / bitmap.height,
      );
      const newWidth = Math.floor(bitmap.width * ratio);
      const newHeight = Math.floor(bitmap.height * ratio);

      const offscreenCanvas = new OffscreenCanvas(newWidth, newHeight);
      const ctx = offscreenCanvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        throw new Error("Could not create offscreen canvas context.");
      }
      ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

      bitmap.close();
      bitmap = await createImageBitmap(offscreenCanvas);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    }

    filter.update_from_image_bitmap(bitmap);

    let animationFrameId: number | null = null;

    const play = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      const renderLoop = () => {
        try {
          filter.render();
        } catch (e) {
          console.error("Error in image render loop:", e);
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          return;
        }
        animationFrameId = requestAnimationFrame(renderLoop);
      };
      renderLoop();
    };

    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const result: ProcessedMediaResult = {
      sourceMediaType: "image",
      sourceDimensions: { width: sourceWidth, height: sourceHeight },
      play,
      cleanup,
    };

    bitmap.close();
    return result;
  } catch (err) {
    console.error("Failed to process image:", err);
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    throw new Error(`Failed to load image: ${message}`);
  }
}

export function processVideo(
  videoBlob: Blob,
  filter: ImageFilter,
): Promise<ProcessedMediaResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const videoUrl = URL.createObjectURL(videoBlob);
    let animationFrameId: number | null = null;
    let offscreenCanvas: OffscreenCanvas | null = null;
    let displayWidth: number;
    let displayHeight: number;

    video.src = videoUrl;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(videoUrl);
    };

    video.onloadedmetadata = async () => {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        cleanup();
        return reject(new Error("Video has invalid dimensions."));
      }

      displayWidth = video.videoWidth;
      displayHeight = video.videoHeight;

      if (
        video.videoWidth > LIMITS.MAX_DIMENSION ||
        video.videoHeight > LIMITS.MAX_DIMENSION
      ) {
        const ratio = Math.min(
          LIMITS.MAX_DIMENSION / video.videoWidth,
          LIMITS.MAX_DIMENSION / video.videoHeight,
        );
        displayWidth = Math.floor(video.videoWidth * ratio);
        displayHeight = Math.floor(video.videoHeight * ratio);
        offscreenCanvas = new OffscreenCanvas(displayWidth, displayHeight);
      }

      const renderVideoFrame = async () => {
        if (video.paused || video.readyState < video.HAVE_CURRENT_DATA) {
          animationFrameId = requestAnimationFrame(
            renderVideoFrame as FrameRequestCallback,
          );
          return;
        }
        try {
          if (offscreenCanvas) {
            const ctx = offscreenCanvas.getContext("2d");
            if (!ctx) throw new Error("Failed to get canvas context.");
            ctx.drawImage(video, 0, 0, displayWidth, displayHeight);
            const bitmap = await createImageBitmap(offscreenCanvas);
            filter.update_from_image_bitmap(bitmap);
            bitmap.close();
          } else {
            filter.update_from_video_frame(video);
          }
        } catch (e) {
          console.error("Error updating video frame:", e);
          cleanup();
          return;
        }
        animationFrameId = requestAnimationFrame(
          renderVideoFrame as FrameRequestCallback,
        );
      };

      const play = () => {
        video.play().catch((playError) => {
          console.error("Video play error:", playError);
          reject(new Error("Could not play video automatically."));
        });
        renderVideoFrame();
      };

      resolve({
        sourceMediaType: "video",
        sourceDimensions: {
          width: displayWidth,
          height: displayHeight,
        },
        play,
        cleanup,
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video. Please try another file."));
    };
  });
}
