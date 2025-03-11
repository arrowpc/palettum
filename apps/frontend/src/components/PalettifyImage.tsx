import { useState, useEffect, useRef } from "react";
import { Palette, ImagePlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processImage, APIError } from "@/services/api";
import type { Color, Palette as PaletteType } from "@/lib/palettes";
import ImageViewer from "@/components/ImageViewer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BORDER_THICKNESS = 5; // In pixels, can be adjusted as needed
const HORIZONTAL_PIXELS = 40; // Number of segments in horizontal borders
const VERTICAL_PIXELS = 30; // Number of segments in vertical borders

interface PalettifyImageProps {
  file: File | null;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  palette: PaletteType;
  transparentThreshold: number;
}

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

interface ProcessedSettings {
  fileName: string | null;
  width: number | null;
  height: number | null;
  paletteId: string | null;
  colorFingerprint: string | null;
  transparentThreshold: number | null;
}

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

function PalettifyImage({
  file,
  dimensions,
  palette,
  transparentThreshold,
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
    colorFingerprint: null,
    transparentThreshold: null,
  });

  const currentColorFingerprint = palette?.colors
    ? JSON.stringify(
      [...palette.colors].sort((a, b) =>
        a.r !== b.r ? a.r - b.r : a.g !== b.g ? a.g - b.g : a.b - b.b,
      ),
    )
    : null;

  const isSameSettings: boolean =
    !!processedImageUrl &&
    file?.name === lastProcessedSettings.current.fileName &&
    dimensions.width === lastProcessedSettings.current.width &&
    dimensions.height === lastProcessedSettings.current.height &&
    currentColorFingerprint ===
    lastProcessedSettings.current.colorFingerprint &&
    transparentThreshold === lastProcessedSettings.current.transparentThreshold;

  useEffect(() => {
    if (file && currentProcessedFile !== file.name) {
      if (processedImageUrl) {
        URL.revokeObjectURL(processedImageUrl);
      }
      setProcessedImageUrl(null);
      setCurrentProcessedFile(null);
    }
  }, [file, currentProcessedFile, processedImageUrl]);

  useEffect(() => {
    return () => {
      if (processedImageUrl) {
        URL.revokeObjectURL(processedImageUrl);
      }
    };
  }, [processedImageUrl]);

  useEffect(() => {
    const updateContainerDimensions = (): void => {
      if (imageContainerRef.current) {
        const container = imageContainerRef.current;
        const rect = container.getBoundingClientRect();

        setContainerDimensions({
          containerWidth: rect.width,
          containerHeight: rect.height,
        });
      }
    };

    window.addEventListener("resize", updateContainerDimensions);

    if (processedImageUrl) {
      updateContainerDimensions();
    }

    return () => {
      window.removeEventListener("resize", updateContainerDimensions);
    };
  }, [processedImageUrl]);

  const handleProcessImage = async (): Promise<void> => {
    if (!file) {
      setError("Select an image to process");
      return;
    }

    if (palette.colors.length === 0) {
      setError("Choose a color palette");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const processedBlob = await processImage(
        file,
        palette.colors,
        dimensions.width || undefined,
        dimensions.height || undefined,
        transparentThreshold,
      );

      const newProcessedUrl = URL.createObjectURL(processedBlob);
      setProcessedImageUrl(newProcessedUrl);
      setCurrentProcessedFile(file.name);

      processedPaletteRef.current = { ...palette };
      lastProcessedSettings.current = {
        fileName: file.name,
        width: dimensions.width,
        height: dimensions.height,
        paletteId: palette.id,
        colorFingerprint: currentColorFingerprint,
        transparentThreshold: transparentThreshold,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Image processing failed";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (): void => {
    if (!processedImageUrl || !file || !currentProcessedFile) return;

    try {
      if (file.name !== currentProcessedFile) {
        setError("Please process the current image before downloading");
        return;
      }

      const link = document.createElement("a");
      link.href = processedImageUrl;

      const originalExtension = file.name.split(".").pop()?.toLowerCase() || "";
      const baseFileName = file.name.replace(/\.[^/.]+$/, "");
      const outputExtension = originalExtension === "gif" ? "gif" : "png";
      const paletteName = palette.name.toLowerCase().replace(/\s+/g, "-");

      link.download = `${paletteName}-${baseFileName}.${outputExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error(
        "Download error:",
        err instanceof Error ? err.message : String(err),
      );
      setError("Failed to download image");
    }
  };

  const handleViewFullSize = (): void => {
    setIsPreviewOpen(true);
  };

  const getProcessedColors = (): Color[] => {
    return processedPaletteRef.current?.colors || [];
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isSameSettings ? (
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={handleProcessImage}
                    disabled={true}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Palette className="mr-2 h-4 w-4" />
                    Palettify Image
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Image already palettified with current configuration</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button
            onClick={handleProcessImage}
            disabled={!file || palette.colors.length === 0 || isProcessing}
            className="bg-primary hover:bg-primary-hover text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              "Processing..."
            ) : (
              <>
                <Palette className="mr-2 h-4 w-4" />
                Palettify Image
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2">
          <ImagePlus className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {processedImageUrl && (
        <div className="mt-4 space-y-2">
          <div
            className="rounded-md overflow-hidden relative border border-border shadow-sm"
            ref={imageContainerRef}
          >
            <div
              className="relative group cursor-pointer"
              onClick={handleViewFullSize}
            >
              <img
                src={processedImageUrl}
                alt="Palettified"
                className="w-full object-contain max-h-96 [image-rendering:-webkit-optimize-contrast] [image-rendering:crisp-edges] [image-rendering:pixelated]"
                onLoad={() => {
                  if (imageContainerRef.current) {
                    const container = imageContainerRef.current;
                    const rect = container.getBoundingClientRect();

                    setContainerDimensions({
                      containerWidth: rect.width,
                      containerHeight: rect.height,
                    });
                  }
                }}
              />

              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300"></div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-foreground/10 backdrop-blur-[1px] px-4 py-2 rounded-md flex items-center gap-2 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-300">
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
                  <span className="text-sm font-medium text-white drop-shadow-sm">
                    View Full Size
                  </span>
                </div>
              </div>

              {processedImageUrl &&
                getProcessedColors().length > 0 &&
                containerDimensions && (
                  <PixelBorders
                    key={processedImageUrl}
                    colors={getProcessedColors()}
                    dimensions={containerDimensions}
                  />
                )}

              <div className="absolute bottom-3 right-3 opacity-60 group-hover:opacity-90 transition-opacity duration-300 p-1 z-1">
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

          <div className="flex justify-start">
            <Button
              onClick={handleDownload}
              className="bg-primary hover:bg-primary-hover text-primary-foreground transition-colors flex items-center space-x-2"
              size="sm"
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
@keyframes pixelFadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2);
  }
  to {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
  }
}
.animate-pixel-fade-in {
  animation: pixelFadeIn 0.4s ease-out forwards;
}

@keyframes pixelExtend {
  from {
    transform: scaleX(0);
    opacity: 0;
    transform-origin: left;
  }
  to {
    transform: scaleX(1) scaleY(1.05);
    opacity: 1;
  }
}
.animate-pixel-extend {
  animation: pixelExtend 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  transform-origin: left;
}

@keyframes pixelPulse {
  from, to {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}
.animate-pixel-pulse {
  animation: pixelPulse 1.2s ease-in-out infinite;
  transform-origin: center;
}
        `,
        }}
      />
    </div>
  );
}

export default PalettifyImage;
