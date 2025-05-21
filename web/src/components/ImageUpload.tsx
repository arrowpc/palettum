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

  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/x-icon",
  ];

  const validTypesString = validTypes
    .map((type) => type.split("/")[1].toUpperCase())
    .join(", ");

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
        setError(`Invalid file type. Please upload a ${validTypesString}.`);
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
    [onFileSelect, validTypesString],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      validateFile(file || null);
      event.target.value = "";
    },
    [validateFile],
  );

  const handleDragEvents = useCallback(
    (event: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(isEntering);
    },
    [],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
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

  const triggerFileInput = useCallback(() => {
    document.getElementById("file-upload")?.click();
  }, []);

  const handleButtonClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      triggerFileInput();
    },
    [triggerFileInput],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const activeElement = document.activeElement;

      const isInputActive =
        (activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute("contenteditable") === "true") &&
        !uploadAreaRef.current?.contains(activeElement);

      if (isInputActive) {
        return;
      }

      const isPasteTarget =
        uploadAreaRef.current?.contains(activeElement) ||
        activeElement === document.body ||
        activeElement?.id === "root" ||
        activeElement?.tagName === "MAIN" ||
        activeElement?.tagName === "DIV" ||
        isActive;

      if (isPasteTarget) {
        const items = event.clipboardData?.items;
        if (!items) return;

        let imageFound = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            const file = items[i].getAsFile();
            if (file && validTypes.includes(file.type)) {
              validateFile(file);
              event.preventDefault();
              imageFound = true;
              break;
            } else if (file) {
              setShake(true);
              setError(
                `Invalid file type pasted. Please use ${validTypesString}.`,
              );
              setTimeout(() => setShake(false), 300);
              event.preventDefault();
              imageFound = true;
              break;
            }
          }
        }

        if (
          !imageFound &&
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
    [validateFile, isActive, validTypesString],
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
          "p-4 text-center",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-background-secondary cursor-pointer hover:border-primary/50",
          shake && "animate-shake",
        )}
        onDragEnter={(e) => handleDragEvents(e, true)}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerFileInput();
          }
        }}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        tabIndex={0}
        role="button"
        aria-label="Image upload area"
      >
        <ImageIcon
          className={cn(
            "w-16 h-16 mb-4 pointer-events-none",
            "transition-all duration-300",
            isDragging ? "icon-active scale-110" : "text-foreground-secondary",
          )}
          aria-hidden="true"
        />
        <div
          className={`flex flex-col items-center transition-all duration-200 pointer-events-none ${isDragging ? "opacity-50" : ""}`}
        >
          {/* Drag and Paste text, hidden on mobile */}
          <div className="hidden sm:flex items-center gap-3 mb-3">
            <p className="text-sm text-foreground-secondary">Drag</p>
            <div className="h-px w-10 bg-border"></div>
            <p className="text-sm text-foreground-secondary">Paste</p>
          </div>

          {/* "or" section, shown only on desktop */}
          <div className="hidden sm:flex items-center gap-3 mb-3">
            <div className="h-px w-16 bg-border"></div>
            <p className="text-sm text-foreground-secondary">or</p>
            <div className="h-px w-16 bg-border"></div>
          </div>

          <input
            type="file"
            id="file-upload"
            className="sr-only"
            accept={validTypes.join(",")}
            onChange={handleFileChange}
            tabIndex={-1}
          />

          <Button
            onClick={handleButtonClick}
            disabled={isDragging}
            className={cn(
              "bg-primary hover:bg-primary-hover text-primary-foreground",
              "transition-all duration-200",
              "px-6 py-3 text-base pointer-events-auto",
              isDragging && "opacity-50 cursor-not-allowed",
            )}
            aria-label="Choose image from device"
          >
            Choose image
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
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
