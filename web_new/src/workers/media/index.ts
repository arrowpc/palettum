import { ImageHandler } from "./image";
import { GifHandler } from "./gif";
import { VideoHandler } from "./video";

export async function createMediaHandlerForFile(file: Blob) {
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    return new ImageHandler(file);
  } else if (file.type === "image/gif") {
    return new GifHandler(file);
  } else if (file.type.startsWith("video/")) {
    return new VideoHandler(file);
  } else {
    throw new Error(
      `Unknown file type: ${file.type}. Attempting video playback.`,
    );
  }
}
