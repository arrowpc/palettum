import { useEffect, useRef, useState } from "react";
import { transfer } from "comlink";
import { useRenderer } from "@/providers/renderer-provider";
import { Maximize, Play, Pause } from "lucide-react";
import { type MediaInfo } from "@/workers/render";
import { MEDIA_CANVAS_ID } from "@/lib/constants";

interface Props {
  file: File;
  onCanvasClick: (event: React.MouseEvent<HTMLElement, MouseEvent>, mediaInfo: MediaInfo) => void;
  borderRadius: string;
}

export default function CanvasPreview({ file, onCanvasClick, borderRadius }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hasRun = useRef(false);
  const renderer = useRenderer();
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
        renderer.switchCanvas(MEDIA_CANVAS_ID);
        const info = await renderer.load(file);
        setMediaInfo(info);
        if (info.canPlay) {
          setIsPlaying(true); // Assume playing by default if it can play
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [renderer, file]);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the parent onClick from firing
    if (isPlaying) {
      renderer.pause();
    } else {
      renderer.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleInspectClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the parent onClick from firing
    if (mediaInfo) {
      onCanvasClick(e, mediaInfo);
    }
  };

  return (
    <div className="block w-full h-full relative">
      <canvas
        ref={canvas}
        id={MEDIA_CANVAS_ID}
        className="block w-full h-full"
      />

      <div
        className="absolute inset-0 cursor-pointer group/canvas"
        onClick={(e) => mediaInfo && onCanvasClick(e, mediaInfo)}
        style={{ borderRadius }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center bg-primary/0 group-hover/canvas:bg-black/10 transition-colors duration-200"
          style={{ borderRadius }}
        >
          <div className="flex gap-2"> {/* Container for both buttons */}
            {mediaInfo?.canPlay && (
              <div
                className="p-2 bg-primary/50 backdrop-blur-sm rounded-md flex items-center gap-1.5 opacity-0 
                group-hover/canvas:opacity-100 scale-90 group-hover/canvas:scale-100 transition-all duration-200"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 stroke-3" />
                ) : (
                  <Play className="w-4 h-4 stroke-3" />
                )}
                <span className="text-base">{isPlaying ? "Pause" : "Play"}</span>
              </div>
            )}
            <div
              className="p-2 bg-primary/50 backdrop-blur-sm rounded-md flex items-center gap-1.5 opacity-0 
              group-hover/canvas:opacity-100 scale-90 group-hover/canvas:scale-100 transition-all duration-200"
              onClick={handleInspectClick}
            >
              <Maximize className="w-4 h-4 stroke-3" />
              <span className="text-base">Inspect</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
