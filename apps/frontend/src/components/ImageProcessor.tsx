import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { processImage, APIError } from "@/services/api";
import type { PaletteColor } from "@/services/api";

interface ImageProcessorProps {
  file: File | null;
  dimensions: {
    width: number | null;
    height: number | null;
  };
  palette: PaletteColor[];
}

function ImageProcessor({ file, dimensions, palette }: ImageProcessorProps) {
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

  const handleProcess = async () => {
    if (!file) {
      setError("Please select an image");
      return;
    }

    if (!palette || palette.length === 0) {
      setError("Please select a palette");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProcessedImageUrl(null);

    try {
      const processedBlob = await processImage(
        file,
        palette,
        dimensions.width || undefined,
        dimensions.height || undefined,
      );
      setProcessedImageUrl(URL.createObjectURL(processedBlob));
    } catch (err) {
      setError(
        err instanceof APIError ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleProcess}
          disabled={!file || !palette || palette.length === 0 || isProcessing}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
            transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Processing..." : "Process Image"}
        </button>
      </div>
      {processedImageUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Processed Image</h3>
          <img
            src={processedImageUrl}
            alt="Processed"
            className="w-full rounded-lg shadow-lg"
          />
          <div className="mt-2 flex justify-end">
            <a
              href={processedImageUrl}
              download="processed-image"
              className="text-blue-500 hover:text-blue-600"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageProcessor;
