import { useState } from "react";
import ImageUpload from "./components/ImageUpload.tsx";
import ImageDimensions from "./components/ImageDimensions.tsx";

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  return (
    <div className="max-w-xl mx-auto p-6">
      <ImageUpload onFileSelect={setUploadedFile} />
      <ImageDimensions file={uploadedFile} />
    </div>
  );
}

export default App;
