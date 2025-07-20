import React, { memo } from "react";
import { ZoomIn, ZoomOut, RotateCcw, X, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import SeekBar from "@/components/media/seek-bar";
import { useMediaStore } from "@/stores";
import { useRenderer } from "@/providers/renderer-provider";
import type { ZoomLimits } from "./types";

export const ViewerBackground = memo(() => (
  <DialogOverlay className="bg-overlay-background" />
));
ViewerBackground.displayName = "ViewerBackground";

export const ViewerDialogHeader = memo(() => (
  <DialogHeader className="sr-only">
    <DialogTitle>Canvas Preview</DialogTitle>
    <DialogDescription>
      Canvas viewer with zoom and pan controls
    </DialogDescription>
  </DialogHeader>
));
ViewerDialogHeader.displayName = "ViewerDialogHeader";

export const StableDialogContent = memo(
  ({ children }: { children: React.ReactNode }) => (
    <DialogContent className="w-full p-0 overflow-hidden border-none shadow-2xl">
      {children}
    </DialogContent>
  ),
);
StableDialogContent.displayName = "StableDialogContent";

interface ZoomControlsToolbarProps {
  zoomLevel: number;
  zoomLimits: ZoomLimits;
  isDefaultView: boolean;
  resetView: () => void;
  handleZoom: (
    zoomIn: boolean,
    clientX?: number,
    clientY?: number,
    targetZoom?: number,
  ) => void;
}

export const ZoomControlsToolbar: React.FC<ZoomControlsToolbarProps> = memo(
  ({ zoomLevel, zoomLimits, resetView, handleZoom, isDefaultView }) => {
    const isMinZoom = Math.abs(zoomLevel - zoomLimits.min) < 0.001;
    const isMaxZoom = Math.abs(zoomLevel - zoomLimits.max) < 0.001;

    return (
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
        <Button
          onClick={() => handleZoom(false)}
          disabled={isMinZoom}
          className={cn(
            "bg-secondary hover:bg-secondary-hover text-foreground w-8 h-8 p-0",
            "transition-colors shadow-sm",
            isMinZoom && "opacity-50 cursor-not-allowed",
          )}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => handleZoom(true)}
          disabled={isMaxZoom}
          className={cn(
            "bg-secondary hover:bg-secondary-hover text-foreground w-8 h-8 p-0",
            "transition-colors shadow-sm",
            isMaxZoom && "opacity-50 cursor-not-allowed",
          )}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          onClick={resetView}
          disabled={isDefaultView}
          className={cn(
            "bg-secondary hover:bg-secondary-hover text-foreground w-8 h-8 p-0",
            "transition-colors shadow-sm",
            isDefaultView && "opacity-50 cursor-not-allowed",
          )}
          aria-label="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <DialogClose asChild>
          <Button
            className={cn(
              "bg-destructive hover:bg-destructive-hover text-destructive-foreground w-8 h-8 p-0",
              "transition-colors shadow-sm",
            )}
            aria-label="Close viewer"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
      </div>
    );
  },
);
ZoomControlsToolbar.displayName = "ZoomControlsToolbar";

interface MediaControlsToolbarProps {
  isMobile: boolean;
}

export const MediaControlsToolbar: React.FC<MediaControlsToolbarProps> = memo(
  ({ isMobile }) => {
    const isPlaying = useMediaStore((s) => s.isPlaying);
    const setIsPlaying = useMediaStore((s) => s.setIsPlaying);
    const meta = useMediaStore((s) => s.meta);
    const renderer = useRenderer();

    const handlePlayPause = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPlaying(!isPlaying);
      if (isPlaying) {
        renderer.pause();
      } else {
        renderer.play();
      }
    };

    if (!meta?.canPlay) return null;

    return (
      <div
        className={cn(
          "absolute z-50 flex items-center gap-2",
          isMobile
            ? "bottom-2 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] px-4"
            : "top-2 left-2 right-[11rem]",
        )}
      >
        <Button
          onClick={handlePlayPause}
          className="bg-secondary hover:bg-secondary-hover text-foreground w-8 h-8 p-0 transition-colors shadow-sm"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1">
          <SeekBar />
        </div>
      </div>
    );
  },
);
MediaControlsToolbar.displayName = "MediaControlsToolbar";
