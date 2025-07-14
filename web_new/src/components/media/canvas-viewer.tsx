import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
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
import { useRenderer } from "@/providers/renderer-provider";
import { transfer } from "comlink";
import { VIEWER_CANVAS_ID } from "@/lib/constants";

function useContinuousTap(
  singleTap: (e: ReactMouseEvent | ReactTouchEvent) => void,
  doubleTap: (e: ReactMouseEvent | ReactTouchEvent) => void,
) {
  const continuousClick = useRef(0);

  const debounceTap = useDebounceCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      continuousClick.current = 0;
      singleTap(e);
    },
    300,
  );

  return useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
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

interface CanvasViewerProps {
  onClose: () => void;
}

const ViewerBackground = memo(() => {
  return <DialogOverlay className="bg-overlay-background" />;
});
ViewerBackground.displayName = "ViewerBackground";

const ViewerDialogHeader = memo(() => {
  return (
    <DialogHeader className="sr-only">
      <DialogTitle>Canvas Preview</DialogTitle>
      <DialogDescription>
        Canvas viewer with zoom and pan controls
      </DialogDescription>
    </DialogHeader>
  );
});
ViewerDialogHeader.displayName = "ViewerDialogHeader";

interface ToolbarProps {
  zoomLevel: number;
  zoomLimits: { min: number; max: number };
  resetView: () => void;
  handleZoom: (
    zoomIn: boolean,
    clientX?: number,
    clientY?: number,
    targetZoom?: number,
  ) => void;
  isDefaultView: boolean;
  onClose: () => void;
}

const Toolbar: React.FC<ToolbarProps> = memo(
  ({
    zoomLevel,
    zoomLimits,
    resetView,
    handleZoom,
    isDefaultView,
    onClose,
  }) => {
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
            onClick={onClose}
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
Toolbar.displayName = "Toolbar";

const StableDialogContent = memo(
  ({ children }: { children: React.ReactNode }) => {
    return (
      <DialogContent className="w-full p-0 overflow-hidden border-none shadow-2xl">
        {children}
      </DialogContent>
    );
  },
);
StableDialogContent.displayName = "StableDialogContent";

const CanvasViewer: React.FC<CanvasViewerProps> = ({ onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoomLimits, setZoomLimits] = useState({ min: 0.1, max: 10 });
  const [touchDistance, setTouchDistance] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const renderer = useRenderer();

  const panRafRef = useRef<number>(0);
  const defaultZoomRef = useRef<number>(1);

  const ZOOM_STEP = 1.2;
  const TARGET_MAX_PIXEL_SIZE = 256;

  const calculateZoomLimits = useCallback(() => {
    if (!viewportRef.current || !canvasSize.width || !canvasSize.height)
      return { min: 0.1, max: 10 };
    const pixelOneToOne = window.devicePixelRatio || 1;
    const MIN_CANVAS_DISPLAY_SIZE = 200;
    const { width: currentCanvasWidth, height: currentCanvasHeight } =
      canvasSize;

    if (currentCanvasWidth === 0 || currentCanvasHeight === 0)
      return { min: 0.1, max: 10 };

    const minWidthZoom = MIN_CANVAS_DISPLAY_SIZE / currentCanvasWidth;
    const minHeightZoom = MIN_CANVAS_DISPLAY_SIZE / currentCanvasHeight;
    const minZoom = Math.max(0.01, Math.max(minWidthZoom, minHeightZoom));
    const maxZoom = pixelOneToOne * TARGET_MAX_PIXEL_SIZE;
    return { min: Math.min(minZoom, 1), max: Math.max(maxZoom, 1.1) };
  }, [canvasSize]);

  const calculateBoundaries = useCallback(() => {
    if (!viewportRef.current || !canvasSize.width || !canvasSize.height)
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const viewport = viewportRef.current;
    const { width: currentCanvasWidth, height: currentCanvasHeight } =
      canvasSize;
    const scaledWidth = currentCanvasWidth * zoomLevel;
    const scaledHeight = currentCanvasHeight * zoomLevel;
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
  }, [zoomLevel, canvasSize]);

  const calculateFitToViewZoom = useCallback(() => {
    if (!viewportRef.current || !canvasSize.width || !canvasSize.height)
      return 1;
    const viewport = viewportRef.current;
    const { width: currentCanvasWidth, height: currentCanvasHeight } =
      canvasSize;

    if (currentCanvasWidth === 0 || currentCanvasHeight === 0) return 1;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const widthRatio = viewportWidth / currentCanvasWidth;
    const heightRatio = viewportHeight / currentCanvasHeight;
    return Math.min(widthRatio, heightRatio) * 0.95;
  }, [canvasSize]);

  const isDefaultView = useMemo(() => {
    const zoomDiff = Math.abs(zoomLevel - defaultZoomRef.current) < 0.001;
    const positionAtOrigin =
      Math.abs(position.x) < 1 && Math.abs(position.y) < 1;
    return zoomDiff && positionAtOrigin;
  }, [zoomLevel, position]);

  const resetView = useCallback(() => {
    if (!viewportRef.current) return;
    const newZoom = calculateFitToViewZoom();
    defaultZoomRef.current = newZoom;
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
    const initializeCanvasAndRenderer = async () => {
      const displayEl = displayCanvasRef.current;
      const viewportEl = viewportRef.current;

      if (!displayEl || !viewportEl) {
        setCanvasReady(false);
        return;
      }

      try {
        const mediaInfo = await renderer.getMediaInfo();
        const width = mediaInfo?.width || 1920;
        const height = mediaInfo?.height || 1080;
        setCanvasSize({ width, height });

        displayEl.width = width;
        displayEl.height = height;

        const offscreenCanvas = displayEl.transferControlToOffscreen();
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;

        await renderer.registerCanvas(
          VIEWER_CANVAS_ID,
          transfer(offscreenCanvas, [offscreenCanvas]),
        );
        renderer.switchCanvas(VIEWER_CANVAS_ID);
        setCanvasReady(true);
      } catch (error) {
        console.error("Failed to initialize canvas or renderer:", error);
        setCanvasReady(false);
      }
    };

    const frameId = requestAnimationFrame(initializeCanvasAndRenderer);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [renderer]);

  useEffect(() => {
    if (canvasReady) {
      const newLimits = calculateZoomLimits();
      setZoomLimits(newLimits);
      const fitZoom = calculateFitToViewZoom();
      defaultZoomRef.current = fitZoom;
      setZoomLevel(fitZoom);
      setPosition({ x: 0, y: 0 });
    }
  }, [canvasReady, calculateFitToViewZoom, calculateZoomLimits]);

  useEffect(() => {
    if (canvasReady) {
      adjustPositionToBounds();
    }
  }, [zoomLevel, canvasReady, adjustPositionToBounds]);

  const handleZoom = useCallback(
    (
      zoomIn: boolean,
      clientX?: number,
      clientY?: number,
      targetZoom?: number,
    ) => {
      if (!viewportRef.current) return;
      const viewport = viewportRef.current;
      const viewportRect = viewport.getBoundingClientRect();
      const zoomPointX =
        clientX ?? (viewportRect.left + viewportRect.right) / 2;
      const zoomPointY =
        clientY ?? (viewportRect.top + viewportRect.bottom) / 2;

      const currentCanvasCenterX = viewportRect.width / 2 + position.x;
      const currentCanvasCenterY = viewportRect.height / 2 + position.y;
      const offsetX = zoomPointX - viewportRect.left - currentCanvasCenterX;
      const offsetY = zoomPointY - viewportRect.top - currentCanvasCenterY;

      const newZoom =
        targetZoom ??
        (zoomIn
          ? Math.min(zoomLevel * ZOOM_STEP, zoomLimits.max)
          : Math.max(zoomLevel / ZOOM_STEP, zoomLimits.min));
      const clampedZoom = Math.max(
        zoomLimits.min,
        Math.min(zoomLimits.max, newZoom),
      );
      if (Math.abs(clampedZoom - zoomLevel) < 0.00001) return;

      const scaleChange = clampedZoom / zoomLevel;
      const newX = position.x - offsetX * (scaleChange - 1);
      const newY = position.y - offsetY * (scaleChange - 1);

      setZoomLevel(clampedZoom);
      setPosition({ x: newX, y: newY });
    },
    [zoomLevel, position, zoomLimits],
  );

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

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

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!isDragging) return;
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      panRafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        updatePosition(deltaX, deltaY);
        setDragStart({ x: e.clientX, y: e.clientY });
      });
    },
    [isDragging, dragStart, updatePosition],
  );

  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      e.preventDefault();
      if (!isDefaultView) {
        resetView();
      } else {
        const targetZoomFactor = 2.5;
        const clientX =
          "clientX" in e
            ? e.clientX
            : e.touches[0]?.clientX || window.innerWidth / 2;
        const clientY =
          "clientY" in e
            ? e.clientY
            : e.touches[0]?.clientY || window.innerHeight / 2;
        handleZoom(true, clientX, clientY, zoomLevel * targetZoomFactor);
      }
    },
    [zoomLevel, isDefaultView, resetView, handleZoom],
  );

  const handleSingleTap = useCallback(() => { }, []);
  const handleTap = useContinuousTap(handleSingleTap, handleDoubleClick);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
  }, []);

  const handleWheel = useCallback(
    (e: ReactWheelEvent) => {
      handleZoom(e.deltaY < 0, e.clientX, e.clientY);
    },
    [handleZoom],
  );

  const getDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0;
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  }, []);

  const getMidpoint = useCallback((touches: TouchList) => {
    if (touches.length < 2)
      return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        setTouchDistance(getDistance(e.nativeEvent.touches));
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      }
    },
    [getDistance],
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      panRafRef.current = requestAnimationFrame(() => {
        if (e.touches.length === 1 && isDragging) {
          const deltaX = e.touches[0].clientX - dragStart.x;
          const deltaY = e.touches[0].clientY - dragStart.y;
          updatePosition(deltaX, deltaY);
          setDragStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          });
        } else if (e.touches.length === 2) {
          const currentDistance = getDistance(e.nativeEvent.touches);
          if (touchDistance > 0) {
            const scale = currentDistance / touchDistance;
            const midpoint = getMidpoint(e.nativeEvent.touches);
            if (Math.abs(scale - 1) > 0.01) {
              handleZoom(scale > 1, midpoint.x, midpoint.y, zoomLevel * scale);
            }
          }
          setTouchDistance(currentDistance);
        }
      });
    },
    [
      isDragging,
      dragStart,
      touchDistance,
      zoomLevel,
      updatePosition,
      getDistance,
      getMidpoint,
      handleZoom,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setTouchDistance(0);
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    };
  }, []);

  useEffect(() => {
    const preventDefaultScroll = (e: Event) => e.preventDefault();
    const currentViewport = viewportRef.current;
    currentViewport?.addEventListener("wheel", preventDefaultScroll, {
      passive: false,
    });
    currentViewport?.addEventListener("touchmove", preventDefaultScroll, {
      passive: false,
    });
    return () => {
      currentViewport?.removeEventListener("wheel", preventDefaultScroll);
      currentViewport?.removeEventListener("touchmove", preventDefaultScroll);
    };
  }, []);

  const CanvasDisplay = (
    <div className="absolute inset-0 flex items-center justify-center">
      <canvas
        ref={displayCanvasRef}
        className="max-w-none pointer-events-none select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
          transition: isDragging
            ? "none"
            : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          transformOrigin: "center",
          willChange: "transform",
          opacity: canvasReady ? 1 : 0,
          imageRendering: zoomLevel > 3 ? "pixelated" : "auto",
        }}
      />
    </div>
  );

  const containerStyle = useMemo(
    () => ({
      height: "calc(90vh - 4rem)",
      minHeight: "400px",
      maxHeight: "calc(90vh - 4rem)",
      maxWidth: "100%",
      touchAction: "none",
    }),
    [],
  );

  const ViewportContent = (
    <div
      ref={viewportRef}
      className={cn(
        "w-full overflow-hidden relative",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      )}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {CanvasDisplay}
    </div>
  );

  const toolbarProps = useMemo(
    () => ({
      zoomLevel,
      zoomLimits,
      resetView,
      handleZoom,
      isDefaultView,
      onClose,
    }),
    [zoomLevel, zoomLimits, resetView, handleZoom, isDefaultView, onClose],
  );

  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalContent = viewportMeta?.getAttribute("content") || "";
    const newContent =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

    if (viewportMeta) {
      viewportMeta.setAttribute("content", newContent);
    } else {
      const newMeta = document.createElement("meta");
      newMeta.setAttribute("name", "viewport");
      newMeta.setAttribute("content", newContent);
      document.head.appendChild(newMeta);
      (newMeta as any)._addedByCanvasViewer = true;
    }

    return () => {
      const currentMeta = document.querySelector('meta[name="viewport"]');
      if (currentMeta) {
        if (originalContent) {
          currentMeta.setAttribute("content", originalContent);
        } else if ((currentMeta as any)._addedByCanvasViewer) {
          currentMeta.remove();
        }
      }
    };
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <ViewerBackground />
      <StableDialogContent>
        <ViewerDialogHeader />
        <Toolbar {...toolbarProps} />
        {ViewportContent}
      </StableDialogContent>
    </Dialog>
  );
};

CanvasViewer.displayName = "CanvasViewer";
export default CanvasViewer;
