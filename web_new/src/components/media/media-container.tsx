import { useState, useRef, useLayoutEffect } from "react";
import { cn, checkAlphaChannel } from "@/lib/utils";
import InputArea from "./input-area";
import CanvasPreview, { MEDIA_CANVAS_ID } from "./canvas-preview";
import CanvasViewer from "./canvas-viewer";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useRenderer } from "@/providers/renderer-provider";
import { CircleX } from "lucide-react";
import { type Mapping } from "palettum";

import { useConfigStore, useMediaStore } from "@/store";
import DashedBorder from "@/components/ui/dashed-border";

const BORDER_RADIUS_SCALE = 0.15;

export default function MediaContainer() {
  const [dragging, setDragging] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [borderRadius, setBorderRadius] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const setting = "mapping";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);
  const file = useMediaStore((state) => state.file);
  const setFile = useMediaStore((state) => state.setFile);
  const setHasAlpha = useMediaStore((state) => state.setHasAlpha);
  const renderer = useRenderer();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      setBorderRadius(container.offsetWidth * BORDER_RADIUS_SCALE);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleFile = async (file: File) => {
    setFile(file);
    const hasAlpha = await checkAlphaChannel(file);
    setHasAlpha(hasAlpha);
    renderer.init();
  };

  const clear = () => {
    renderer.disposeCanvas(MEDIA_CANVAS_ID).catch(console.error);
    renderer.dispose();
    setFile(null);
  };

  const frameClass = cn(
    "absolute inset-0 overflow-hidden transition-colors text-foreground/70",
    dragging && "text-primary bg-primary/5",
  );

  const offsetFactor = 1 - 1 / Math.SQRT2;
  const cornerOffset = `calc(${borderRadius}px * ${offsetFactor})`;

  return (
    <div ref={containerRef} className="relative w-full aspect-[16/9] group">
      <div
        className={frameClass}
        style={{ borderRadius: `${borderRadius}px` }}
      >
        <DashedBorder
          isSolid={!!file}
          dash={50}
          gap={30}
          strokeWidth={2}
          borderRadius={borderRadius}
          animationDuration={300}
        >
          {file ? (
            <CanvasPreview
              file={file}
              onCanvasClick={() => setShowViewer(true)}
              borderRadius={`${borderRadius}px`}
            />
          ) : (
            <InputArea onFile={handleFile} onDragStateChange={setDragging} />
          )}
        </DashedBorder>
      </div>

      {file && (
        <>
          <CircleX
            aria-label="Clear media"
            onClick={clear}
            className="absolute h-10 w-10 fill-primary cursor-pointer hover:opacity-80 transition-opacity"
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
            renderer.useCanvas(MEDIA_CANVAS_ID);
          }}
        />
      )}
    </div>
  );
}
