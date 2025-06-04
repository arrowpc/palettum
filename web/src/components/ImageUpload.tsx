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
import CanvasPreview from "./CanvasPreview"; // Ensure this path is correct
import { ImageFilter } from "palettum"; // Adjust if your WASM module export is different
import { useShader } from "@/ShaderContext"; // Ensure this path is correct

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
}

function ImageUpload({ onFileSelect }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // previewUrl is no longer the primary driver for preview, shader.canvas is.
  // const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false); // For focus ring on upload area
  const [isLoadingMedia, setIsLoadingMedia] = useState(false); // For loading indicator

  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { shader, setShader } = useShader();

  // Refs for video processing
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const decodeCanvasRef = useRef<OffscreenCanvas | null>(null);
  const decodeCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  const validImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/x-icon",
  ];
  const validVideoTypes = ["video/mp4", "video/webm", "video/ogg"]; // Add more as needed
  const validTypes = [...validImageTypes, ...validVideoTypes];

  const validTypesString = validTypes
    .map((type) => {
      const [cat, subType] = type.split("/");
      return subType.toUpperCase();
    })
    .filter((value, index, self) => self.indexOf(value) === index) // Unique types
    .join(", ");

  // Cleanup previous media resources
  const cleanupPreviousMedia = useCallback(async () => {
    setIsLoadingMedia(false);
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.removeAttribute("src"); // Detach source
      videoElementRef.current.load(); // Abort loading/playback
      // videoElementRef.current.remove(); // If it was added to DOM
      videoElementRef.current = null;
    }
    decodeCanvasRef.current = null;
    decodeCtxRef.current = null;

    // Assuming ImageFilter's resources are managed by its JS object lifecycle and GC.
    // If ImageFilter had a .free() method, call shader.filter?.free() here.
    setShader((prev) => ({
      ...prev,
      filter: null,
      canvas: null,
      sourceMediaType: null,
      sourceDimensions: undefined,
    }));
    // The old `clear()` from palettumWorker. If it's still needed for other things:
    // await clear();
  }, [setShader /*, clear (if using palettumWorker) */]);

  const validateFile = useCallback(
    async (file: File | null) => {
      console.log("validateFile called with", file);
      await cleanupPreviousMedia(); // Clean up before processing new or null file

      if (!file) {
        setSelectedFile(null);
        onFileSelect(null);
        setError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return true;
      }

      setIsLoadingMedia(true);

      if (!validTypes.includes(file.type)) {
        setShake(true);
        setError(`Invalid file type. Please upload a ${validTypesString}.`);
        setTimeout(() => setShake(false), 300);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsLoadingMedia(false);
        return false;
      }

      const fileCategory = file.type.split("/")[0];

      if (fileCategory === "image") {
        if (file.size > LIMITS.MAX_FILE_SIZE) {
          setShake(true);
          setError(
            `File size exceeds ${LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB.`,
          );
          setTimeout(() => setShake(false), 300);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsLoadingMedia(false);
          return false;
        }

        const img = new window.Image();
        const url = URL.createObjectURL(file);

        return new Promise<boolean>((resolve) => {
          img.onload = async () => {
            URL.revokeObjectURL(url);
            if (
              img.width > LIMITS.MAX_DIMENSION ||
              img.height > LIMITS.MAX_DIMENSION
            ) {
              // ... (error handling for image dimensions) ...
              setError(`Image dimensions exceed ${LIMITS.MAX_DIMENSION}px.`);
              setIsLoadingMedia(false);
              resolve(false);
              return;
            }

            const decodeCanvas = new OffscreenCanvas(img.width, img.height);
            const decodeCtx = decodeCanvas.getContext("2d");
            if (!decodeCtx) {
              // ... (error handling) ...
              setError("Failed to get 2D context for image decoding.");
              setIsLoadingMedia(false);
              resolve(false);
              return;
            }
            decodeCtx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = decodeCtx.getImageData(
              0,
              0,
              img.width,
              img.height,
            );
            const pixelData = new Uint8Array(imageData.data.buffer);
            const wgpuTargetCanvas = new OffscreenCanvas(img.width, img.height);

            try {
              const newFilter = await new ImageFilter(wgpuTargetCanvas);
              newFilter.set_image_data(img.width, img.height, pixelData);
              setShader({
                filter: newFilter,
                canvas: wgpuTargetCanvas,
                sourceMediaType: "image",
                sourceDimensions: { width: img.width, height: img.height },
              });
              setSelectedFile(file);
              onFileSelect(file);
              setError(null);
              resolve(true);
            } catch (filterError) {
              console.error("ImageFilter init error for image:", filterError);
              setError("Failed to initialize image processor.");
              resolve(false);
            } finally {
              setIsLoadingMedia(false);
            }
          };
          img.onerror = () => {
            // ... (error handling) ...
            setError("Failed to load image.");
            setIsLoadingMedia(false);
            resolve(false);
          };
          img.src = url;
        });
      } else if (fileCategory === "video") {
        if (file.size > LIMITS.MAX_FILE_SIZE) {
          setShake(true);
          setError(
            `Video size exceeds ${LIMITS.MAX_FILE_SIZE / 1024 / 1024} MB.`,
          );
          setTimeout(() => setShake(false), 300);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsLoadingMedia(false);
          return false;
        }

        const video = document.createElement("video");
        videoElementRef.current = video;
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        return new Promise<boolean>((resolve) => {
          video.onloadedmetadata = async () => {
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              setError(
                "Video has invalid dimensions (0x0). Please try another video.",
              );
              URL.revokeObjectURL(video.src);
              setIsLoadingMedia(false);
              resolve(false);
              return;
            }
            if (
              video.videoWidth > LIMITS.MAX_DIMENSION ||
              video.videoHeight > LIMITS.MAX_DIMENSION
            ) {
              setError(
                `Video dimensions may be too large (max ${LIMITS.MAX_DIMENSION}px). Performance might suffer.`,
              );
              // Not strictly blocking, but warning. Could also block.
            }

            const tempDecodeCanvas = new OffscreenCanvas(
              video.videoWidth,
              video.videoHeight,
            );
            const tempDecodeCtx = tempDecodeCanvas.getContext("2d", {
              willReadFrequently: true,
            });

            if (!tempDecodeCtx) {
              setError("Failed to get 2D context for video decoding.");
              URL.revokeObjectURL(video.src);
              setIsLoadingMedia(false);
              resolve(false);
              return;
            }
            decodeCanvasRef.current = tempDecodeCanvas;
            decodeCtxRef.current = tempDecodeCtx;

            // Draw initial frame for set_image_data
            tempDecodeCtx.drawImage(
              video,
              0,
              0,
              video.videoWidth,
              video.videoHeight,
            );
            const imageData = tempDecodeCtx.getImageData(
              0,
              0,
              video.videoWidth,
              video.videoHeight,
            );
            const pixelData = new Uint8Array(imageData.data.buffer);
            const wgpuTargetCanvas = new OffscreenCanvas(
              video.videoWidth,
              video.videoHeight,
            );

            try {
              const newFilter = await new ImageFilter(wgpuTargetCanvas);
              newFilter.set_image_data(
                video.videoWidth,
                video.videoHeight,
                pixelData,
              );

              setShader({
                filter: newFilter,
                canvas: wgpuTargetCanvas,
                sourceMediaType: "video",
                sourceDimensions: {
                  width: video.videoWidth,
                  height: video.videoHeight,
                },
              });
              setSelectedFile(file);
              onFileSelect(file);
              setError(null);

              const renderVideoFrame = () => {
                if (
                  videoElementRef.current &&
                  decodeCtxRef.current &&
                  shaderRefWorkaround.current?.filter && // Use a ref for shader inside rAF
                  !videoElementRef.current.paused &&
                  videoElementRef.current.readyState >=
                  videoElementRef.current.HAVE_CURRENT_DATA // Ensure frame is available
                ) {
                  decodeCtxRef.current.drawImage(
                    videoElementRef.current,
                    0,
                    0,
                    videoElementRef.current.videoWidth,
                    videoElementRef.current.videoHeight,
                  );
                  const currentImageData = decodeCtxRef.current.getImageData(
                    0,
                    0,
                    videoElementRef.current.videoWidth,
                    videoElementRef.current.videoHeight,
                  );
                  const currentPixelData = new Uint8Array(
                    currentImageData.data.buffer,
                  );
                  try {
                    shaderRefWorkaround.current.filter.update_texture_data(
                      currentPixelData,
                    );
                    setPreviewVersion((v) => v + 1);
                  } catch (e) {
                    console.error("Error updating video texture data:", e);
                    if (animationFrameIdRef.current)
                      cancelAnimationFrame(animationFrameIdRef.current);
                    animationFrameIdRef.current = null;
                    // setError("Video processing error."); // Avoid spamming errors
                    return; // Stop loop
                  }
                }
                if (videoElementRef.current) {
                  // Check if video element still exists
                  animationFrameIdRef.current =
                    requestAnimationFrame(renderVideoFrame);
                } else {
                  if (animationFrameIdRef.current)
                    cancelAnimationFrame(animationFrameIdRef.current);
                  animationFrameIdRef.current = null;
                }
              };

              // Workaround for accessing latest shader state in rAF
              const shaderRefWorkaround = { current: { filter: newFilter } };
              // Keep shaderRefWorkaround.current.filter updated if shader.filter changes elsewhere,
              // though for this flow, newFilter is the one we care about for this video session.

              video
                .play()
                .then(() => {
                  setIsLoadingMedia(false); // Video is playing, loading done
                  if (animationFrameIdRef.current)
                    cancelAnimationFrame(animationFrameIdRef.current);
                  renderVideoFrame();
                })
                .catch((playError) => {
                  console.error("Video play error:", playError);
                  setError(
                    "Could not play video automatically. " +
                    (playError.message || ""),
                  );
                  setIsLoadingMedia(false);
                  // Don't resolve false here if metadata loaded, user might interact later
                });
              resolve(true); // Resolved true as metadata loaded and filter set
            } catch (filterError) {
              console.error("ImageFilter init error for video:", filterError);
              setError("Failed to initialize video processor.");
              URL.revokeObjectURL(video.src);
              setIsLoadingMedia(false);
              resolve(false);
            }
          };
          video.onerror = () => {
            URL.revokeObjectURL(video.src);
            setError("Failed to load video. Please try another file.");
            if (videoElementRef.current) videoElementRef.current = null;
            setIsLoadingMedia(false);
            resolve(false);
          };
        });
      } else {
        setError(`Unsupported file type: ${file.type}`);
        setIsLoadingMedia(false);
        return false;
      }
    },
    [
      onFileSelect,
      validTypesString,
      setShader,
      cleanupPreviousMedia,
      validTypes,
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
      await validateFile(null); // This now handles all cleanup
    },
    [validateFile],
  );

  const handleDragEvents = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, isEntering: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedFile || isLoadingMedia) return;
      setIsDragging(isEntering);
    },
    [selectedFile, isLoadingMedia],
  );

  const handleDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedFile || isLoadingMedia) return;

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
    [validateFile, selectedFile, isLoadingMedia],
  );

  const triggerFileInput = useCallback(() => {
    if (isLoadingMedia) return;
    fileInputRef.current?.click();
  }, [isLoadingMedia]);

  const handleButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation(); // Prevent triggering upload area click if button is inside
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
        activeElement?.id === "root" || // Common root ID
        activeElement?.tagName === "MAIN" ||
        (activeElement?.tagName === "DIV" && !activeElement.hasChildNodes()) || // Generic divs
        isActive; // If upload area itself has focus

      if (isPasteTarget) {
        const items = event.clipboardData?.items;
        if (!items) return;

        let fileFound = false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === "file") {
            // Prefer file items
            const file = items[i].getAsFile();
            if (file && validTypes.includes(file.type)) {
              const valid = await validateFile(file);
              if (valid) event.preventDefault(); // Prevent default paste only if we handle it
              fileFound = true;
              break;
            } else if (file) {
              // File of invalid type
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
          Array.from(items).some((item) => item.type.startsWith("text/")) && // Check if text was pasted
          !Array.from(items).some(
            (item) =>
              item.type.startsWith("image/") || item.type.startsWith("video/"),
          ) // And no media
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
      isActive,
      validTypesString,
      selectedFile,
      isLoadingMedia,
      validTypes,
    ],
  );

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      handlePaste(e).catch((err) => {
        console.error("Paste handler error:", err);
      });
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [handlePaste]);

  // Effect to ensure video is paused when component unmounts or shader changes
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (videoElementRef.current) {
        videoElementRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      {shader?.canvas && selectedFile ? (
        <div className="space-y-2">
          <CanvasPreview
            canvas={shader.canvas}
            altText={selectedFile.name}
            onRemove={handleRemoveImage}
            showRemoveButton={true}
            enableViewFullSize={true}
            className="w-full h-64 sm:h-80 rounded-lg border border-border"
            previewVersion={previewVersion}
            isLoading={isLoadingMedia}
          />
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
            <Button
              onClick={handleButtonClick}
              variant="outline"
              size="sm"
              disabled={isLoadingMedia}
            >
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
              : "border-border bg-background-secondary hover:border-primary/50",
            selectedFile || isLoadingMedia
              ? "cursor-default"
              : "cursor-pointer",
            shake && "animate-shake",
            isActive && !isDragging && "ring-2 ring-primary ring-offset-2",
          )}
          onDragEnter={(e) => handleDragEvents(e, true)}
          onDragOver={(e) => handleDragEvents(e, true)}
          onDragLeave={(e) => handleDragEvents(e, false)}
          onDrop={handleDrop}
          onClick={isLoadingMedia ? undefined : triggerFileInput}
          onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
            if (!isLoadingMedia && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              triggerFileInput();
            }
          }}
          onFocus={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          tabIndex={isLoadingMedia || selectedFile ? -1 : 0}
          role="button"
          aria-label="Image or video upload area"
        >
          {isLoadingMedia ? (
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
          ) : (
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
          )}
          <div
            className={`flex flex-col items-center transition-all duration-200 pointer-events-none ${isDragging || isLoadingMedia ? "opacity-50" : ""}`}
          >
            <p className="text-lg font-medium mb-1">
              {isLoadingMedia ? "Processing..." : "Upload Image or Video"}
            </p>
            {!isLoadingMedia && (
              <>
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
                  disabled={isDragging || isLoadingMedia}
                  className={cn(
                    "bg-primary hover:bg-primary-hover text-primary-foreground",
                    "transition-all duration-200",
                    "px-6 py-3 text-base pointer-events-auto",
                    (isDragging || isLoadingMedia) &&
                    "opacity-50 cursor-not-allowed",
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
              </>
            )}
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
