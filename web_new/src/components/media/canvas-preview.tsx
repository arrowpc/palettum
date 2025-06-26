import { useEffect, useRef } from "react";
import { transfer } from "comlink";
import { useRenderer } from "@/renderer-provider";
import { Maximize } from "lucide-react";

export const MEDIA_CANVAS_ID = "preview";

interface Props {
  file: File;
  onClick: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}

export default function CanvasPreview({ file, onClick }: Props) {
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
    <div className="block w-full h-full" onClick={onClick}>
      <canvas
        ref={canvas}
        id={MEDIA_CANVAS_ID}
        className="block w-full h-full cursor-pointer"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-primary/0 group-hover:bg-black/10 transition-colors duration-200">
        <div
          className="p-2 bg-primary/50 backdrop-blur-sm rounded-md flex items-center gap-1.5 opacity-0 
            group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-200"
        >
          <Maximize className="w-4 h-4 stroke-3" />
          <span className="text-base">Inspect</span>
        </div>
      </div>
    </div>
  );
}
