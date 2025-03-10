import { useState, useCallback, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 7680;

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedImage, setSelectedFile] = useState<File | null>(null);
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

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;

      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            validateFile(file);
            return;
          }
        }
      }

      if (items.length > 0 && event.clipboardData?.getData("text")) {
        setShake(true);
        setError(
          "No valid image found in clipboard. Try copying an image instead of text.",
        );
        setTimeout(() => setShake(false), 300);
      }
    },
    [validateFile],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

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
        tabIndex={0}
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
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-sm text-upload-400">Drag</p>
            <div className="h-px w-10 bg-neutral-600/30"></div>
            <p className="text-sm text-upload-400">Paste</p>
          </div>

          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={validTypes.join(",")}
            onChange={handleFileChange}
          />

          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-16 bg-neutral-600/30"></div>
            <p className="text-sm text-upload-400">or</p>
            <div className="h-px w-16 bg-neutral-600/30"></div>
          </div>

          <Button
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={isDragging}
            className={cn(
              "bg-neutral-600 hover:bg-neutral-700 text-white",
              "transition-all duration-200",
              isDragging && "opacity-50 cursor-not-allowed",
            )}
          >
            Choose image
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {selectedImage && !error && (
        <p className="text-sm text-upload-400">
          Selected image: {selectedImage.name}
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
