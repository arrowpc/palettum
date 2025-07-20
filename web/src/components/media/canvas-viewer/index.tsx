import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { transfer } from "comlink";
import { Dialog } from "@/components/ui/dialog";
import { useRenderer } from "@/providers/renderer-provider";
import { VIEWER_CANVAS_ID } from "@/lib/constants";
import { useMediaStore } from "@/stores";
import { cn } from "@/lib/utils";
import { useContinuousTap } from "./hooks";
import type { Point, ZoomLimits, CanvasViewerProps } from "./types";
import {
  ViewerBackground,
  StableDialogContent,
  ViewerDialogHeader,
  ZoomControlsToolbar,
  MediaControlsToolbar,
} from "./components";

const CanvasViewer: React.FC<CanvasViewerProps> = ({ onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [zoomLimits, setZoomLimits] = useState<ZoomLimits>({
    min: 0.1,
    max: 10,
  });
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);

  const [touchState, setTouchState] = useState<{
    initialDistance: number;
    initialZoom: number;
    initialPosition: Point;
    initialMidpoint: Point;
    isMultiTouch: boolean;
  }>({
    initialDistance: 0,
    initialZoom: 1,
    initialPosition: { x: 0, y: 0 },
    initialMidpoint: { x: 0, y: 0 },
    isMultiTouch: false,
  });

  const resizedWidth = useMediaStore((s) => s.resizedWidth);
  const resizedHeight = useMediaStore((s) => s.resizedHeight);

  const viewportRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRenderer();
  const panRafRef = useRef<number>(0);
  const defaultZoomRef = useRef<number>(1);

  const ZOOM_STEP = 1.2;
  const TARGET_MAX_PIXEL_SIZE = 256;

  const calculateFitToViewZoom = useCallback(() => {
    if (!viewportRef.current || !canvasSize.width || !canvasSize.height)
      return 1;
    const { clientWidth, clientHeight } = viewportRef.current;
    const widthRatio = clientWidth / canvasSize.width;
    const heightRatio = clientHeight / canvasSize.height;
    return Math.min(widthRatio, heightRatio) * 0.95;
  }, [canvasSize]);

  const getBoundsForZoom = useCallback(
    (z: number) => {
      if (!viewportRef.current || !canvasSize.width || !canvasSize.height)
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

      const scaledWidth = canvasSize.width * z;
      const scaledHeight = canvasSize.height * z;
      const horizontalOverflow = Math.max(
        0,
        (scaledWidth - viewportRef.current.clientWidth) / 2,
      );
      const verticalOverflow = Math.max(
        0,
        (scaledHeight - viewportRef.current.clientHeight) / 2,
      );
      return {
        minX: -horizontalOverflow,
        maxX: horizontalOverflow,
        minY: -verticalOverflow,
        maxY: verticalOverflow,
      };
    },
    [canvasSize],
  );

  const isDefaultView = useMemo(() => {
    const zoomDiff = Math.abs(zoomLevel - defaultZoomRef.current) < 0.001;
    const posAtOrigin = Math.abs(position.x) < 1 && Math.abs(position.y) < 1;
    return zoomDiff && posAtOrigin;
  }, [zoomLevel, position]);

  const resetView = useCallback(() => {
    const newZoom = calculateFitToViewZoom();
    defaultZoomRef.current = newZoom;
    setZoomLevel(newZoom);
    setPosition({ x: 0, y: 0 });
  }, [calculateFitToViewZoom]);

  const updatePosition = useCallback(
    (deltaX: number, deltaY: number) => {
      const boundaries = getBoundsForZoom(zoomLevel);
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
    [zoomLevel, getBoundsForZoom],
  );

  const handleZoom = useCallback(
    (
      zoomIn: boolean,
      clientX?: number,
      clientY?: number,
      targetZoom?: number,
    ) => {
      if (!viewportRef.current) return;
      const viewportRect = viewportRef.current.getBoundingClientRect();
      const zoomPoint = {
        x: clientX ?? (viewportRect.left + viewportRect.right) / 2,
        y: clientY ?? (viewportRect.top + viewportRect.bottom) / 2,
      };

      const newZoom =
        targetZoom ?? (zoomIn ? zoomLevel * ZOOM_STEP : zoomLevel / ZOOM_STEP);
      const clampedZoom = Math.max(
        zoomLimits.min,
        Math.min(zoomLimits.max, newZoom),
      );

      if (Math.abs(clampedZoom - zoomLevel) < 0.001) return;

      const scaleChange = clampedZoom / zoomLevel;

      setPosition((prevPos) => {
        const canvasCenter = {
          x: viewportRect.width / 2 + prevPos.x,
          y: viewportRect.height / 2 + prevPos.y,
        };
        const offset = {
          x: zoomPoint.x - viewportRect.left - canvasCenter.x,
          y: zoomPoint.y - viewportRect.top - canvasCenter.y,
        };
        const newPos = {
          x: prevPos.x - offset.x * (scaleChange - 1),
          y: prevPos.y - offset.y * (scaleChange - 1),
        };
        const boundaries = getBoundsForZoom(clampedZoom);
        return {
          x: Math.max(boundaries.minX, Math.min(boundaries.maxX, newPos.x)),
          y: Math.max(boundaries.minY, Math.min(boundaries.maxY, newPos.y)),
        };
      });
      setZoomLevel(clampedZoom);
    },
    [zoomLevel, zoomLimits, getBoundsForZoom],
  );

  const getDistance = (touches: TouchList) =>
    Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  const getMidpoint = (touches: TouchList): Point => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        setTouchState({
          initialDistance: getDistance(e.nativeEvent.touches),
          initialZoom: zoomLevel,
          initialPosition: position,
          initialMidpoint: getMidpoint(e.nativeEvent.touches),
          isMultiTouch: true,
        });
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        setTouchState((prev) => ({ ...prev, isMultiTouch: false }));
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    },
    [zoomLevel, position],
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);

      panRafRef.current = requestAnimationFrame(() => {
        if (e.touches.length >= 2 && touchState.isMultiTouch) {
          e.preventDefault();
          const currentDistance = getDistance(e.nativeEvent.touches);
          if (touchState.initialDistance <= 0 || !viewportRef.current) return;

          const scale = currentDistance / touchState.initialDistance;
          const targetZoom = touchState.initialZoom * scale;
          const clampedZoom = Math.max(
            zoomLimits.min,
            Math.min(zoomLimits.max, targetZoom),
          );

          const viewportRect = viewportRef.current.getBoundingClientRect();
          const { x: zoomPointX, y: zoomPointY } = touchState.initialMidpoint;

          const initialCanvasCenter = {
            x: viewportRect.width / 2 + touchState.initialPosition.x,
            y: viewportRect.height / 2 + touchState.initialPosition.y,
          };
          const offset = {
            x: zoomPointX - viewportRect.left - initialCanvasCenter.x,
            y: zoomPointY - viewportRect.top - initialCanvasCenter.y,
          };

          const totalScaleChange = clampedZoom / touchState.initialZoom;
          const newX =
            touchState.initialPosition.x - offset.x * (totalScaleChange - 1);
          const newY =
            touchState.initialPosition.y - offset.y * (totalScaleChange - 1);

          const boundaries = getBoundsForZoom(clampedZoom);

          setZoomLevel(clampedZoom);
          setPosition({
            x: Math.max(boundaries.minX, Math.min(boundaries.maxX, newX)),
            y: Math.max(boundaries.minY, Math.min(boundaries.maxY, newY)),
          });
        } else if (
          e.touches.length === 1 &&
          isDragging &&
          !touchState.isMultiTouch
        ) {
          const deltaX = e.touches[0].clientX - dragStart.x;
          const deltaY = e.touches[0].clientY - dragStart.y;
          updatePosition(deltaX, deltaY);
          setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }
      });
    },
    [
      isDragging,
      dragStart,
      touchState,
      zoomLimits,
      getBoundsForZoom,
      updatePosition,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setTouchState((prev) => ({ ...prev, isMultiTouch: false }));
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent | ReactTouchEvent) => {
      e.preventDefault();
      if (!isDefaultView) {
        resetView();
      } else {
        const clientX = "clientX" in e ? e.clientX : e.touches[0]?.clientX;
        const clientY = "clientY" in e ? e.clientY : e.touches[0]?.clientY;
        handleZoom(true, clientX, clientY, zoomLevel * 2.5);
      }
    },
    [zoomLevel, isDefaultView, resetView, handleZoom],
  );

  const handleTap = useContinuousTap(() => {}, handleDoubleClick);
  const handleWheel = useCallback(
    (e: ReactWheelEvent) => handleZoom(e.deltaY < 0, e.clientX, e.clientY),
    [handleZoom],
  );
  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
  }, []);
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

  useEffect(() => {
    const init = async () => {
      const displayEl = displayCanvasRef.current;
      if (!displayEl || resizedWidth <= 0 || resizedHeight <= 0) {
        return;
      }
      try {
        setCanvasSize({ width: resizedWidth, height: resizedHeight });
        displayEl.width = resizedWidth;
        displayEl.height = resizedHeight;

        const offscreen = displayEl.transferControlToOffscreen();
        offscreen.width = resizedWidth;
        offscreen.height = resizedHeight;

        await renderer.registerCanvas(
          VIEWER_CANVAS_ID,
          transfer(offscreen, [offscreen]),
        );
        renderer.switchCanvas(VIEWER_CANVAS_ID);
        setCanvasReady(true);
      } catch (err) {
        console.error("Canvas init failed:", err);
        setCanvasReady(false);
      }
    };
    const raf = requestAnimationFrame(init);
    return () => cancelAnimationFrame(raf);
  }, [renderer, resizedWidth, resizedHeight]);

  useEffect(() => {
    if (canvasReady) {
      const pixelOneToOne = window.devicePixelRatio || 1;
      const minZoom = Math.max(
        0.01,
        Math.max(200 / canvasSize.width, 200 / canvasSize.height),
      );
      setZoomLimits({
        min: Math.min(minZoom, 1),
        max: pixelOneToOne * TARGET_MAX_PIXEL_SIZE,
      });
      resetView();
    }
  }, [canvasReady, canvasSize.width, canvasSize.height, resetView]);

  useEffect(() => {
    const checkMobile = () =>
      setIsMobile(
        window.matchMedia("(hover: none) and (pointer: coarse)").matches,
      );
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    const vp = viewportRef.current;
    vp?.addEventListener("wheel", preventDefault, { passive: false });
    vp?.addEventListener("touchmove", preventDefault, { passive: false });
    return () => {
      vp?.removeEventListener("wheel", preventDefault);
      vp?.removeEventListener("touchmove", preventDefault);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    };
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <ViewerBackground />
      <StableDialogContent>
        <ViewerDialogHeader />
        <ZoomControlsToolbar
          {...{
            zoomLevel,
            zoomLimits,
            resetView,
            handleZoom,
            isDefaultView,
            onClose,
          }}
        />
        <MediaControlsToolbar isMobile={isMobile} />

        <div
          ref={viewportRef}
          className={cn(
            "w-full h-[calc(90vh-4rem)] min-h-[400px] overflow-hidden relative touch-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
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
          <div className="absolute inset-0 flex items-center justify-center">
            <canvas
              ref={displayCanvasRef}
              className="max-w-none pointer-events-none select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                transition:
                  isDragging || touchState.isMultiTouch
                    ? "none"
                    : "transform 0.2s ease-out",
                transformOrigin: "center",
                willChange: "transform",
                opacity: canvasReady ? 1 : 0,
                imageRendering: zoomLevel > 3 ? "pixelated" : "auto",
              }}
            />
          </div>
        </div>
      </StableDialogContent>
    </Dialog>
  );
};

export default CanvasViewer;
