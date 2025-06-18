import { useEffect, useRef, useState } from "react";
import { ToggleSwitch } from "./ui/toggle-switch";

const RADIUS_VALUE = 3;
const RADIUS_UNIT = "vw";
const BORDER_RADIUS = `${RADIUS_VALUE}${RADIUS_UNIT}`;
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

type Mode = "on" | "off";

const IMAGE_URL =
  "https://images.unsplash.com/photo-1728443783579-494fdbfd8512?q=80&w=1590&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export default function MediaContainer() {
  const [mode, setMode] = useState<Mode>("off");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match parent
    const parent = canvas.parentElement;
    if (!parent) return;

    // Get the size of the parent div
    const width = parent.offsetWidth;
    const height = parent.offsetHeight;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Draw image
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = IMAGE_URL;
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      // Draw image to fill canvas
      ctx.drawImage(img, 0, 0, img.width, img.height);
    };
  }, []);

  return (
    <div className="relative w-full aspect-[16/9]">
      <div
        className="w-full h-full bg-gray-200 overflow-hidden"
        style={{ borderRadius: BORDER_RADIUS }}
      >
        <canvas ref={canvasRef} className="overflow-hidden" />
      </div>

      {/* These are now outside the overflow-hidden container */}
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
    </div>
  );
}
