import { ENV } from "@/config/env";
import { useState, useCallback, useEffect } from "react";
import ImageUpload from "@/components/ImageUpload";
import ImageDimensions from "@/components/ImageDimensions";
import PaletteManager from "@/components/PaletteManager";
import PalettifyImage from "@/components/PalettifyImage";
import DarkModeToggle from "@/components/DarkModeToggle";
import GitHubButton from "@/components/GitHubButton";
import type { Palette } from "@/lib/palettes/types";
import ImageTransparency from "@/components/ImageTransparency";
import Footer from "@/components/Footer";

if (import.meta.env.MODE === "development") {
  import("react-scan").then(({ scan }) => {
    scan({
      enabled: false,
    });
  });
}

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({
    width: null as number | null,
    height: null as number | null,
  });
  const [selectedPalette, setSelectedPalette] = useState<Palette>();
  const [transparentThreshold, setTransparentThreshold] = useState<number>(0);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [isCheckingApi, setIsCheckingApi] = useState<boolean>(true);

  const apiUrl = ENV.API_URL;

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        setIsCheckingApi(true);
        const response = await fetch(`${apiUrl}/health`);
        setApiAvailable(response.ok);
      } catch (error) {
        console.error("API health check failed:", error);
        setApiAvailable(false);
      } finally {
        setIsCheckingApi(false);
      }
    };

    checkApiHealth();
  }, []);

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadedFile(file);
  }, []);

  const handleDimensionsChange = useCallback(
    (width: number | null, height: number | null) => {
      setDimensions({ width, height });
    },
    [],
  );

  const handleThresholdChange = useCallback((newThreshold: number) => {
    setTransparentThreshold(newThreshold);
  }, []);

  const handlePaletteSelect = useCallback((palette: Palette) => {
    setSelectedPalette(palette);
  }, []);

  if (isCheckingApi) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Connecting to API...</p>
        </div>
      </div>
    );
  }

  if (apiAvailable === false) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 max-w-md bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-red-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
            API Connection Error
          </h2>
          <p className="mb-4">
            Unable to connect to the API service. Please check if the server is
            running.
          </p>
          <button
            onClick={() => {
              setIsCheckingApi(true);
              setApiAvailable(null);
              fetch("/api/health")
                .then((response) => setApiAvailable(response.ok))
                .catch(() => setApiAvailable(false))
                .finally(() => setIsCheckingApi(false));
            }}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-md transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6 min-h-screen flex flex-col">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Palettum</h1>
      </header>

      <div className="flex items-center justify-between">
        <GitHubButton />
        <p className="text-foreground-muted text-sm text-center flex-1 mx-4">
          Match every pixel in your image or GIF to a custom palette. Upload,
          choose a palette, tweak settings, and download!
        </p>
        <DarkModeToggle />
      </div>

      <div className="flex-1 space-y-6">
        <ImageUpload onFileSelect={handleFileSelect} />
        <ImageDimensions
          file={uploadedFile}
          onChange={handleDimensionsChange}
        />
        <ImageTransparency
          file={uploadedFile}
          transThreshold={handleThresholdChange}
        />
        <PaletteManager onPaletteSelect={handlePaletteSelect} />
        <PalettifyImage
          file={uploadedFile}
          dimensions={dimensions}
          transparentThreshold={transparentThreshold}
          palette={selectedPalette!}
        />
      </div>
      <Footer />
    </div>
  );
}

export default App;
