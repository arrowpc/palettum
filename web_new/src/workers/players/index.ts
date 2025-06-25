import { type Player } from "./interface";
import { ImagePlayer } from "./image";
import { GifPlayer } from "./gif";
import { VideoPlayer } from "./video";

export { type Player } from "./interface";

/**
 * Creates the appropriate player instance based on the file's MIME type.
 * @param file The file to create a player for.
 * @returns A promise that resolves to a Player instance.
 */
export async function createPlayerForFile(file: Blob): Promise<Player> {
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    const bmp = await createImageBitmap(file);
    return new ImagePlayer(bmp);
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
