import { useState, useCallback } from "react";
import { Image } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validTypes = ["image/jpeg", "image/png", "image/gif"];
  const maxFileSize = 100 * 1024 * 1024;

  const validateFile = useCallback((file: File | null) => {
    if (!file) return false;

    if (!validTypes.includes(file.type)) {
      setShake(true);
      setError("Invalid file type. Please upload a JPEG, PNG, or GIF.");
      setTimeout(() => setShake(false), 300);
      return false;
    }

    if (file.size > maxFileSize) {
      setShake(true);
      setError(`File size exceeds 100 MB. Please upload a smaller image.`);
      setTimeout(() => setShake(false), 300);
      return false;
    }

    setError(null);
    return true;
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect],
  );

  const handleDragEvents = useCallback(
    (event: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
      event.preventDefault();
      setIsDragging(isEntering);
    },
    [],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const files = event.dataTransfer.files;
      if (files.length > 1) {
        setShake(true);
        setError("Please drag and drop only one image.");
        setTimeout(() => setShake(false), 300);
        return;
      }

      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect],
  );

  return (
    <div className="space-y-2">
      <div
        className={`mt-2 flex flex-col items-center justify-center w-full h-64 border-2 rounded-lg border-dashed transition-all duration-300 ease-in-out 
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}
          ${shake ? "animate-shake" : ""}`}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDrop={handleDrop}
      >
        <Image
          className={`w-16 h-16 mb-4 transition-all duration-300 ease-in-out
          ${isDragging ? "text-blue-500 scale-110" : "text-gray-500"}`}
        />
        <p className="mb-4 text-sm text-gray-500">
          Drag and drop an image to palettify
        </p>
        <p className="mb-2 text-sm text-gray-500">or</p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={validTypes.join(",")}
          onChange={handleFileChange}
        />
        <button
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isDragging}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-all duration-300 ease-in-out 
            ${isDragging
              ? "bg-neutral-400 cursor-not-allowed scale-90"
              : "bg-neutral-600 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
            }`}
        >
          Browse images
        </button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {selectedFile && (
        <p className="text-sm text-gray-500">
          Selected file: {selectedFile.name}
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
