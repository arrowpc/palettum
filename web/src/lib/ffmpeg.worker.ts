import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  const { file } = event.data;

  try {
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();

      ffmpeg.on("log", ({ message }) => {
        self.postMessage({ type: "log", message });
      });

      ffmpeg.on("progress", ({ progress }) => {
        self.postMessage({ type: "progress", progress });
      });

      const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
      self.postMessage({ type: "status", message: "Loading converter..." });
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript",
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
        workerURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.worker.js`,
          "text/javascript",
        ),
      });
    }

    self.postMessage({ type: "status", message: "Starting conversion..." });
    await ffmpeg.writeFile("input.gif", await fetchFile(file));
    await ffmpeg.exec([
      "-i",
      "input.gif",
      "-movflags",
      "faststart",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "output.mp4",
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    const videoBlob = new Blob([data.buffer], { type: "video/mp4" });

    self.postMessage({ type: "done", blob: videoBlob });
  } catch (error) {
    console.error("FFmpeg worker error:", error);
    self.postMessage({
      type: "error",
      message: "Failed to convert GIF. It may be corrupted or unsupported.",
    });
  }
};
