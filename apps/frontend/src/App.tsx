import { useState, useCallback } from "react";
import ImageUpload from "@/components/ImageUpload";
import ImageDimensions from "@/components/ImageDimensions";
import PaletteManager from "@/components/PaletteManager";
import PalettifyImage from "@/components/PalettifyImage";
import type { PaletteColor } from "@/services/api";

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({
    width: null as number | null,
    height: null as number | null,
  });
  const [selectedPalette, setSelectedPalette] = useState<PaletteColor[]>([]);

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadedFile(file);
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

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <ImageUpload onFileSelect={handleFileSelect} />
      <ImageDimensions file={uploadedFile} onChange={handleDimensionsChange} />
      <PaletteManager onPaletteSelect={handlePaletteSelect} />
      <PalettifyImage
        file={uploadedFile}
        dimensions={dimensions}
        palette={selectedPalette}
      />
    </div>
  );
}

export default App;
