import React, { useState, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { useDebounceCallback } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from "@/components/ui/dialog";

function useContinuousTap(
  singleTap: (e: React.MouseEvent) => void,
  doubleTap: (e: React.MouseEvent) => void,
) {
  const continuousClick = useRef(0);

  const debounceTap = useDebounceCallback((e: React.MouseEvent) => {
    continuousClick.current = 0;
    singleTap(e);
  }, 300);

  return useCallback(
    (e: React.MouseEvent) => {
      continuousClick.current += 1;
      debounceTap(e);

      if (continuousClick.current >= 2) {
        debounceTap.cancel();
        continuousClick.current = 0;
        doubleTap(e);
      }
    },
    [debounceTap, doubleTap],
  );
}

interface ImageViewerProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoomLimits, setZoomLimits] = useState({ min: 0.1, max: 10 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number>();

  const ZOOM_STEP = 1.2;
  const TARGET_MAX_PIXEL_SIZE = 256;

  const isMinZoom = Math.abs(zoomLevel - zoomLimits.min) < 0.001;
  const isMaxZoom = Math.abs(zoomLevel - zoomLimits.max) < 0.001;

  const calculateZoomLimits = useCallback(() => {
    if (!viewportRef.current || !imageRef.current) return { min: 0.1, max: 10 };

    const image = imageRef.current;

    const pixelOneToOne = window.devicePixelRatio || 1;

    const MIN_IMAGE_SIZE = 200;
    const minWidthZoom = MIN_IMAGE_SIZE / image.naturalWidth;
    const minHeightZoom = MIN_IMAGE_SIZE / image.naturalHeight;
    const minZoom = Math.max(minWidthZoom, minHeightZoom);

    const maxZoom = pixelOneToOne * TARGET_MAX_PIXEL_SIZE;

    return { min: minZoom, max: maxZoom };
  }, []);

  const calculateBoundaries = useCallback(() => {
    if (!viewportRef.current || !imageRef.current)
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const viewport = viewportRef.current;
    const image = imageRef.current;

    const scaledWidth = image.naturalWidth * zoomLevel;
    const scaledHeight = image.naturalHeight * zoomLevel;

    const horizontalOverflow = Math.max(
      0,
      (scaledWidth - viewport.clientWidth) / 2,
    );
    const verticalOverflow = Math.max(
      0,
      (scaledHeight - viewport.clientHeight) / 2,
    );

    return {
      minX: -horizontalOverflow,
      maxX: horizontalOverflow,
      minY: -verticalOverflow,
      maxY: verticalOverflow,
    };
  }, [zoomLevel]);

  const calculateFitToViewZoom = useCallback(() => {
    if (!viewportRef.current || !imageRef.current) return 1;

    const viewport = viewportRef.current;
    const image = imageRef.current;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    const widthRatio = viewportWidth / image.naturalWidth;
    const heightRatio = viewportHeight / image.naturalHeight;

    return Math.min(widthRatio, heightRatio) * 0.95;
  }, []);

  const isDefaultView = useCallback(() => {
    const fitZoom = calculateFitToViewZoom();
    const zoomDiff = Math.abs(zoomLevel - fitZoom);
    return zoomDiff <= fitZoom * 0.01 && position.x === 0 && position.y === 0;
  }, [calculateFitToViewZoom, zoomLevel, position]);

  const resetView = useCallback(() => {
    const newZoom = calculateFitToViewZoom();
    setZoomLevel(newZoom);
    setPosition({ x: 0, y: 0 });
  }, [calculateFitToViewZoom]);

  const adjustPositionToBounds = useCallback(() => {
    const boundaries = calculateBoundaries();
    setPosition((prevPos) => ({
      x: Math.max(boundaries.minX, Math.min(boundaries.maxX, prevPos.x)),
      y: Math.max(boundaries.minY, Math.min(boundaries.maxY, prevPos.y)),
    }));
  }, [calculateBoundaries]);

  useEffect(() => {
    const initializeImage = () => {
      if (!imageRef.current?.complete) {
        const handleLoad = () => {
          resetView();
          setZoomLimits(calculateZoomLimits());
        };
        imageRef.current?.addEventListener("load", handleLoad);
        return () => imageRef.current?.removeEventListener("load", handleLoad);
      }
      resetView();
      setZoomLimits(calculateZoomLimits());
    };

    const frame = requestAnimationFrame(initializeImage);
    return () => cancelAnimationFrame(frame);
  }, [imageUrl, resetView, calculateZoomLimits]);

  useEffect(() => {
    adjustPositionToBounds();
  }, [zoomLevel, adjustPositionToBounds]);

  const handleZoom = useCallback(
    (
      zoomIn: boolean,
      clientX?: number,
      clientY?: number,
      targetZoom?: number,
    ) => {
      if (!viewportRef.current || !imageRef.current) return;

      const viewport = viewportRef.current;

      const viewportRect = viewport.getBoundingClientRect();

      const zoomPointX =
        clientX ?? (viewportRect.left + viewportRect.right) / 2;
      const zoomPointY =
        clientY ?? (viewportRect.top + viewportRect.bottom) / 2;

      const imageCenterX = viewportRect.width / 2 + position.x;
      const imageCenterY = viewportRect.height / 2 + position.y;

      const offsetX = zoomPointX - viewportRect.left - imageCenterX;
      const offsetY = zoomPointY - viewportRect.top - imageCenterY;

      const newZoom =
        targetZoom ??
        (zoomIn
          ? Math.min(zoomLevel * ZOOM_STEP, zoomLimits.max)
          : Math.max(zoomLevel / ZOOM_STEP, zoomLimits.min));

      const scale = newZoom / zoomLevel;
      const newX = position.x - offsetX * (scale - 1);
      const newY = position.y - offsetY * (scale - 1);

      setZoomLevel(newZoom);
      setPosition({ x: newX, y: newY });
    },
    [zoomLevel, position, zoomLimits],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        updatePosition(deltaX, deltaY);
        setDragStart({ x: e.clientX, y: e.clientY });
      });
    },
    [isDragging, dragStart],
  );

  const updatePosition = useCallback(
    (deltaX: number, deltaY: number) => {
      const boundaries = calculateBoundaries();
      setPosition((prev) => ({
        x: Math.max(
          boundaries.minX,
          Math.min(boundaries.maxX, prev.x + deltaX),
        ),
        y: Math.max(
          boundaries.minY,
          Math.min(boundaries.maxY, prev.y + deltaY),
        ),
      }));
    },
    [calculateBoundaries],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isDefaultView()) {
        resetView();
      } else {
        const targetZoom = zoomLevel * 2.5;
        handleZoom(true, e.clientX, e.clientY, targetZoom);
      }
    },
    [zoomLevel, isDefaultView, resetView, handleZoom],
  );

  const handleSingleTap = useCallback(() => {}, []);

  const handleTap = useContinuousTap(handleSingleTap, handleDoubleClick);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      handleZoom(e.deltaY < 0, e.clientX, e.clientY);
    },
    [handleZoom],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogOverlay className="bg-overlay-background" />
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Image Preview</DialogTitle>
          <DialogDescription>
            Image viewer with zoom and pan controls
          </DialogDescription>
        </DialogHeader>
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
          <Button
            onClick={() => handleZoom(false)}
            disabled={isMinZoom}
            className={cn(
              "bg-neutral-600 hover:bg-neutral-700 text-white w-8 h-8 p-0",
              "transition-colors",
              isMinZoom && "opacity-50 cursor-not-allowed",
            )}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleZoom(true)}
            disabled={isMaxZoom}
            className={cn(
              "bg-neutral-600 hover:bg-neutral-700 text-white w-8 h-8 p-0",
              "transition-colors",
              isMaxZoom && "opacity-50 cursor-not-allowed",
            )}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            onClick={resetView}
            disabled={isDefaultView()}
            className={cn(
              "bg-neutral-600 hover:bg-neutral-700 text-white w-8 h-8 p-0",
              "transition-colors",
              isDefaultView() && "opacity-50 cursor-not-allowed",
            )}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <DialogClose asChild>
            <Button
              className={cn(
                "bg-destructive hover:bg-destructive/90 text-destructive-foreground w-8 h-8 p-0",
                "transition-colors",
              )}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
        <div
          ref={viewportRef}
          className={cn(
            "w-full h-[calc(90vh-4rem)] min-h-[400px] overflow-hidden relative",
            "bg-gray-100",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleTap}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Zoomed Preview"
              className="max-w-none pointer-events-none select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                transition: isDragging
                  ? "none"
                  : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transformOrigin: "center",
                willChange: "transform",
                imageRendering: zoomLevel >= 4 ? "pixelated" : "auto",
              }}
              draggable={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewer;
