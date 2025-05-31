import { useState, useEffect, useCallback } from "react";
import { Download, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SharedImagePreview from "./SharedImagePreview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { palettify } from "@/lib/palettumWorker";
import type { Palette, Config, Filter, Mapping } from "palettum";
import {
  DitheringKey,
  DITHERING_NONE,
  DITHERING_FLOYD_STEINBERG,
  DITHERING_BLUE_NOISE,
  FilterKey,
} from "@/components/adjustments/adjustments.types";

const PIXELATION_THRESHOLD_WIDTH = 300;
const PIXELATION_THRESHOLD_HEIGHT = 300;

function mapDitheringKeyToWasm(ditheringKey: DitheringKey) {
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
  file,
  dimensions,
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
  file: File | null;
  dimensions: { width: number | null; height: number | null };
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
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
    };
  }, [processedImageUrl]);

  // Helper: Build config for palettify
  const buildConfig = useCallback((): Config | null => {
    if (!file || !palette || !palette.colors?.length) return null;
    return {
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
      resizeWidth: dimensions.width || undefined,
      resizeHeight: dimensions.height || undefined,
      filter: filter as Filter,
    };
  }, [
    file,
    palette,
    mapping,
    formula,
    quantLevel,
    transparentThreshold,
    smoothingStyle,
    smoothingStrength,
    ditheringStyle,
    ditheringStrength,
    dimensions.width,
    dimensions.height,
    filter,
  ]);

  // Process image
  const handleProcessImage = useCallback(async () => {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }
    if (!palette || !palette.colors?.length) {
      setError("Please select a valid palette.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const config = buildConfig();
      if (!config) throw new Error("Invalid config.");
      const result = await palettify(config);
      const blob = new Blob([result], {
        type: file.type === "image/gif" ? "image/gif" : "image/png",
      });
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      setProcessedImageUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setError(err?.message || "An unknown error occurred during processing.");
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      setProcessedImageUrl(null);
    } finally {
      setIsProcessing(false);
    }
  }, [file, palette, buildConfig, processedImageUrl]);

  // Download
  const handleDownload = () => {
    if (!processedImageUrl || !file) return;
    const link = document.createElement("a");
    link.href = processedImageUrl;
    const ext =
      file.name.split(".").pop()?.toLowerCase() === "gif" ? "gif" : "png";
    const base = file.name.replace(/\.[^/.]+$/, "");
    link.download = `${base}-palettified.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Image rendering style (pixelated for small images)
  const [imageRenderingStyle, setImageRenderingStyle] = useState<
    "auto" | "pixelated"
  >("auto");
  useEffect(() => {
    if (!processedImageUrl) {
      setImageRenderingStyle("auto");
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      if (
        img.naturalWidth < PIXELATION_THRESHOLD_WIDTH ||
        img.naturalHeight < PIXELATION_THRESHOLD_HEIGHT
      ) {
        setImageRenderingStyle("pixelated");
      } else {
        setImageRenderingStyle("auto");
      }
    };
    img.src = processedImageUrl;
    return () => {
      img.onload = null;
    };
  }, [processedImageUrl]);

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
          disabled={!file || !palette || isProcessing}
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

      {processedImageUrl && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-center">
            Result
          </h2>
          <div className="rounded-lg overflow-hidden relative border border-border shadow-md bg-muted/30">
            <SharedImagePreview
              imageUrl={processedImageUrl}
              altText="Palettified Result"
              showRemoveButton={false}
              enableViewFullSize={true}
              className={`w-full max-h-[60vh] [image-rendering:${imageRenderingStyle}]`}
              imageClassName={`w-full object-contain max-h-[60vh] block [image-rendering:${imageRenderingStyle}]`}
            />
          </div>
          <div className="flex justify-center">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Save Image</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PalettifyImage;
