import { useState, useEffect, useRef } from "react";
import { Download, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  processImage,
  APIError,
  type ProcessImageOptions,
} from "@/services/api";
import type { Color, Palette as PaletteType } from "@/lib/palettes";
import ImageViewer from "@/components/ImageViewer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface ImageDimensions {
  containerWidth: number;
  containerHeight: number;
}
interface PixelBorderProps {
  colors: Color[];
  side: "top" | "bottom" | "left" | "right";
  dimensions: ImageDimensions;
  pixelCount: number;
  reverse: boolean;
}
interface PixelBordersProps {
  colors: Color[];
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
  palette: PaletteType | undefined;
  transparentThreshold: number;
  mapping: string;
  quantLevel: number;
  formula: string;
  weighting_kernel: string;
  anisotropic_labScales: string;
  anisotropic_shapeParameter: number;
  anisotropic_powerParameter: number;
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
  weighting_kernel: string | null;
  anisotropic_labScales: string | null;
  anisotropic_shapeParameter: number | null;
  anisotropic_powerParameter: number | null;
}

function PalettifyImage({
  file,
  dimensions,
  palette,
  transparentThreshold,
  mapping,
  quantLevel,
  formula,
  weighting_kernel,
  anisotropic_labScales,
  anisotropic_shapeParameter,
  anisotropic_powerParameter,
}: PalettifyImageProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [currentProcessedFile, setCurrentProcessedFile] = useState<
    string | null
  >(null);
  const [containerDimensions, setContainerDimensions] =
    useState<ImageDimensions | null>(null);

  const processedPaletteRef = useRef<PaletteType | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const lastProcessedSettings = useRef<ProcessedSettings>({
    fileName: null,
    width: null,
    height: null,
    paletteId: null,
    transparentThreshold: null,
    mapping: null,
    quantLevel: null,
    formula: null,
    weighting_kernel: null,
    anisotropic_labScales: null,
    anisotropic_shapeParameter: null,
    anisotropic_powerParameter: null,
  });

  const isSameSettings: boolean =
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
    weighting_kernel === lastProcessedSettings.current.weighting_kernel &&
    anisotropic_labScales ===
      lastProcessedSettings.current.anisotropic_labScales &&
    anisotropic_shapeParameter ===
      lastProcessedSettings.current.anisotropic_shapeParameter &&
    anisotropic_powerParameter ===
      lastProcessedSettings.current.anisotropic_powerParameter;

  useEffect(() => {
    if (file && currentProcessedFile !== file.name) {
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      setProcessedImageUrl(null);
      setCurrentProcessedFile(null);
      setError(null);
      lastProcessedSettings.current = {
        fileName: null,
        width: null,
        height: null,
        paletteId: null,
        transparentThreshold: null,
        mapping: null,
        quantLevel: null,
        formula: null,
        weighting_kernel: null,
        anisotropic_labScales: null,
        anisotropic_shapeParameter: null,
        anisotropic_powerParameter: null,
      };
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
      window.addEventListener("resize", updateDims);
      return () => window.removeEventListener("resize", updateDims);
    } else {
      setContainerDimensions(null);
    }
  }, [processedImageUrl]);

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

    const usesSmoothed =
      mapping === "SMOOTHED" || mapping === "SMOOTHED-PALETTIZED";
    const usesGaussianKernel = usesSmoothed && weighting_kernel === "GAUSSIAN";
    const usesInvDistKernel =
      usesSmoothed && weighting_kernel === "INVERSE_DISTANCE_POWER";

    const options: ProcessImageOptions = {
      image: file,
      colors: palette.colors,
      ...(dimensions.width && { width: dimensions.width }),
      ...(dimensions.height && { height: dimensions.height }),
      ...(transparentThreshold !== undefined && {
        transparentThreshold: transparentThreshold,
      }),
      ...(mapping && { mapping: mapping }),
      ...(quantLevel !== undefined && { quantLevel: quantLevel }),
      ...(formula && { formula: formula }),
      ...(usesSmoothed && { weighting_kernel: weighting_kernel }),
      ...(usesSmoothed && { anisotropic_labScales: anisotropic_labScales }),
      ...(usesGaussianKernel && {
        anisotropic_shapeParameter: anisotropic_shapeParameter,
      }),
      ...(usesInvDistKernel && {
        anisotropic_powerParameter: anisotropic_powerParameter,
      }),
    };

    try {
      const processedBlob = await processImage(options);
      if (processedImageUrl) URL.revokeObjectURL(processedImageUrl);
      const newProcessedUrl = URL.createObjectURL(processedBlob);
      setProcessedImageUrl(newProcessedUrl);
      setCurrentProcessedFile(file.name);
      processedPaletteRef.current = { ...palette };

      lastProcessedSettings.current = {
        fileName: file.name,
        width: dimensions.width,
        height: dimensions.height,
        paletteId: palette.id,
        transparentThreshold: transparentThreshold,
        mapping: mapping,
        quantLevel: quantLevel,
        formula: formula,
        weighting_kernel: weighting_kernel,
        anisotropic_labScales: anisotropic_labScales,
        anisotropic_shapeParameter: anisotropic_shapeParameter,
        anisotropic_powerParameter: anisotropic_powerParameter,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Image processing failed";
      setError(errorMessage);
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
      const paletteName = palette.name
        .toLowerCase()
        .replace(/[^a-z0-9_]+/gi, "-");
      link.download = `${baseFileName}-${paletteName}.${outputExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error("Download error:", err);
      setError("Failed to initiate download.");
    }
  };
  const handleViewFullSize = (): void => setIsPreviewOpen(true);
  const getProcessedColors = (): Color[] =>
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
              "Processing..."
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
            <div
              className="relative group cursor-pointer"
              onClick={handleViewFullSize}
            >
              <img
                src={processedImageUrl}
                alt="Palettified Result"
                className="w-full object-contain max-h-[60vh] block [image-rendering:-webkit-optimize-contrast] [image-rendering:pixelated]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-md flex items-center gap-2 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    className="text-white"
                  >
                    <path
                      d="M3 3h5v2H5v3H3V3zm12 0h-5v2h3v3h2V3zM3 17h5v-2H5v-3H3v5zm12 0h-5v-2h3v-3h2v5z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="text-sm font-medium text-white drop-shadow">
                    View Full Size
                  </span>
                </div>
              </div>
              {getProcessedColors().length > 0 && containerDimensions && (
                <PixelBorders
                  key={processedImageUrl}
                  colors={getProcessedColors()}
                  dimensions={containerDimensions}
                />
              )}
              <div className="absolute bottom-3 right-3 opacity-60 group-hover:opacity-90 transition-opacity duration-300 p-1">
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

      {processedImageUrl && isPreviewOpen && (
        <ImageViewer
          imageUrl={processedImageUrl}
          onClose={() => setIsPreviewOpen(false)}
        />
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
