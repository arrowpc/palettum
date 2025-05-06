import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useMemo,
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

function useContinuousTap(
  singleTap: (e: React.MouseEvent | React.TouchEvent) => void,
  doubleTap: (e: React.MouseEvent | React.TouchEvent) => void,
) {
  const continuousClick = useRef(0);

  const debounceTap = useDebounceCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      continuousClick.current = 0;
      singleTap(e);
    },
    300,
  );

  return useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
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

const ViewerBackground = memo(() => {
  return <DialogOverlay className="bg-overlay-background" />;
});

const ViewerDialogHeader = memo(() => {
  return (
    <DialogHeader className="sr-only">
      <DialogTitle>Image Preview</DialogTitle>
      <DialogDescription>
        Image viewer with zoom and pan controls
      </DialogDescription>
    </DialogHeader>
  );
});

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
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.zoomLevel === nextProps.zoomLevel &&
    prevProps.zoomLimits.min === nextProps.zoomLimits.min &&
    prevProps.zoomLimits.max === nextProps.zoomLimits.max &&
    prevProps.isDefaultView === nextProps.isDefaultView &&
    prevProps.handleZoom === nextProps.handleZoom,
);

const StableDialogContent = memo(
  ({ children }: { children: React.ReactNode }) => {
    return (
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        {children}
      </DialogContent>
    );
  },
);

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoomLimits, setZoomLimits] = useState({ min: 0.1, max: 10 });
  const [, setImageSize] = useState({ width: 0, height: 0 });
  const [touchDistance, setTouchDistance] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number>();
  const defaultZoomRef = useRef<number>(1);

  const ZOOM_STEP = 1.2;
  const TARGET_MAX_PIXEL_SIZE = 256;

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

  const isDefaultView = useMemo(() => {
    const zoomDiff = Math.abs(zoomLevel - defaultZoomRef.current) < 0.001;
    const positionAtOrigin =
      Math.abs(position.x) < 1 && Math.abs(position.y) < 1;
    return zoomDiff && positionAtOrigin;
  }, [zoomLevel, position]);

  const resetView = useCallback(() => {
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
    const initializeImage = () => {
      if (!imageRef.current?.complete) {
        const handleLoad = () => {
          if (imageRef.current) {
            setImageSize({
              width: imageRef.current.naturalWidth,
              height: imageRef.current.naturalHeight,
            });
            resetView();
            setZoomLimits(calculateZoomLimits());
            setImageLoaded(true);
          }
        };
        imageRef.current?.addEventListener("load", handleLoad);
        return () => imageRef.current?.removeEventListener("load", handleLoad);
      }
      if (imageRef.current) {
        setImageSize({
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight,
        });
      }
      resetView();
      setZoomLimits(calculateZoomLimits());
      setImageLoaded(true);
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

      const clampedZoom = Math.max(
        zoomLimits.min,
        Math.min(zoomLimits.max, newZoom),
      );

      const scale = clampedZoom / zoomLevel;
      const newX = position.x - offsetX * (scale - 1);
      const newY = position.y - offsetY * (scale - 1);

      setZoomLevel(clampedZoom);
      setPosition({ x: newX, y: newY });
    },
    [zoomLevel, position, zoomLimits],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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
    [isDragging, dragStart, updatePosition],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDefaultView) {
        resetView();
      } else {
        const targetZoom = zoomLevel * 2.5;
        const clientX =
          "clientX" in e
            ? e.clientX
            : e.touches[0]?.clientX || window.innerWidth / 2;
        const clientY =
          "clientY" in e
            ? e.clientY
            : e.touches[0]?.clientY || window.innerHeight / 2;
        handleZoom(true, clientX, clientY, targetZoom);
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
      e.preventDefault();
      handleZoom(e.deltaY < 0, e.clientX, e.clientY);
    },
    [handleZoom],
  );

  const getDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  }, []);

  const getMidpoint = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
      }

      if (e.touches.length === 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      } else if (e.touches.length === 2) {
        setTouchDistance(getDistance(e.touches));
      }
    },
    [getDistance],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (e.touches.length === 1 && isDragging) {
          const deltaX = e.touches[0].clientX - dragStart.x;
          const deltaY = e.touches[0].clientY - dragStart.y;
          updatePosition(deltaX, deltaY);
          setDragStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          });
        } else if (e.touches.length === 2) {
          const currentDistance = getDistance(e.touches);
          if (touchDistance > 0) {
            const scale = currentDistance / touchDistance;
            const midpoint = getMidpoint(e.touches);
            const zoomIn = scale > 1;

            if (Math.abs(scale - 1) > 0.01) {
              const rawTargetZoom = zoomLevel * scale;
              const targetZoom = Math.max(
                zoomLimits.min,
                Math.min(zoomLimits.max, rawTargetZoom),
              );

              handleZoom(zoomIn, midpoint.x, midpoint.y, targetZoom);
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
      zoomLimits,
      updatePosition,
      getDistance,
      getMidpoint,
      handleZoom,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setTouchDistance(0);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const preventDefaultForDoubleTouch = (e: TouchEvent) => {
      if (viewportRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    document.addEventListener("dblclick", preventDefaultForDoubleTouch as any, {
      passive: false,
    });

    return () => {
      document.removeEventListener(
        "dblclick",
        preventDefaultForDoubleTouch as any,
      );
    };
  }, []);

  const ImageContent = useMemo(() => {
    return (
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
            imageRendering: zoomLevel > 3 ? "pixelated" : "auto",
            opacity: imageLoaded ? 1 : 0,
          }}
          draggable={false}
        />
      </div>
    );
  }, [position.x, position.y, zoomLevel, isDragging, imageUrl, imageLoaded]);

  const containerStyle = useMemo(() => {
    const heightConstraint = "calc(90vh - 4rem)";
    return {
      height: "calc(90vh - 4rem)",
      minHeight: "400px",
      maxHeight: heightConstraint,
      maxWidth: "100%",
      touchAction: "none",
    };
  }, []);

  const ViewportContent = useMemo(() => {
    return (
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
        {ImageContent}
      </div>
    );
  }, [
    isDragging,
    containerStyle,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTap,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    ImageContent,
  ]);

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
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalContent = viewportMeta?.getAttribute("content") || "";

    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.setAttribute("name", "viewport");
      document.head.appendChild(viewportMeta);
    }

    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
    );

    return () => {
      if (viewportMeta && originalContent) {
        viewportMeta.setAttribute("content", originalContent);
      } else if (viewportMeta) {
        document.head.removeChild(viewportMeta);
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

export default ImageViewer;
