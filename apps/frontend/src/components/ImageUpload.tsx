import { useState, useCallback } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 7680;

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validTypes = ["image/jpeg", "image/png", "image/gif"];
  const maxFileSize = 100 * 1024 * 1024; // 100MB

  const validateFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        onFileSelect(null);
        setError(null);
        return;
      }

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

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          setShake(true);
          setError(
            `Image dimensions cannot exceed ${MAX_DIMENSION}px. Please upload a smaller image.`,
          );
          setTimeout(() => setShake(false), 300);
          setSelectedFile(null);
          onFileSelect(null);
          return;
        }

        setError(null);
        setSelectedFile(file);
        onFileSelect(file);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        setShake(true);
        setError("Failed to load image. Please try another file.");
        setTimeout(() => setShake(false), 300);
        setSelectedFile(null);
        onFileSelect(null);
      };

      img.src = url;
    },
    [onFileSelect],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      validateFile(file || null);
    },
    [validateFile],
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

      validateFile(files[0] || null);
    },
    [validateFile],
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-col items-center justify-center w-full h-64",
          "border-2 border-dashed rounded-lg",
          "transition-all duration-300",
          isDragging
            ? "border-upload-active-border bg-upload-active-bg"
            : "border-upload-300 bg-upload-50",
          shake && "animate-shake",
        )}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDrop={handleDrop}
      >
        <ImageIcon
          className={cn(
            "w-16 h-16 mb-4",
            "transition-all duration-300",
            isDragging
              ? "text-upload-active-text scale-110"
              : "text-upload-400",
          )}
        />
        <p className="mb-4 text-sm text-upload-400">
          Drag and drop an image to palettify
        </p>
        <p className="mb-2 text-sm text-upload-400">or</p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={validTypes.join(",")}
          onChange={handleFileChange}
        />
        <Button
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isDragging}
          className={cn(
            "bg-neutral-600 hover:bg-neutral-700 text-white",
            "transition-all duration-300",
            isDragging && "opacity-50 scale-95 cursor-not-allowed",
          )}
        >
          Browse images
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {selectedFile && !error && (
        <p className="text-sm text-upload-400">
          Selected file: {selectedFile.name}
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
