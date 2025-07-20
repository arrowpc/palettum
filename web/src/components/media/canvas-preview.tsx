import { useEffect, useRef, useState } from "react";
import { proxy, transfer } from "comlink";
import { useRenderer } from "@/providers/renderer-provider";
import { Maximize, Play, Pause } from "lucide-react";
import { MEDIA_CANVAS_ID } from "@/lib/constants";
import { useMediaStore, type MediaMeta } from "@/stores";
import SeekBar from "./seek-bar";
import { toast } from "sonner";

interface Props {
  file: File;
  onCanvasClick: () => void;
  borderRadius: string;
  className?: string;
  onClear: () => void;
}

export default function CanvasPreview({
  file,
  onCanvasClick,
  borderRadius,
  className,
  onClear,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasRun = useRef(false);

  const renderer = useRenderer();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const setMediaMeta = useMediaStore((s) => s.setMediaMeta);
  const setIsLoading = useMediaStore((s) => s.setIsLoading);
  const isLoading = useMediaStore((s) => s.isLoading);
  const meta = useMediaStore((s) => s.meta);
  const canPlay = meta?.canPlay ?? false;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    if (hasRun.current) {
      console.debug("[CanvasPreview] transfer already done, skipping");
      return;
    }
    hasRun.current = true;

    const parent = el.parentElement;
    if (!parent) return;

    const off = el.transferControlToOffscreen();
    off.width = parent.offsetWidth;
    off.height = parent.offsetHeight;

    (async () => {
      try {
        setIsLoading(true);
        await renderer.init();
        await renderer.registerCanvas(MEDIA_CANVAS_ID, transfer(off, [off]));
        renderer.switchCanvas(MEDIA_CANVAS_ID);
        renderer.clearCanvas();

        const info: MediaMeta = await renderer.load(
          file,
          proxy((p: number) => setProgress(p)),
        );
        console.log("[CanvasPreview] loaded media info:", info);
        setMediaMeta(info);
        if (info.canPlay) setIsPlaying(true);
      } catch (err: any) {
        console.error("[CanvasPreview] error in effect:", err);
        toast.error("Failed to load media: " + err.message);
        onClear();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [renderer, file, setMediaMeta, setIsLoading, onClear]);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      renderer.pause();
    } else {
      renderer.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number) => {
    setProgress(value);
  };

  return (
    <div className="block w-full h-full relative">
      <canvas
        ref={canvasRef}
        id={MEDIA_CANVAS_ID}
        className={`block w-full h-full ${className ?? ""} ${
          isLoading ? "hidden" : ""
        }`}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md">
          <div className="grid grid-cols-2 gap-0.5 animate-spin">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-current opacity-75"
                style={{ imageRendering: "pixelated" }}
              />
            ))}
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 cursor-pointer group/canvas"
        onClick={onCanvasClick}
        style={{ borderRadius }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center bg-primary/0 group-hover/canvas:bg-black/10 transition-colors duration-200"
          style={{ borderRadius }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              {canPlay && (
                <div
                  className="p-2 bg-primary/80 backdrop-blur-sm rounded-md flex items-center gap-1.5 opacity-0 
                group-hover/canvas:opacity-100 scale-90 group-hover/canvas:scale-100 transition-all duration-200"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 stroke-3" />
                  ) : (
                    <Play className="w-4 h-4 stroke-3" />
                  )}
                  <span className="text-base">
                    {isPlaying ? "Pause" : "Play"}
                  </span>
                </div>
              )}
              <div
                className="p-2 bg-primary/80 backdrop-blur-sm rounded-md flex items-center gap-1.5 opacity-0 
              group-hover/canvas:opacity-100 scale-90 group-hover/canvas:scale-100 transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onCanvasClick();
                }}
              >
                <Maximize className="w-4 h-4 stroke-3" />
                <span className="text-base">Inspect</span>
              </div>
            </div>
            {canPlay && (
              <div
                className="
                  w-full flex items-center gap-2 text-xs
                  px-2 py-1 bg-primary/80 backdrop-blur-sm
                  rounded-md opacity-0 group-hover/canvas:opacity-100
                  transition-opacity duration-200
                "
                onClick={(e) => e.stopPropagation()}
              >
                <SeekBar
                  value={progress}
                  max={meta?.duration ?? 1}
                  onChange={handleSeek}
                  className="w-full"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (isPlaying) {
                      renderer.pause();
                    }
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    renderer.seek(progress);
                    if (isPlaying) {
                      renderer.play();
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
