import { useState } from "react";
import ImageUpload from "./components/ImageUpload";
import ImageDimensions from "./components/ImageDimensions";
import PaletteManager from "./components/PaletteManager";

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <ImageUpload onFileSelect={setUploadedFile} />
      <ImageDimensions file={uploadedFile} />
      <PaletteManager />
    </div>
  );
}

export default App;
