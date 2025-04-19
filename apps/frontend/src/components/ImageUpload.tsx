import { useState, useCallback, useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/palettes";

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedImage, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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

      if (file.size > LIMITS.MAX_FILE_SIZE) {
        setShake(true);
        setError(
          `File size exceeds ${LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB. Please upload a smaller image.`,
        );
        setTimeout(() => setShake(false), 300);
        return false;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        if (
          img.width > LIMITS.MAX_DIMENSION ||
          img.height > LIMITS.MAX_DIMENSION
        ) {
          setShake(true);
          setError(
            `Image dimensions cannot exceed ${LIMITS.MAX_DIMENSION}px. Please upload a smaller image.`,
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
      const activeElement = document.activeElement;

      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true";

      const isBackgroundActive =
        activeElement === document.body ||
        activeElement?.id === "root" ||
        activeElement?.tagName === "MAIN" ||
        activeElement?.tagName === "DIV" ||
        isActive;

      if (isInputActive && !isActive) {
        return;
      }

      if (isBackgroundActive) {
        const items = event.clipboardData?.items;

        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              validateFile(file);
              event.preventDefault();
              return;
            }
          }
        }

        if (
          isActive &&
          items.length > 0 &&
          event.clipboardData?.getData("text")
        ) {
          setShake(true);
          setError(
            "No valid image found in clipboard. Try copying an image instead of text.",
          );
          setTimeout(() => setShake(false), 300);
        }
      }
    },
    [validateFile, isActive],
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
        ref={uploadAreaRef}
        className={cn(
          "flex flex-col items-center justify-center w-full h-64 sm:h-80",
          "border-2 border-dashed rounded-lg",
          "transition-all duration-300",
          "p-4",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-background-secondary",
          shake && "animate-shake",
        )}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDrop={handleDrop}
        onClick={() =>
          !isDragging && document.getElementById("file-upload")?.click()
        }
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        tabIndex={0}
      >
        <ImageIcon
          className={cn(
            "w-16 h-16 mb-4",
            "transition-all duration-300",
            isDragging ? "icon-active scale-110" : "text-foreground-secondary",
          )}
        />
        <div
          className={`flex flex-col items-center transition-all duration-200 ${isDragging ? "opacity-50" : ""}`}
        >
          {/* Drag and Paste text, hidden on mobile */}
          <div className="hidden sm:flex items-center gap-3 mb-3">
            <p className="text-sm text-foreground-secondary">Drag</p>
            <div className="h-px w-10 bg-border"></div>
            <p className="text-sm text-foreground-secondary">Paste</p>
          </div>

          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={validTypes.join(",")}
            capture="environment"
            onChange={handleFileChange}
          />

          {/* "or" section, shown only on desktop */}
          <div className="hidden sm:flex items-center gap-3 mb-3">
            <div className="h-px w-16 bg-border"></div>
            <p className="text-sm text-foreground-secondary">or</p>
            <div className="h-px w-16 bg-border"></div>
          </div>

          <Button
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={isDragging}
            className={cn(
              "bg-primary hover:bg-primary-hover text-primary-foreground",
              "transition-all duration-200",
              "px-6 py-3 text-base",
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
        <p className="text-sm text-foreground-secondary">
          Selected image: {selectedImage.name}
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
