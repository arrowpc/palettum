import { useEffect, useRef } from "react";
import { transfer } from "comlink";
import { useRenderer } from "@/renderer-provider";

export const MEDIA_CANVAS_ID = "media";

interface Props {
  file: File;
}

export default function CanvasPreview({ file }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRenderer();

  useEffect(() => {
    renderer.load(file).catch(console.error);
  }, [file, renderer]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;

    const parent = el.parentElement;
    if (!parent) return;

    const run = async () => {
      const off = el.transferControlToOffscreen();
      off.width = parent.offsetWidth;
      off.height = parent.offsetHeight;

      try {
        await renderer.registerCanvas(MEDIA_CANVAS_ID, transfer(off, [off]));
      } catch (err) {
        console.error(err);
      }
    };

    run();

    return () => {
      // done in media-container
      // renderer.disposeCanvas(MEDIA_CANVAS_ID).catch(console.error);
    };
  }, [renderer, file]);

  return (
    <canvas
      ref={canvas}
      className="block w-full h-full select-none"
      id={MEDIA_CANVAS_ID}
    />
  );
}
