import { type Player } from "./interface";
import { ImagePlayer } from "./image";
import { GifPlayer } from "./gif";
import { VideoPlayer } from "./video";

export { type Player } from "./interface";

export async function createPlayerForFile(file: Blob): Promise<Player> {
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    return new ImagePlayer(file);
  } else if (file.type === "image/gif") {
    const buffer = await file.arrayBuffer();
    return new GifPlayer(buffer);
  } else if (file.type.startsWith("video/")) {
    return new VideoPlayer(file);
  } else {
    throw new Error(
      `Unknown file type: ${file.type}. Attempting video playback.`,
    );
  }
}
