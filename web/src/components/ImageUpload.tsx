import {
  useState,
  useCallback,
  useEffect,
  useRef,
  MouseEvent as ReactMouseEvent,
  DragEvent as ReactDragEvent,
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/palettes";
import CanvasPreview from "./CanvasPreview";
import CanvasViewer from "./CanvasViewer";
import { ImageFilter } from "palettum";
import { useShader } from "@/ShaderContext";
import {
  convertGifToVideo,
  processImage,
  processVideo,
} from "@/lib/mediaProcessor";

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing...");
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { shader, setShader } = useShader();
  const mediaCleanupRef = useRef<(() => void) | null>(null);

  const handleCanvasReady = useCallback(
    (canvas: HTMLCanvasElement) => {
      setShader((prev) => ({ ...prev, canvas }));
    },
    [setShader],
  );

  const validImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/x-icon",
  ];
  const validVideoTypes = ["video/mp4", "video/webm", "video/ogg"];
  const validTypes = [...validImageTypes, "image/gif", ...validVideoTypes];

  const validTypesString = validTypes
    .map((type) => {
      const [_cat, subType] = type.split("/");
      return subType.toUpperCase();
    })
    .filter((value, index, self) => self.indexOf(value) === index)
    .join(", ");

  useEffect(() => {
    let isMounted = true;

    if (shader.canvas && !shader.filter) {
      setLoadingMessage("Initializing renderer...");
      const initFilter = async () => {
        try {
          const filter = await new ImageFilter(shader.canvas!);
          if (isMounted) {
            setShader((prev) => ({
              ...prev,
              filter,
            }));
          }
        } catch (err) {
          console.error("Failed to initialize WebAssembly renderer:", err);
          if (isMounted) {
            setError(
              "Failed to initialize the graphics renderer. Please try refreshing the page.",
            );
          }
        }
      };
      initFilter();
    }

    return () => {
      isMounted = false;
    };
  }, [shader.canvas, setShader, setError, shader.filter]);

  useEffect(() => {
    if (shader.canvas && shader.filter && shader.sourceDimensions) {
      const { width, height } = shader.sourceDimensions;
      shader.canvas.width = width;
      shader.canvas.height = height;
      shader.filter.resize_canvas(width, height);
    }
  }, [shader.canvas, shader.filter, shader.sourceDimensions]);

  const cleanupPreviousMedia = useCallback(async () => {
    setIsLoadingMedia(false);
    if (mediaCleanupRef.current) {
      mediaCleanupRef.current();
      mediaCleanupRef.current = null;
    }
    setShader((prev) => ({
      ...prev,
      sourceMediaType: null,
      sourceDimensions: undefined,
    }));
  }, [setShader]);

  const validateFile = useCallback(
    async (file: File | null) => {
      await cleanupPreviousMedia();

      if (!file) {
        setSelectedFile(null);
        onFileSelect(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (!shader.filter) {
        setError("Renderer is not ready yet, please wait a moment.");
        return;
      }

      setIsLoadingMedia(true);
      setLoadingMessage("Processing...");

      if (!validTypes.includes(file.type)) {
        setShake(true);
        setError(`Invalid file type. Please upload a ${validTypesString}.`);
        setTimeout(() => setShake(false), 300);
        setIsLoadingMedia(false);
        return;
      }

      if (file.size > LIMITS.MAX_FILE_SIZE) {
        setShake(true);
        setError(`File size exceeds ${LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB.`);
        setTimeout(() => setShake(false), 300);
        setIsLoadingMedia(false);
        return;
      }

      try {
        let result;

        if (file.type === "image/gif") {
          setLoadingMessage("Preparing to convert GIF...");
          const videoBlob = await convertGifToVideo(
            file,
            (progress) =>
              setLoadingMessage(
                `Converting... ${(progress * 100).toFixed(0)}%`,
              ),
            (status) => setLoadingMessage(status),
          );
          result = await processVideo(videoBlob, shader.filter!);
        } else if (file.type.split("/")[0] === "image") {
          result = await processImage(file, shader.filter!);
        } else if (file.type.split("/")[0] === "video") {
          result = await processVideo(file, shader.filter!);
        } else {
          throw new Error(`Unsupported file type: ${file.type}`);
        }

        mediaCleanupRef.current = result.cleanup;
        setShader((prev) => ({
          ...prev,
          sourceMediaType: result.sourceMediaType,
          sourceDimensions: result.sourceDimensions,
        }));
        result.play();

        setSelectedFile(file);
        onFileSelect(file);
        setError(null);
      } catch (err) {
      } finally {
        setIsLoadingMedia(false);
      }
    },
    [
      cleanupPreviousMedia,
      onFileSelect,
      setShader,
      shader.filter,
      validTypes,
      validTypesString,
    ],
  );
  const handleFileChange = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      await validateFile(file || null);
    },
    [validateFile],
  );

  const handleRemoveImage = useCallback(
    async (e?: ReactMouseEvent) => {
      e?.stopPropagation();
      await cleanupPreviousMedia();
      setSelectedFile(null);
      onFileSelect(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [cleanupPreviousMedia, onFileSelect],
  );

  const handleDragEvents = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, isEntering: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedFile || isLoadingMedia || !shader.filter) return;
      setIsDragging(isEntering);
    },
    [selectedFile, isLoadingMedia, shader.filter],
  );

  const handleDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedFile || isLoadingMedia || !shader.filter) return;
      setIsDragging(false);
      const files = event.dataTransfer.files;
      if (files.length > 1) {
        setShake(true);
        setError("Please drag and drop only one file.");
        setTimeout(() => setShake(false), 300);
        return;
      }
      await validateFile(files[0] || null);
    },
    [validateFile, selectedFile, isLoadingMedia, shader.filter],
  );

  const triggerFileInput = useCallback(() => {
    if (isLoadingMedia || !shader.filter) return;
    fileInputRef.current?.click();
  }, [isLoadingMedia, shader.filter]);

  const handleButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      triggerFileInput();
    },
    [triggerFileInput],
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (selectedFile || isLoadingMedia) return;

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
        (activeElement?.tagName === "DIV" && !activeElement.hasChildNodes()) ||
        isActive;

      if (isPasteTarget) {
        const items = event.clipboardData?.items;
        if (!items) return;

        let fileFound = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === "file") {
            const file = items[i].getAsFile();
            if (file && validTypes.includes(file.type)) {
              fileFound = true;
              break;
            } else if (file) {
              setShake(true);
              setError(
                `Invalid file type pasted. Please use ${validTypesString}.`,
              );
              setTimeout(() => setShake(false), 300);
              event.preventDefault();
              fileFound = true;
              break;
            }
          }
        }
        if (
          !fileFound &&
          items.length > 0 &&
          Array.from(items).some((item) => item.type.startsWith("text/")) &&
          !Array.from(items).some(
            (item) =>
              item.type.startsWith("image/") || item.type.startsWith("video/"),
          )
        ) {
          setShake(true);
          setError(
            "No valid image or video found in clipboard. Try copying media instead of text.",
          );
          setTimeout(() => setShake(false), 300);
        }
      }
    },
    [
      validateFile,
      selectedFile,
      isLoadingMedia,
      shader.filter,
      isActive,
      validTypes,
      validTypesString,
    ],
  );

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      handlePaste(e).catch((err) => console.error("Paste handler error:", err));
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [handlePaste]);

  const isBusy = isLoadingMedia;
  const busyMessage = !shader.filter ? "Initializing..." : loadingMessage;

  return (
    <div className="space-y-2">
      {isViewerOpen && (
        <CanvasViewer
          canvas={shader.canvas}
          onClose={() => setIsViewerOpen(false)}
          altText={selectedFile?.name}
        />
      )}

      <div
        className={cn(
          "relative w-full h-64 sm:h-80",
          "rounded-lg border border-border",
          isBusy && "flex items-center justify-center",
        )}
      >
        <CanvasPreview
          onCanvasReady={handleCanvasReady}
          hasContent={!!selectedFile}
          altText={selectedFile?.name || "Upload area"}
          onRemove={handleRemoveImage}
          onViewFullSize={() => setIsViewerOpen(true)}
          showRemoveButton={!!selectedFile && !isBusy}
          enableViewFullSize={!!selectedFile && !isBusy}
          className={cn("w-full h-full", isBusy && "hidden")}
          isLoading={false}
          onUploadPlaceholderClick={triggerFileInput}
          isInteractive={!isBusy}
          sourceDimensions={shader.sourceDimensions}
        />
        {isBusy && (
          <div className="flex flex-col items-center justify-center text-center">
            <svg
              className="animate-spin h-12 w-12 text-primary mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-lg font-medium mb-1">{busyMessage}</p>
          </div>
        )}
        {!selectedFile && !isBusy && (
          <div
            ref={uploadAreaRef}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center",
              "border-2 border-dashed rounded-lg transition-all duration-300 p-4 text-center",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-transparent bg-transparent hover:border-primary/50",
              "cursor-pointer",
              shake && "animate-shake",
              isActive && !isDragging && "ring-2 ring-primary ring-offset-2",
            )}
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                triggerFileInput();
              }
            }}
            onFocus={() => setIsActive(true)}
            onBlur={() => setIsActive(false)}
            tabIndex={0}
            role="button"
            aria-label="Image or video upload area"
          >
            <ImageIcon
              className={cn(
                "w-16 h-16 mb-4 pointer-events-none transition-all duration-300",
                isDragging
                  ? "icon-active scale-110 text-primary"
                  : "text-foreground-secondary",
              )}
              aria-hidden="true"
            />
            <div
              className={`flex flex-col items-center transition-all duration-200 pointer-events-none ${isDragging ? "opacity-50" : ""}`}
            >
              <p className="text-lg font-medium mb-1">Upload Image or Video</p>
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
                  "transition-all duration-200 px-6 py-3 text-base pointer-events-auto",
                  isDragging && "opacity-50 cursor-not-allowed",
                )}
                aria-label="Choose image or video from device"
                type="button"
              >
                Choose file
              </Button>
              <p className="text-xs text-foreground-muted mt-2">
                Max image: {LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB. Max video:{" "}
                {LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB.
              </p>
            </div>
          </div>
        )}
      </div>
      {selectedFile && !isBusy && (
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <p className="text-sm text-foreground-secondary truncate">
              {selectedFile.name}
            </p>
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label={`Remove ${shader.sourceMediaType || "media"}`}
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
          <Button onClick={handleButtonClick} variant="outline" size="sm">
            Change
          </Button>
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
