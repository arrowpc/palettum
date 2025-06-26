import { useEffect, useRef } from "react";
import { transfer } from "comlink";
import { useRenderer } from "@/renderer-provider";

export const MEDIA_CANVAS_ID = "preview";

interface Props {
  file: File;
}

export default function CanvasPreview({ file }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hasRun = useRef(false);
  const renderer = useRenderer();

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const el = canvas.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const off = el.transferControlToOffscreen();
    off.width = parent.offsetWidth;
    off.height = parent.offsetHeight;

    (async () => {
      try {
        await renderer.registerCanvas(MEDIA_CANVAS_ID, transfer(off, [off]));
        await renderer.load(file);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [renderer, file]);

  return (
    <canvas ref={canvas} id={MEDIA_CANVAS_ID} className="block w-full h-full" />
  );
}
