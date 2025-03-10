import { useState, useEffect, useRef } from "react";
import { Palette, ImagePlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processImage, APIError } from "@/services/api";
import type { Palette as PaletteType } from "@/lib/palettes";
import ImageViewer from "@/components/ImageViewer";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PalettifyImageProps {
  file: File | null;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  palette: PaletteType;
  transparentThreshold: number;
}

function PalettifyImage({
  file,
  dimensions,
  palette,
  transparentThreshold,
}: PalettifyImageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentProcessedFile, setCurrentProcessedFile] = useState<
    string | null
  >(null);

  const lastProcessedSettings = useRef<{
    fileName: string | null;
    width: number | null;
    height: number | null;
    paletteId: string | null;
    transparentThreshold: number | null;
  }>({
    fileName: null,
    width: null,
    height: null,
    paletteId: null,
    transparentThreshold: null,
  });

  const isSameSettings =
    !!processedImageUrl &&
    file?.name === lastProcessedSettings.current.fileName &&
    dimensions.width === lastProcessedSettings.current.width &&
    dimensions.height === lastProcessedSettings.current.height &&
    palette.id === lastProcessedSettings.current.paletteId &&
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

  const handleProcessImage = async () => {
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

      lastProcessedSettings.current = {
        fileName: file.name,
        width: dimensions.width,
        height: dimensions.height,
        paletteId: palette.id,
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

  const handleDownload = () => {
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
                    className={cn(
                      "bg-neutral-600 hover:bg-neutral-700 text-white",
                      "transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
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
            className={cn(
              "bg-neutral-600 hover:bg-neutral-700 text-white",
              "transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isProcessing ? (
              <>Processing...</>
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
            className="rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setIsPreviewOpen(true)}
          >
            <img
              src={processedImageUrl}
              alt="Palettified"
              className={cn(
                "w-full object-contain max-h-96",
                "[image-rendering:-webkit-optimize-contrast]",
                "[image-rendering:crisp-edges]",
                "[image-rendering:pixelated]",
                "transition-transform duration-150",
                "hover:scale-105",
              )}
            />
          </div>

          <div className="flex justify-start">
            <Button
              onClick={handleDownload}
              className={cn(
                "bg-neutral-600 hover:bg-neutral-700 text-white",
                "transition-colors",
                "flex items-center space-x-1",
              )}
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
    </div>
  );
}

export default PalettifyImage;
