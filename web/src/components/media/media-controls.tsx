import { useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { useMediaStore } from "@/stores";
import { useRenderer } from "@/providers/renderer-provider";
import SeekBar from "./seek-bar";
import { cn } from "@/lib/utils";

export default function MediaControls() {
  const [isMobile, setIsMobile] = useState(false);

  const isPlaying = useMediaStore((s) => s.isPlaying);
  const setIsPlaying = useMediaStore((s) => s.setIsPlaying);
  const meta = useMediaStore((s) => s.meta);
  const renderer = useRenderer();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.matchMedia("(hover: none) and (pointer: coarse)").matches,
      );
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      renderer.pause();
    } else {
      renderer.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (!meta?.canPlay) return null;

  return (
    <>
      <div
        className={cn(
          "absolute inset-x-0 z-20",
          "transition-opacity duration-200",
          isMobile
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
        )}
        style={{
          bottom: "2.5rem",
          paddingBottom: "0.5rem",
        }}
      >
        <div className="flex items-center gap-3 px-6">
          {" "}
          <button
            onClick={handlePlayPause}
            className={cn(
              "pointer-events-auto flex-shrink-0",
              "p-2 bg-primary backdrop-blur-sm rounded-md",
              "hover:bg-primary/80 transition-colors duration-200",
              "flex items-center justify-center",
            )}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white" />
            )}
          </button>
          <div className="flex-1 pointer-events-auto">
            <SeekBar />
          </div>
        </div>
      </div>
    </>
  );
}
