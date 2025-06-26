import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import InputArea from "./input-area";
import CanvasPreview, { MEDIA_CANVAS_ID } from "./canvas-preview";
import CanvasViewer from "./canvas-viewer";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useRenderer } from "@/renderer-provider";

const RADIUS_VALUE = 6;
const RADIUS_UNIT = "vw";
const BORDER_RADIUS = `${RADIUS_VALUE}${RADIUS_UNIT}`;
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

type Mode = "on" | "off";

export default function MediaContainer() {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [mode, setMode] = useState<Mode>("off");
  const renderer = useRenderer();

  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (f) setFile(f);
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);

  const enter = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  };
  const over = (e: React.DragEvent) => e.preventDefault();
  const leave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDrag(false);
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const frameClass = cn(
    "absolute inset-0 overflow-hidden border-2",
    file ? "border-solid border-primary" : "border-dashed border-primary",
    drag && "border-primary bg-primary/5 transition-colors",
  );

  const clear = () => {
    renderer.disposeCanvas(MEDIA_CANVAS_ID);
    renderer.dispose();
    setFile(null);
  };

  return (
    <div
      className="relative w-full aspect-[16/9] group"
      onDragEnter={enter}
      onDragOver={over}
      onDragLeave={leave}
      onDrop={drop}
    >
      <div className={frameClass} style={{ borderRadius: BORDER_RADIUS }}>
        {file ? <CanvasPreview file={file} /> : <InputArea onFile={setFile} />}
      </div>
      {file && (
        <>
          <button
            onClick={clear}
            aria-label="Clear media"
            className="
              absolute z-30 flex h-8 w-8 items-center justify-center
              rounded-full bg-white/80 text-xl font-bold shadow
              hover:bg-white
            "
            style={{
              top: CORNER_OFFSET,
              right: CORNER_OFFSET,
              transform: "translate(50%, -50%)",
            }}
          >
            ×
          </button>

          <ToggleSwitch
            className="absolute bottom-0 left-0 z-30"
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { label: "On", value: "on" },
              { label: "Off", value: "off" },
            ]}
          />

          <span
            className="
              absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              z-20 flex h-16 w-32 cursor-pointer items-center justify-center
              rounded bg-black text-xl font-bold text-white
              opacity-0 transition-opacity group-hover:opacity-100
            "
            onClick={() => setShowViewer(true)}
          >
            View
          </span>
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
