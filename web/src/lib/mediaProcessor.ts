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
    const bitmap = await createImageBitmap(file);

    if (
      bitmap.width > LIMITS.MAX_DIMENSION ||
      bitmap.height > LIMITS.MAX_DIMENSION
    ) {
      bitmap.close();
      throw new Error(`Image dimensions exceed ${LIMITS.MAX_DIMENSION}px.`);
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
      sourceDimensions: { width: bitmap.width, height: bitmap.height },
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

      const renderVideoFrame = () => {
        if (video.paused || video.readyState < video.HAVE_CURRENT_DATA) {
          animationFrameId = requestAnimationFrame(renderVideoFrame);
          return;
        }
        try {
          filter.update_from_video_frame(video);
        } catch (e) {
          console.error("Error updating video frame:", e);
          cleanup();
          return;
        }
        animationFrameId = requestAnimationFrame(renderVideoFrame);
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
          width: video.videoWidth,
          height: video.videoHeight,
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
