import { useState, useRef, useLayoutEffect } from "react";
import { cn, checkAlphaChannel } from "@/lib/utils";
import InputArea from "./input-area";
import CanvasPreview from "./canvas-preview";
import CanvasViewer from "./canvas-viewer";
import { ToggleSwitch } from "@/components/ui/experimental/toggle-switch";
import { useRenderer } from "@/providers/renderer-provider";
import { CircleX } from "lucide-react";
import { type Mapping } from "palettum";
import { useConfigStore } from "@/stores";
import { useMediaStore } from "@/stores/media";
import DashedBorder from "@/components/ui/dashed-border";
import { MEDIA_CANVAS_ID, VIEWER_CANVAS_ID } from "@/lib/constants";
import { useSyncConfigToWorker } from "@/hooks/use-sync-config-to-worker";

const BORDER_RADIUS_SCALE = 0.15;

export default function MediaContainer() {
  useSyncConfigToWorker();

  const file = useMediaStore((s) => s.file);
  const setFile = useMediaStore((s) => s.setFile);
  const setHasAlpha = useMediaStore((s) => s.setHasAlpha);
  const resetMedia = useMediaStore((s) => s.reset);

  const setting = "mapping";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);

  const [dragging, setDragging] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [borderRadius, setBorderRadius] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderer = useRenderer();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const newBorderRadius = container.offsetWidth * BORDER_RADIUS_SCALE;
      setBorderRadius(newBorderRadius);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleFile = async (f: File) => {
    setFile(f);

    const hasAlpha = await checkAlphaChannel(f);
    setHasAlpha(hasAlpha);
  };

  const clear = () => {
    renderer.dispose();
    renderer.dropCanvas(MEDIA_CANVAS_ID);
    resetMedia();
  };

  const frameClass = cn(
    "absolute inset-0 overflow-hidden transition-colors text-foreground/70",
    dragging && "text-primary bg-primary/5",
  );

  const offsetFactor = 1 - 1 / Math.SQRT2;
  const cornerOffset = `calc(${borderRadius}px * ${offsetFactor})`;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[16/9] group overflow-hidden"
    >
      <div className={frameClass} style={{ borderRadius: `${borderRadius}px` }}>
        {file ? (
          <CanvasPreview
            file={file}
            onCanvasClick={() => {
              setShowViewer(true);
            }}
            borderRadius={`${borderRadius}px`}
          />
        ) : (
          <InputArea
            onFile={(f) => {
              handleFile(f);
            }}
            onDragStateChange={(d) => {
              setDragging(d);
            }}
          />
        )}
      </div>
      <DashedBorder
        isSolid={!!file}
        dash={50}
        gap={30}
        strokeWidth={2}
        borderRadius={borderRadius}
        animationDuration={300}
        className="absolute inset-0 z-10 pointer-events-none"
      />

      {file && (
        <>
          <CircleX
            aria-label="Clear media"
            onClick={clear}
            className="absolute h-10 w-10 fill-primary cursor-pointer hover:opacity-80 transition-opacity z-20"
            style={{
              top: cornerOffset,
              right: cornerOffset,
              transform: "translate(50%, -50%)",
            }}
          />

          <ToggleSwitch
            className="absolute bottom-0 left-0 z-30"
            value={value ?? "Smoothed"}
            onChange={(v) => setConfig(setting, v as Mapping)}
            options={[
              { label: "Blend", value: "Smoothed" },
              { label: "Match", value: "Palettized" },
            ]}
          />
        </>
      )}

      {showViewer && (
        <CanvasViewer
          onClose={() => {
            setShowViewer(false);
            renderer.dropCanvas(VIEWER_CANVAS_ID);
            renderer.switchCanvas(MEDIA_CANVAS_ID);
          }}
        />
      )}
    </div>
  );
}
