import { useState } from "react";
import { cn } from "@/lib/utils";
import InputArea from "./input-area";
import CanvasPreview, { MEDIA_CANVAS_ID } from "./canvas-preview";
import CanvasViewer from "./canvas-viewer";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useRenderer } from "@/renderer-provider";
import { CircleX } from "lucide-react";

const BORDER_RADIUS = "6vw";
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

type Mode = "on" | "off";

export default function MediaContainer() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [mode, setMode] = useState<Mode>("off");
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
          <CanvasPreview file={file} onClick={() => setShowViewer(true)} />
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
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { label: "On", value: "on" },
              { label: "Off", value: "off" },
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
