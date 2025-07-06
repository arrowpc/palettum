import { useState } from "react";
import { cn } from "@/lib/utils";
import InputArea from "./input-area";
import CanvasPreview, { MEDIA_CANVAS_ID } from "./canvas-preview";
import CanvasViewer from "./canvas-viewer";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useRenderer } from "@/renderer-provider";
import { CircleX } from "lucide-react";
import type { Mapping } from "palettum";
import { useConfigStore } from "@/store";

const BORDER_RADIUS = "6vw";
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

export default function MediaContainer() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const setting = "mapping";
  const value = useConfigStore((state) => state.config[setting]);
  const setConfig = useConfigStore((state) => state.setConfig);
  const renderer = useRenderer();

  const clear = () => {
    renderer.disposeCanvas(MEDIA_CANVAS_ID).catch(console.error);
    renderer.dispose();
    setFile(null);
  };

  const frameClass = cn(
    "absolute inset-0 overflow-hidden border-2 transition-colors",
    file ? "border-solid border-foreground" : "border-dashed border-primary/70",
    dragging && "border-primary bg-primary/5",
  );

  return (
    <div className="relative w-full aspect-[16/9] group">
      <div className={frameClass} style={{ borderRadius: BORDER_RADIUS }}>
        {file ? (
          <CanvasPreview
            file={file}
            onClick={() => setShowViewer(true)}
            borderRadius={BORDER_RADIUS}
          />
        ) : (
          <InputArea onFile={setFile} onDragStateChange={setDragging} />
        )}
      </div>

      {file && (
        <>
          <CircleX
            aria-label="Clear media"
            onClick={clear}
            className="absolute h-10 w-10 fill-primary cursor-pointer"
            style={{
              top: CORNER_OFFSET,
              right: CORNER_OFFSET,
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
