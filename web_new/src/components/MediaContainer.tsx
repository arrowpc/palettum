import { useEffect, useRef, useState } from "react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useRenderer } from "@/renderer-provider";
import { transfer } from "comlink";

const RADIUS_VALUE = 3;
const RADIUS_UNIT = "vw";
const BORDER_RADIUS = `${RADIUS_VALUE}${RADIUS_UNIT}`;
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

type Mode = "on" | "off";

const IMAGE_URL = "https://i.nuuls.com/B3chP.gif";

const transferredCanvases = new WeakSet<HTMLCanvasElement>();

export default function MediaContainer() {
  const [mode, setMode] = useState<Mode>("off");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRenderer();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || transferredCanvases.has(canvas)) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = parent.offsetWidth;
    const height = parent.offsetHeight;

    const offscreen = canvas.transferControlToOffscreen();

    offscreen.width = width;
    offscreen.height = height;

    transferredCanvases.add(canvas);
    renderer.setCanvas(transfer(offscreen, [offscreen]));

    fetch(IMAGE_URL, { mode: "cors" })
      .then((response) => response.blob())
      .then((blob) => {
        renderer.load(blob);
      })
      .catch((err) => {
        console.error("Failed to load image as Blob:", err);
      });
  }, []);

  return (
    <div className="relative w-full aspect-[16/9]">
      <div
        className="w-full h-full bg-gray-200 overflow-hidden"
        style={{ borderRadius: BORDER_RADIUS }}
      >
        <canvas
          ref={canvasRef}
          className="overflow-hidden w-full h-full block"
        />
      </div>

      <div
        className="absolute text-xl font-bold"
        style={{
          top: CORNER_OFFSET,
          right: CORNER_OFFSET,
          transform: "translate(50%, -50%)",
        }}
      >
        x
      </div>
      <ToggleSwitch
        className="absolute bottom-0 left-0"
        options={[
          { label: "On", value: "on" },
          { label: "Off", value: "off" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="p-2 bg-black/50 backdrop-blur-sm rounded-md flex items-center gap-1.5 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-200">
          <Maximize className="w-4 h-4" />
          <span className="text-xs font-medium">View Full Size</span>
        </div>
      </div>
    </div>
  );
}
