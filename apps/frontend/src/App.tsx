import { useState, useCallback, useEffect } from "react";
import ImageUpload from "./components/ImageUpload";
import ImageDimensions from "./components/ImageDimensions";
import PaletteManager from "./components/PaletteManager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { processImage, APIError, PaletteColor } from "./services/api";

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({
    width: null as number | null,
    height: null as number | null,
  });
  const [selectedPalette, setSelectedPalette] = useState<PaletteColor[]>([]);
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

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadedFile(file);
    setProcessedImageUrl(null);
    setError(null);
  }, []);

  const handleDimensionsChange = useCallback(
    (width: number | null, height: number | null) => {
      setDimensions({ width, height });
    },
    [],
  );

  const handlePaletteSelect = useCallback((colors: PaletteColor[]) => {
    setSelectedPalette(colors);
  }, []);

  const handleProcess = async () => {
    if (!uploadedFile || selectedPalette.length === 0) {
      setError("Please select both an image and a palette");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProcessedImageUrl(null);

    try {
      const processedBlob = await processImage(
        uploadedFile,
        selectedPalette,
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
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <ImageUpload onFileSelect={handleFileSelect} />
      <ImageDimensions file={uploadedFile} onChange={handleDimensionsChange} />
      <PaletteManager onPaletteSelect={handlePaletteSelect} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleProcess}
          disabled={
            !uploadedFile || selectedPalette.length === 0 || isProcessing
          }
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

export default App;
