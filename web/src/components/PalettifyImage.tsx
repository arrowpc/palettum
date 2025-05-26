import { useState, useEffect, useRef, useMemo } from "react";
import { Download, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SharedImagePreview from "./SharedImagePreview";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { type Palette, type Rgb } from "palettum";
import type {
  Config,
  DitheringAlgorithm,
  Mapping,
  PalettizedFormula,
  SmoothedFormula,
} from "palettum";

interface ImageDimensions {
  containerWidth: number;
  containerHeight: number;
}

interface PixelBorderProps {
  colors: Rgb[];
  side: "top" | "bottom" | "left" | "right";
  dimensions: ImageDimensions;
  pixelCount: number;
  reverse: boolean;
}

interface PixelBordersProps {
  colors: Rgb[];
  dimensions: ImageDimensions | null;
}

const BORDER_THICKNESS = 5;
const HORIZONTAL_PIXELS = 40;
const VERTICAL_PIXELS = 30;

function PixelBorder({
  colors,
  side,
  dimensions,
  pixelCount,
  reverse,
}: PixelBorderProps): JSX.Element | null {
  if (!dimensions || !colors.length) return null;
  const { containerWidth, containerHeight } = dimensions;
  const positions: Record<string, React.CSSProperties> = {
    top: {
      top: 0,
      left: 0,
      width: `${containerWidth}px`,
      height: `${BORDER_THICKNESS}px`,
    },
    bottom: {
      bottom: 0,
      left: 0,
      width: `${containerWidth}px`,
      height: `${BORDER_THICKNESS}px`,
    },
    left: {
      top: 0,
      left: 0,
      height: `${containerHeight}px`,
      width: `${BORDER_THICKNESS}px`,
    },
    right: {
      top: 0,
      right: 0,
      height: `${containerHeight}px`,
      width: `${BORDER_THICKNESS}px`,
    },
  };
  const isHorizontal = side === "top" || side === "bottom";
  return (
    <div
      className={`absolute flex ${isHorizontal ? "" : "flex-col"} z-1`}
      style={positions[side]}
    >
      {Array.from({ length: pixelCount }).map((_, i) => {
        const index = reverse ? pixelCount - i - 1 : i;
        const colorIndex = index % colors.length;
        const { r, g, b } = colors[colorIndex];
        return (
          <div
            key={`${side}-${i}`}
            className="animate-pixel-fade-in"
            style={{
              [isHorizontal ? "width" : "height"]: `${100 / pixelCount}%`,
              [isHorizontal ? "height" : "width"]: "100%",
              backgroundColor: `rgb(${r}, ${g}, ${b})`,
              animationDelay: `${i * 15}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

function PixelBorders({
  colors,
  dimensions,
}: PixelBordersProps): JSX.Element | null {
  if (!dimensions || !colors.length) return null;
  return (
    <>
      <PixelBorder
        colors={colors}
        side="top"
        dimensions={dimensions}
        pixelCount={HORIZONTAL_PIXELS}
        reverse={false}
      />
      <PixelBorder
        colors={colors}
        side="bottom"
        dimensions={dimensions}
        pixelCount={HORIZONTAL_PIXELS}
        reverse={true}
      />
      <PixelBorder
        colors={colors}
        side="left"
        dimensions={dimensions}
        pixelCount={VERTICAL_PIXELS}
        reverse={false}
      />
      <PixelBorder
        colors={colors}
        side="right"
        dimensions={dimensions}
        pixelCount={VERTICAL_PIXELS}
        reverse={true}
      />
    </>
  );
}

interface PalettifyImageProps {
  file: File | null;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  palette: Palette | undefined;
  transparentThreshold: number;
  mapping: string;
  quantLevel: number;
  formula: string;
  smoothingStyle: string;
  ditheringStyle: string;
  labScales: [number, number, number];
  smoothingStrength: number;
  ditheringStrength: number;
}

interface ProcessedSettings {
  fileName: string | null;
  width: number | null;
  height: number | null;
  paletteId: string | null;
  transparentThreshold: number | null;
  mapping: string | null;
  quantLevel: number | null;
  formula: string | null;
  smoothingStyle: string | null;
  ditheringStyle: string | null;
  labScales: [number, number, number] | null;
  smoothingStrength: number | null;
  ditheringStrength: number | null;
}

type TaskCallbacks = {
  resolve: (value: Uint8Array) => void;
  reject: (reason?: any) => void;
};

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
  labScales,
  smoothingStrength,
  ditheringStrength,
}: PalettifyImageProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );
  const [currentProcessedFile, setCurrentProcessedFile] = useState<
    string | null
  >(null);
  const [containerDimensions, setContainerDimensions] =
    useState<ImageDimensions | null>(null);

  const processedPaletteRef = useRef<Palette | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const taskIdCounterRef = useRef(0);
  const pendingTasksRef = useRef(new Map<number, TaskCallbacks>());

  const lastProcessedSettings = useRef<ProcessedSettings>({
    fileName: null,
    width: null,
    height: null,
    paletteId: null,
    transparentThreshold: null,
    mapping: null,
    quantLevel: null,
    formula: null,
    smoothingStyle: null,
    ditheringStyle: null,
    labScales: null,
    smoothingStrength: null,
    ditheringStrength: null,
  });

  const isSameSettings: boolean = useMemo(
    () =>
      !!processedImageUrl &&
      file?.name === lastProcessedSettings.current.fileName &&
      dimensions.width === lastProcessedSettings.current.width &&
      dimensions.height === lastProcessedSettings.current.height &&
      palette?.id === lastProcessedSettings.current.paletteId &&
      transparentThreshold ===
      lastProcessedSettings.current.transparentThreshold &&
      mapping === lastProcessedSettings.current.mapping &&
      quantLevel === lastProcessedSettings.current.quantLevel &&
      formula === lastProcessedSettings.current.formula &&
      smoothingStyle === lastProcessedSettings.current.smoothingStyle &&
      smoothingStrength === lastProcessedSettings.current.smoothingStrength &&
      ditheringStyle === lastProcessedSettings.current.ditheringStyle &&
      ditheringStrength === lastProcessedSettings.current.ditheringStrength &&
      labScales.length ===
      (lastProcessedSettings.current.labScales?.length ?? 0) &&
      labScales.every(
        (v, i) => v === lastProcessedSettings.current.labScales?.[i],
      ),
    [
      processedImageUrl,
      file,
      dimensions,
      palette,
      transparentThreshold,
      mapping,
      quantLevel,
      formula,
      smoothingStyle,
      ditheringStyle,
      labScales,
      smoothingStrength,
      ditheringStrength,
    ],
  );

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../worker.js", import.meta.url), {
        type: "module",
      });
      workerRef.current.onmessage = (e) => {
        const { id, status, result, error: workerError } = e.data;
        const pendingTask = pendingTasksRef.current.get(id);
        if (pendingTask) {
          if (status === "success" && result) {
            pendingTask.resolve(result);
          } else if (status === "error" && workerError) {
            pendingTask.reject(new Error(workerError));
          }
          pendingTasksRef.current.delete(id);
        }
      };
      workerRef.current.onerror = (error) => {
        console.error("Worker error:", error);
        pendingTasksRef.current.forEach((task) => {
          task.reject(new Error("Worker encountered an error"));
        });
        pendingTasksRef.current.clear();
      };
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingTasksRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (file && currentProcessedFile !== file.name) {
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      setProcessedImageUrl(null);
      setCurrentProcessedFile(null);
      setError(null);
      lastProcessedSettings.current = {
        /* Reset */
      } as ProcessedSettings;
    }
  }, [file, currentProcessedFile, processedImageUrl]);

  useEffect(() => {
    return () => {
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
    };
  }, [processedImageUrl]);

  useEffect(() => {
    const updateDims = () => {
      if (imageContainerRef.current) {
        const { width, height } =
          imageContainerRef.current.getBoundingClientRect();
        setContainerDimensions({
          containerWidth: width,
          containerHeight: height,
        });
      }
    };
    if (processedImageUrl) {
      updateDims();
      const resizeObserver = new ResizeObserver(updateDims);
      if (imageContainerRef.current) {
        resizeObserver.observe(imageContainerRef.current);
      }
      window.addEventListener("resize", updateDims);
      return () => {
        if (imageContainerRef.current) {
          resizeObserver.unobserve(imageContainerRef.current);
        }
        window.removeEventListener("resize", updateDims);
        resizeObserver.disconnect();
      };
    } else {
      setContainerDimensions(null);
    }
  }, [processedImageUrl]);

  const palettifyWithWorker = (
    imageBytes: Uint8Array,
    config: Config,
    mimeType: string,
  ): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("Worker not initialized"));
        return;
      }
      const taskId = taskIdCounterRef.current++;
      pendingTasksRef.current.set(taskId, {
        resolve: (workerResult: Uint8Array) => {
          try {
            const blob = new Blob([workerResult], { type: mimeType });
            resolve(blob);
          } catch (conversionError) {
            console.error("Error creating Blob:", conversionError);
            reject(
              conversionError instanceof Error
                ? conversionError
                : new Error("Failed to create Blob from worker result"),
            );
          }
        },
        reject,
      });
      const clonedBytes = new Uint8Array(imageBytes);
      workerRef.current.postMessage(
        { id: taskId, imageBytes: clonedBytes, config },
        [clonedBytes.buffer],
      );
    });
  };

  const handleProcessImage = async (): Promise<void> => {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }
    if (!palette || !palette.colors || palette.colors.length === 0) {
      setError("Please select a valid palette.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const imageBytes = new Uint8Array(arrayBuffer);
      const configJs: Config = {
        palette: {
          id: palette.id || "custom",
          source: palette.source || "custom",
          colors: palette.colors.map((c) => ({ r: c.r, g: c.g, b: c.b })),
          kind: palette.kind || "Unset",
        },
        mapping: mapping as Mapping,
        palettizedFormula: formula as PalettizedFormula,
        quantLevel,
        transparencyThreshold: transparentThreshold,
        smoothedFormula: smoothingStyle as SmoothedFormula,
        smoothingStrength,
        ditheringAlgorithm: ditheringStyle as DitheringAlgorithm,
        ditheringStrength,
        labScales,
        resizeWidth: dimensions.width || null,
        resizeHeight: dimensions.height || null,
      };

      const isGif =
        file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
      const mimeType = isGif ? "image/gif" : "image/png";
      const outputBlob = await palettifyWithWorker(
        imageBytes,
        configJs,
        mimeType,
      );
      const url = URL.createObjectURL(outputBlob);
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      setProcessedImageUrl(url);
      setCurrentProcessedFile(file.name);
      processedPaletteRef.current = { ...palette };
      lastProcessedSettings.current = {
        fileName: file.name,
        width: dimensions.width,
        height: dimensions.height,
        paletteId: palette.id,
        transparentThreshold,
        mapping,
        quantLevel,
        formula,
        smoothingStyle,
        ditheringStyle,
        labScales,
        smoothingStrength,
        ditheringStrength,
      };
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(
        err.message ||
        err.toString() ||
        "An unknown error occurred during processing.",
      );
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      setProcessedImageUrl(null);
      setCurrentProcessedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (): void => {
    if (!processedImageUrl || !file || !currentProcessedFile || !palette)
      return;
    try {
      if (file.name !== currentProcessedFile) {
        setError("Current file changed. Please re-process before downloading.");
        return;
      }
      const link = document.createElement("a");
      link.href = processedImageUrl;
      const originalExtension = file.name.split(".").pop()?.toLowerCase() || "";
      const baseFileName = file.name.replace(/\.[^/.]+$/, "");
      const outputExtension = originalExtension === "gif" ? "gif" : "png";
      const paletteId = (palette.id || "custom-palette")
        .toLowerCase()
        .replace(/[^a-z0-9_]+/gi, "-");
      link.download = `${baseFileName}-${paletteId}.${outputExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error("Download error:", err);
      setError("Failed to initiate download.");
    }
  };

  const getProcessedColors = (): Rgb[] =>
    processedPaletteRef.current?.colors || [];

  const canProcess =
    !!file && !!palette && !!palette.colors && palette.colors.length > 0;

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
        {isSameSettings ? (
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    disabled={true}
                    className="w-full disabled:opacity-60"
                  >
                    <Wand2 className="mr-2 h-5 w-5" />
                    Palettify Image
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Image already processed with current settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
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
                <Wand2 className="mr-2 h-5 w-5" /> Palettify Image
              </>
            )}
          </Button>
        )}
      </div>

      {processedImageUrl && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-center">
            Result
          </h2>
          <div
            className="rounded-lg overflow-hidden relative border border-border shadow-md bg-muted/30"
            ref={imageContainerRef}
          >
            <SharedImagePreview
              imageUrl={processedImageUrl}
              altText="Palettified Result"
              showRemoveButton={false}
              enableViewFullSize={true}
              className="w-full max-h-[60vh]"
              imageClassName="w-full object-contain max-h-[60vh] block [image-rendering:-webkit-optimize-contrast] [image-rendering:pixelated]"
            />
            {getProcessedColors().length > 0 && containerDimensions && (
              <PixelBorders
                key={processedImageUrl}
                colors={getProcessedColors()}
                dimensions={containerDimensions}
              />
            )}
            <div className="absolute bottom-3 right-3 opacity-60 group-hover:opacity-90 transition-opacity duration-300 p-1 pointer-events-none">
              <div className="grid grid-cols-3 gap-0.5 w-8 h-8 transform rotate-45">
                {getProcessedColors()
                  .slice(0, 9)
                  .map((color, index) => (
                    <div
                      key={index}
                      className="w-2 h-2 transition-transform duration-300 hover:scale-110"
                      style={{
                        backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
                      }}
                    />
                  ))}
                {Array.from({
                  length: Math.max(0, 9 - getProcessedColors().length),
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-2 h-2 bg-background/30 dark:bg-background-tertiary/30"
                  />
                ))}
              </div>
            </div>
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
 @keyframes pixelFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
 .animate-pixel-fade-in { animation: pixelFadeIn 0.4s ease-out forwards; }
 `,
        }}
      />
    </div>
  );
}

export default PalettifyImage;
