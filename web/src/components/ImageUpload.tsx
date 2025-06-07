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
  const ffmpegWorkerRef = useRef<Worker | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [offscreenCanvas, setOffscreenCanvas] =
    useState<OffscreenCanvas | null>(null);

  const handleCanvasReady = useCallback(
    (canvas: OffscreenCanvas) => {
      setOffscreenCanvas(canvas);
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
    ffmpegWorkerRef.current = new Worker(
      new URL("../lib/ffmpeg.worker.ts", import.meta.url),
      { type: "module" },
    );

    const handleWorkerMessage = (
      event: MessageEvent<{
        type: string;
        progress?: number;
        message?: string;
        blob?: Blob;
      }>,
    ) => {
      const { type, progress, message, blob } = event.data;
      switch (type) {
        case "status":
          setLoadingMessage(message || "...");
          break;
        case "progress":
          setLoadingMessage(`Converting... ${(progress! * 100).toFixed(0)}%`);
          break;
        case "done":
          if (blob && selectedFile) {
            processVideo(blob, selectedFile).finally(() => {
              setIsLoadingMedia(false);
            });
          }
          break;
        case "error":
          setError(message || "An unknown conversion error occurred.");
          setIsLoadingMedia(false);
          break;
      }
    };

    ffmpegWorkerRef.current.addEventListener("message", handleWorkerMessage);

    return () => {
      ffmpegWorkerRef.current?.removeEventListener(
        "message",
        handleWorkerMessage,
      );
      ffmpegWorkerRef.current?.terminate();
    };
  }, [selectedFile]);

  useEffect(() => {
    let isMounted = true;

    if (offscreenCanvas && !shader.filter) {
      setLoadingMessage("Initializing renderer...");
      const initFilter = async () => {
        try {
          const filter = await new ImageFilter(offscreenCanvas);
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
    // Add shader.filter to the dependency array.
  }, [offscreenCanvas, setShader, setError, shader.filter]);
  const cleanupPreviousMedia = useCallback(async () => {
    setIsLoadingMedia(false);
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.removeAttribute("src");
      videoElementRef.current.load();
      videoElementRef.current = null;
    }
    // Do not reset the filter, just the media-specific state
    setShader((prev) => ({
      ...prev,
      sourceMediaType: null,
      sourceDimensions: undefined,
    }));
  }, [setShader]);

  const processVideo = useCallback(
    async (videoBlob: Blob, originalFile: File) => {
      if (!shader.filter) {
        setError("Renderer not ready.");
        return false;
      }
      const video = document.createElement("video");
      videoElementRef.current = video;
      video.src = URL.createObjectURL(videoBlob);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;

      return new Promise<boolean>((resolve) => {
        video.onloadedmetadata = async () => {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            setError("Video has invalid dimensions. Please try another.");
            URL.revokeObjectURL(video.src);
            resolve(false);
            return;
          }
          if (
            video.videoWidth > LIMITS.MAX_DIMENSION ||
            video.videoHeight > LIMITS.MAX_DIMENSION
          ) {
            setError(`Video dimensions may be too large.`);
          }

          const renderVideoFrame = () => {
            if (
              videoElementRef.current &&
              shader.filter &&
              !videoElementRef.current.paused &&
              videoElementRef.current.readyState >= video.HAVE_CURRENT_DATA
            ) {
              try {
                shader.filter.update_from_video_frame(videoElementRef.current);
              } catch (e) {
                console.error("Error updating video frame:", e);
                if (animationFrameIdRef.current)
                  cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
                return;
              }
            }
            if (videoElementRef.current) {
              animationFrameIdRef.current =
                requestAnimationFrame(renderVideoFrame);
            }
          };

          video
            .play()
            .then(() => {
              if (animationFrameIdRef.current)
                cancelAnimationFrame(animationFrameIdRef.current);
              renderVideoFrame();
              setShader((prev) => ({
                ...prev,
                sourceMediaType: "video",
                sourceDimensions: {
                  width: video.videoWidth,
                  height: video.videoHeight,
                },
              }));
              setSelectedFile(originalFile);
              onFileSelect(originalFile);
              setError(null);
              resolve(true);
            })
            .catch((playError) => {
              console.error("Video play error:", playError);
              setError("Could not play video automatically.");
              resolve(false);
            });
        };
        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          setError("Failed to load video. Please try another file.");
          if (videoElementRef.current) videoElementRef.current = null;
          resolve(false);
        };
      });
    },
    [onFileSelect, setShader, shader.filter],
  );

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

      const fileCategory = file.type.split("/")[0];
      const isGif = file.type === "image/gif";

      if (isGif) {
        setLoadingMessage("Preparing to convert GIF...");
        setSelectedFile(file);
        onFileSelect(file);
        ffmpegWorkerRef.current?.postMessage({ file });
      } else if (fileCategory === "image") {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = async () => {
          URL.revokeObjectURL(url);
          if (
            img.width > LIMITS.MAX_DIMENSION ||
            img.height > LIMITS.MAX_DIMENSION
          ) {
            setError(`Image dimensions exceed ${LIMITS.MAX_DIMENSION}px.`);
            setIsLoadingMedia(false);
            return;
          }

          const decodeCanvas = new OffscreenCanvas(img.width, img.height);
          const decodeCtx = decodeCanvas.getContext("2d");
          decodeCtx?.drawImage(img, 0, 0);
          const imageData = decodeCtx?.getImageData(
            0,
            0,
            img.width,
            img.height,
          );
          const pixelData = new Uint8Array(imageData!.data.buffer);

          try {
            shader.filter!.set_image_data(img.width, img.height, pixelData);
            setShader((prev) => ({
              ...prev,
              sourceMediaType: "image",
              sourceDimensions: { width: img.width, height: img.height },
            }));
            setSelectedFile(file);
            onFileSelect(file);
            setError(null);
          } catch (filterError) {
            console.error("ImageFilter error for image:", filterError);
            setError("Failed to process image.");
          } finally {
            setIsLoadingMedia(false);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          setError("Failed to load image.");
          setIsLoadingMedia(false);
        };
        img.src = url;
      } else if (fileCategory === "video") {
        await processVideo(file, file);
        setIsLoadingMedia(false);
      } else {
        setError(`Unsupported file type: ${file.type}`);
        setIsLoadingMedia(false);
      }
    },
    [
      cleanupPreviousMedia,
      onFileSelect,
      processVideo,
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
    [validateFile, selectedFile, isLoadingMedia, shader.filter],
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
