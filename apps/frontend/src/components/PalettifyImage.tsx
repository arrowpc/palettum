import React, { useState, useEffect } from "react";
import { Palette, ImagePlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processImage, APIError } from "@/services/api";
import type { PaletteColor } from "@/services/api";

interface PalettifyImageProps {
  file: File | null;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  palette: PaletteColor[];
}

function PalettifyImage({ file, dimensions, palette }: PalettifyImageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null,
  );

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

    if (palette.length === 0) {
      setError("Choose a color palette");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const processedBlob = await processImage(
        file,
        palette,
        dimensions.width || undefined,
        dimensions.height || undefined,
      );

      const newProcessedUrl = URL.createObjectURL(processedBlob);
      setProcessedImageUrl(newProcessedUrl);
    } catch (err: any) {
      const errorMessage =
        err instanceof APIError ? err.message : "Image processing failed";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImageUrl || !file) return;

    const link = document.createElement("a");
    link.href = processedImageUrl;

    const baseFileName = file.name.replace(/\.[^/.]+$/, "");
    link.download = `palettified-${baseFileName}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleProcessImage}
          disabled={!file || palette.length === 0 || isProcessing}
          className="flex items-center space-x-2"
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
      </div>

      {error && (
        <div className="text-red-500 text-sm flex items-center space-x-2">
          <ImagePlus className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {processedImageUrl && (
        <div className="mt-4 space-y-2">
          <div className="border rounded-lg overflow-hidden shadow-sm">
            <img
              src={processedImageUrl}
              alt="Palettified"
              className="w-full object-contain max-h-[400px]"
            />
          </div>
          <div className="flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center space-x-1"
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
