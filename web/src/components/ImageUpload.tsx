import { useState, useCallback, useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/palettes";
import SharedImagePreview from "./SharedImagePreview";
import { X } from "lucide-react";

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  const validateFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        onFileSelect(null);
        setError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return true;
      }

      if (!validTypes.includes(file.type)) {
        setShake(true);
        setError(`Invalid file type. Please upload a ${validTypesString}.`);
        setTimeout(() => setShake(false), 300);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return false;
      }

      if (file.size > LIMITS.MAX_FILE_SIZE) {
        setShake(true);
        setError(
          `File size exceeds ${LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB. Please upload a smaller image.`,
        );
        setTimeout(() => setShake(false), 300);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
          if (fileInputRef.current) fileInputRef.current.value = "";
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      img.src = url;
      return true;
    },
    [onFileSelect, validTypesString],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      validateFile(file || null);
    },
    [validateFile],
  );

  const handleRemoveImage = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      validateFile(null);
    },
    [validateFile],
  );

  const handleDragEvents = useCallback(
    (event: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedFile) return;
      setIsDragging(isEntering);
    },
    [selectedFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedFile) return;

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
    [validateFile, selectedFile],
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
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
      if (selectedFile) return;

      const activeElement = document.activeElement;
      const isInputActive =
        (activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute("contenteditable") === "true") &&
        !uploadAreaRef.current?.contains(activeElement);

      if (isInputActive) return;

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
              if (validateFile(file)) event.preventDefault();
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
    [validateFile, isActive, validTypesString, selectedFile],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className="space-y-2">
      {previewUrl && selectedFile ? (
        <div className="space-y-2">
          <SharedImagePreview
            imageUrl={previewUrl}
            altText={selectedFile.name}
            onRemove={handleRemoveImage}
            showRemoveButton={true}
            enableViewFullSize={true}
            className="w-full h-64 sm:h-80 rounded-lg border border-border"
            imageClassName="object-contain"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <p className="text-sm text-foreground-secondary truncate">
                {selectedFile.name}
              </p>
              <button
                type="button"
                onClick={handleRemoveImage}
                aria-label="Remove image"
                className={cn(
                  "ml-1 rounded-full p-1",
                  "text-icon-inactive hover:text-icon-active focus:text-icon-active",
                  "focus:outline-none transition-colors",
                )}
                tabIndex={0}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Button onClick={triggerFileInput} variant="outline" size="sm">
              Change
            </Button>
          </div>
        </div>
      ) : (
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
            isActive && !isDragging && "ring-2 ring-primary ring-offset-2",
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
          tabIndex={0}
          role="button"
          aria-label="Image upload area"
        >
          <ImageIcon
            className={cn(
              "w-16 h-16 mb-4 pointer-events-none",
              "transition-all duration-300",
              isDragging
                ? "icon-active scale-110 text-primary"
                : "text-foreground-secondary",
            )}
            aria-hidden="true"
          />
          <div
            className={`flex flex-col items-center transition-all duration-200 pointer-events-none ${isDragging ? "opacity-50" : ""}`}
          >
            <div className="hidden sm:flex items-center gap-3 mb-3">
              <p className="text-sm text-foreground-secondary">Drag</p>
              <div className="h-px w-10 bg-border"></div>
              <p className="text-sm text-foreground-secondary">Paste</p>
            </div>
            <div className="hidden sm:flex items-center gap-3 mb-3">
              <div className="h-px w-16 bg-border"></div>
              <p className="text-sm text-foreground-secondary">or</p>
              <div className="h-px w-16 bg-border"></div>
            </div>
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
              type="button"
            >
              Choose image
            </Button>
          </div>
        </div>
      )}
      <input
        type="file"
        id="file-upload"
        ref={fileInputRef}
        className="sr-only"
        accept={validTypes.join(",")}
        onChange={handleFileChange}
        tabIndex={-1}
      />
      {error && (
        <Alert variant="destructive" role="alert" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default ImageUpload;
