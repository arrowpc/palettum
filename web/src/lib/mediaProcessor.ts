import { ImageFilter } from "palettum";
import { LIMITS } from "@/lib/palettes";

interface MediaDimensions {
  width: number;
  height: number;
}

interface ProcessedVideoResult {
  sourceMediaType: "video";
  sourceDimensions: MediaDimensions;
  play: () => void;
  cleanup: () => void;
}

interface ProcessedImageResult {
  sourceMediaType: "image";
  sourceDimensions: MediaDimensions;
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

export function processImage(
  file: File,
  filter: ImageFilter,
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      if (
        img.width > LIMITS.MAX_DIMENSION ||
        img.height > LIMITS.MAX_DIMENSION
      ) {
        return reject(
          new Error(`Image dimensions exceed ${LIMITS.MAX_DIMENSION}px.`),
        );
      }

      const decodeCanvas = new OffscreenCanvas(img.width, img.height);
      const decodeCtx = decodeCanvas.getContext("2d");
      if (!decodeCtx) {
        return reject(new Error("Could not get OffscreenCanvas context."));
      }
      decodeCtx.drawImage(img, 0, 0);
      const imageData = decodeCtx.getImageData(0, 0, img.width, img.height);
      const pixelData = new Uint8Array(imageData.data.buffer);

      try {
        filter.set_image_data(img.width, img.height, pixelData);
        resolve({
          sourceMediaType: "image",
          sourceDimensions: { width: img.width, height: img.height },
        });
      } catch (filterError) {
        console.error("ImageFilter error for image:", filterError);
        reject(new Error("Failed to process image with renderer."));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image."));
    };

    img.src = url;
  });
}

export function processVideo(
  videoBlob: Blob,
  filter: ImageFilter,
): Promise<ProcessedVideoResult> {
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
