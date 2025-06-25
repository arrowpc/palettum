import { useEffect, useRef, useState } from "react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Button } from "@/components/ui/button";
import { useRenderer } from "@/renderer-provider";
import { transfer } from "comlink";
import CanvasViewer from "./canvas-viewer";
import { cn } from "@/lib/utils";

const RADIUS_VALUE = 3;
const RADIUS_UNIT = "vw";
const BORDER_RADIUS = `${RADIUS_VALUE}${RADIUS_UNIT}`;
const OFFSET_FACTOR = 1 - 1 / Math.SQRT2;
const CORNER_OFFSET = `calc(${BORDER_RADIUS} * ${OFFSET_FACTOR})`;

type Mode = "on" | "off";

const ACCEPTED_TYPES = "image/*,video/*";
const MEDIA_CANVAS_ID = "media";

export default function MediaContainer() {
  const [mode, setMode] = useState<Mode>("off");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRenderer();
  const [showViewer, setShowViewer] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasMedia, setHasMedia] = useState(false);

  const mediaContainerOffscreenRef = useRef<OffscreenCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUploadError("Please upload an image, GIF, or video file.");
      return;
    }

    try {
      await renderer.load(file);
      setHasMedia(true);
    } catch (err) {
      setUploadError("Failed to load file.");
      setHasMedia(false);
      console.error(err);
    }
  };

  // Clear the uploaded media
  const handleClearMedia = () => {
    setHasMedia(false);
    renderer.dispose();
    renderer.disposeCanvas(MEDIA_CANVAS_ID);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("MediaContainer: Canvas element not found on mount.");
      return;
    }

    if (!mediaContainerOffscreenRef.current) {
      const parent = canvas.parentElement;
      if (!parent) {
        console.warn("MediaContainer: Parent element not found for canvas.");
        return;
      }
      const width = parent.offsetWidth;
      const height = parent.offsetHeight;

      const offscreen = canvas.transferControlToOffscreen();
      offscreen.width = width;
      offscreen.height = height;

      mediaContainerOffscreenRef.current = offscreen;

      renderer.registerCanvas(
        MEDIA_CANVAS_ID,
        transfer(offscreen, [offscreen]),
      );
    }
  }, [renderer]);

  return (
    <div className="relative w-full aspect-[16/9] group">
      <div
        className="w-full h-full bg-gray-200 overflow-hidden"
        style={{ borderRadius: BORDER_RADIUS }}
      >
        <canvas
          ref={canvasRef}
          className="overflow-hidden w-full h-full block"
        />
      </div>

      {!hasMedia && (
        <div className="absolute top-4 left-4 z-20">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <Button
            type="button"
            // disabled={isDragging}
            className={cn(
              "bg-primary hover:bg-primary-hover text-primary-foreground",
              "transition-all duration-200",
              "px-6 py-3 text-base pointer-events-auto",
              // isDragging && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Media
          </Button>
        </div>
      )}

      {uploadError && (
        <div className="absolute top-16 left-4 text-red-600 z-20 bg-white bg-opacity-80 px-2 py-1 rounded">
          {uploadError}
        </div>
      )}

      {/* Only show these controls if media is uploaded */}
      {hasMedia && (
        <>
          {/* X button */}
          <button
            className="absolute text-xl font-bold z-20 bg-white bg-opacity-80 rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-opacity-100 transition"
            style={{
              top: CORNER_OFFSET,
              right: CORNER_OFFSET,
              transform: "translate(50%, -50%)",
            }}
            onClick={handleClearMedia}
            aria-label="Clear uploaded media"
            type="button"
          >
            ×
          </button>

          {/* ToggleSwitch */}
          <ToggleSwitch
            className="absolute bottom-0 left-0"
            options={[
              { label: "On", value: "on" },
              { label: "Off", value: "off" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />

          {/* Hover overlay */}
          <span
            className="
              absolute left-1/2 top-1/2
              -translate-x-1/2 -translate-y-1/2
              flex items-center justify-center
              w-32 h-16
              text-xl font-bold text-white bg-black
              opacity-0 group-hover:opacity-100 transition-opacity
              cursor-pointer
              rounded
              z-10
            "
            onClick={() => setShowViewer(true)}
          >
            test
          </span>
        </>
      )}

      {showViewer && (
        <CanvasViewer
          onClose={() => {
            setShowViewer(false);
            if (mediaContainerOffscreenRef.current) {
              renderer.useCanvas("media");
              console.log("Renderer canvas reset to MediaContainer's canvas.");
            } else {
              console.warn(
                "MediaContainer: Could not reset canvas, " +
                "mediaContainerOffscreenRef is null.",
              );
            }
          }}
        />
      )}
    </div>
  );
}
