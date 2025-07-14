import { GifHandler } from "./gif";
import { ImageHandler } from "./image";
import { VideoHandler } from "./video";

const MEDIA_HANDLERS = [
  { handler: GifHandler, extensions: ["gif"] },
  { handler: ImageHandler, extensions: ["png", "jpg", "jpeg", "webp"] },
  { handler: VideoHandler, extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
];

export type MediaHandler =
  | typeof GifHandler
  | typeof ImageHandler
  | typeof VideoHandler;

export async function createMediaHandlerForFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) throw new Error("File has no extension");

  const handlerInfo = MEDIA_HANDLERS.find((h) =>
    h.extensions.includes(extension),
  );
  if (!handlerInfo) throw new Error(`Unsupported file type: ${extension}`);

  return new handlerInfo.handler(file);
}
