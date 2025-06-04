import React, { useState, useCallback, useMemo, useEffect } from "react"; // Added useEffect
import { Download, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import type { Palette, Config, Filter, Mapping } from "palettum";
import {
  DitheringKey,
  DITHERING_NONE,
  DITHERING_FLOYD_STEINBERG,
  DITHERING_BLUE_NOISE,
  FilterKey,
} from "@/components/adjustments/adjustments.types"; // Assuming path
import CanvasPreview from "./CanvasPreview"; // Assuming path
import { useShader } from "@/ShaderContext"; // Assuming path

const PIXELATION_THRESHOLD_WIDTH = 300;
const PIXELATION_THRESHOLD_HEIGHT = 300;

function mapDitheringKeyToWasm(ditheringKey: DitheringKey): string {
  switch (ditheringKey) {
    case DITHERING_FLOYD_STEINBERG:
      return "Fs";
    case DITHERING_BLUE_NOISE:
      return "Bn";
    case DITHERING_NONE:
    default:
      return "None";
  }
}

function PalettifyImage({
  file, // This prop might become less directly relevant if shader context is source of truth
  // dimensions prop might also be derived from shader.sourceDimensions
  palette,
  transparentThreshold,
  mapping,
  quantLevel,
  formula,
  smoothingStyle,
  ditheringStyle,
  smoothingStrength,
  ditheringStrength,
  filter,
}: {
  file: File | null; // Keep for now, for download name etc.
  dimensions: { width: number | null; height: number | null }; // Could be removed if using shader.sourceDimensions
  palette: Palette | undefined;
  transparentThreshold: number;
  mapping: string;
  quantLevel: number;
  formula: string;
  smoothingStyle: string;
  ditheringStyle: DitheringKey;
  smoothingStrength: number;
  ditheringStrength: number;
  filter: FilterKey;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // canvasVersion is used as a key for CanvasPreview to force re-render on new palettify
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [hasPalettified, setHasPalettified] = useState(false);
  const { shader } = useShader();

  // Reset hasPalettified if the source canvas changes (e.g., new image/video uploaded)
  useEffect(() => {
    setHasPalettified(false);
    setCanvasVersion(0); // Reset version as well
  }, [shader?.canvas]);

  const buildConfig = useCallback((): Config | null => {
    if (!shader?.sourceDimensions || !palette || !palette.colors?.length) {
      console.warn(
        "buildConfig: Aborting due to missing source dimensions from shader context or palette colors.",
      );
      return null;
    }
    const configData: Config = {
      palette: {
        id: palette.id || "custom",
        source: palette.source || "custom",
        colors: palette.colors.map((c) => ({ r: c.r, g: c.g, b: c.b })),
        kind: palette.kind || "Unset",
      },
      mapping: mapping as Mapping,
      diffFormula: formula,
      quantLevel,
      transparencyThreshold: transparentThreshold,
      smoothFormula: smoothingStyle,
      smoothStrength: smoothingStrength,
      ditherAlgorithm: mapDitheringKeyToWasm(ditheringStyle),
      ditherStrength: ditheringStrength,
      // Resize dimensions are now part of the config for the filter
      // If you want to allow resizing during palettify, pass them here.
      // Otherwise, the filter uses the original media dimensions.
      // resizeWidth: dimensions.width || undefined, // Use dimensions prop if you want to allow palettify-time resize
      // resizeHeight: dimensions.height || undefined,
      resizeWidth: undefined, // Example: use original width from shader.sourceDimensions
      resizeHeight: undefined, // Example: use original height from shader.sourceDimensions
      filter: filter as Filter,
    };
    return configData;
  }, [
    shader?.sourceDimensions, // Use dimensions from shader context
    palette,
    mapping,
    formula,
    quantLevel,
    transparentThreshold,
    smoothingStyle,
    smoothingStrength,
    ditheringStyle,
    ditheringStrength,
    // dimensions.width, dimensions.height, // If using prop for resize
    filter,
  ]);

  const handleProcessImage = useCallback(async () => {
    if (!shader?.filter || !shader?.canvas) {
      setError(
        "Media filter is not initialized or no media loaded. Please upload an image or video first.",
      );
      return;
    }
    if (!palette || !palette.colors?.length) {
      setError("Please select a valid palette.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    // setHasPalettified(false); // Set to true only on success

    try {
      const config = buildConfig();
      if (!config) {
        throw new Error(
          "Invalid configuration for palettification. Check inputs.",
        );
      }
      console.log("Attempting to apply filter with config:", config);
      // apply_filter should update the shader.canvas in place
      shader.filter.apply_filter(config);
      console.log("shader.filter.apply_filter completed.");

      setCanvasVersion((v) => v + 1); // Force CanvasPreview to pick up changes
      setHasPalettified(true);
    } catch (err: any) {
      console.error("Error during shader.filter.apply_filter:", err);
      setError(
        `Processing error: ${err?.message || "Unknown error occurred."}`,
      );
      setHasPalettified(false);
    } finally {
      setIsProcessing(false);
    }
  }, [palette, buildConfig, shader]);

  const handleDownload = useCallback(async () => {
    if (shader?.sourceMediaType === "video") {
      setError("Video download is not yet supported. This feature is a TODO.");
      return;
    }
    if (!shader?.canvas || !file || !hasPalettified) {
      setError(
        "No processed image available to download, original file missing, or image not palettified.",
      );
      return;
    }
    try {
      const blob = await shader.canvas.convertToBlob({
        type: "image/png", // Videos would need a different approach (TODO)
      });
      if (!blob) {
        setError("Failed to convert canvas to blob for download.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const base = file.name.replace(/\.[^/.]+$/, "");
      link.download = `${base}-palettified.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError(null);
    } catch (downloadError: any) {
      console.error("Download error:", downloadError);
      setError(`Failed to download image: ${downloadError.message}`);
    }
  }, [shader?.canvas, shader?.sourceMediaType, file, hasPalettified]);

  const imageRenderingStyle = useMemo(() => {
    if (hasPalettified && shader?.canvas && shader?.sourceDimensions) {
      return shader.sourceDimensions.width < PIXELATION_THRESHOLD_WIDTH ||
        shader.sourceDimensions.height < PIXELATION_THRESHOLD_HEIGHT
        ? "pixelated"
        : "auto";
    }
    return "auto";
  }, [shader?.canvas, shader?.sourceDimensions, canvasVersion, hasPalettified]);

  const canProcess = !!(
    shader?.filter &&
    shader.canvas &&
    palette &&
    palette.colors?.length > 0
  );

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleProcessImage}
          disabled={!canProcess || isProcessing}
          className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-primary-foreground transition-all duration-200"
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Palettifying...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-5 w-5" /> Palettify
            </>
          )}
        </Button>
      </div>

      {hasPalettified && shader?.canvas && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-center">
            Result
          </h2>
          <div className="rounded-lg overflow-hidden relative border border-border shadow-md bg-muted/30">
            <CanvasPreview
              key={`palettified-result-${canvasVersion}`} // Use canvasVersion in key
              canvas={shader.canvas} // This is the wgpuTargetCanvas, updated by ImageFilter
              altText="Palettified Result"
              showRemoveButton={false}
              enableViewFullSize={true}
              className="w-full max-h-[60vh]"
              canvasClassName={
                imageRenderingStyle === "pixelated"
                  ? "image-rendering-pixelated" // CSS: image-rendering: pixelated;
                  : "image-rendering-auto" // CSS: image-rendering: auto;
              }
            // For videos, PalettifyImage doesn't manage frame updates, ImageUpload does.
            // So previewVersion from ImageUpload is what keeps the *source* CanvasPreview updated.
            // This CanvasPreview for result just needs to update when canvasVersion (palettify op) changes.
            />
          </div>
          <div className="flex justify-center">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex items-center space-x-2"
              disabled={
                !shader?.canvas ||
                !file ||
                !hasPalettified ||
                shader?.sourceMediaType === "video"
              }
            >
              <Download className="h-4 w-4" />
              <span>
                {shader?.sourceMediaType === "video"
                  ? "Save (Video N/A)"
                  : "Save Image"}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PalettifyImage;
