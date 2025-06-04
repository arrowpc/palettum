import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  MouseEvent,
  ReactNode,
  KeyboardEvent,
} from "react";
import { X, Maximize, ImageIcon as DefaultUploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import CanvasViewer from "@/components/CanvasViewer"; // Assuming this path is correct
import { Button } from "@/components/ui/button"; // Assuming this path is correct

interface CanvasPreviewProps {
  canvas: OffscreenCanvas | null;
  altText?: string;
  onRemove?: (e: MouseEvent) => void;
  onUploadPlaceholderClick?: () => void;
  isLoading?: boolean;
  isInteractive?: boolean;
  uploadIcon?: ReactNode;
  uploadText?: string;
  showRemoveButton?: boolean;
  enableViewFullSize?: boolean;
  className?: string;
  canvasClassName?: string;
  placeholderContainerClassName?: string;
  placeholderContentClassName?: string;
  customSpinner?: ReactNode;
  title?: string;
  previewVersion?: number; // Added for video frame updates
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = React.memo(
  ({
    canvas: canvasProp,
    altText = "Preview",
    onRemove,
    onUploadPlaceholderClick,
    isLoading = false,
    isInteractive = true,
    uploadIcon,
    uploadText = "Upload Canvas Content",
    showRemoveButton = true,
    enableViewFullSize = true,
    className,
    canvasClassName,
    placeholderContainerClassName,
    placeholderContentClassName,
    customSpinner,
    title: customTitle,
    previewVersion, // Destructure
  }) => {
    const [isCanvasViewerOpen, setIsCanvasViewerOpen] = useState(false);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);

    const effectiveUploadIcon = uploadIcon || (
      <DefaultUploadIcon className="mx-auto w-6 h-6 sm:w-8 sm:h-8" />
    );

    useEffect(() => {
      const displayElement = displayCanvasRef.current;
      if (!displayElement) {
        return;
      }

      const clientWidth = displayElement.clientWidth;
      const clientHeight = displayElement.clientHeight;

      if (clientWidth === 0 || clientHeight === 0) {
        // Avoid issues if canvas is not yet rendered with dimensions
        return;
      }

      if (
        displayElement.width !== clientWidth ||
        displayElement.height !== clientHeight
      ) {
        displayElement.width = clientWidth;
        displayElement.height = clientHeight;
      }

      const context = displayElement.getContext("2d");
      if (!context) {
        console.error(
          "CanvasPreview: Failed to get 2D context from canvas element",
        );
        return;
      }

      if (
        canvasProp &&
        canvasProp.width > 0 &&
        canvasProp.height > 0 &&
        displayElement.width > 0 &&
        displayElement.height > 0
      ) {
        const dw = displayElement.width;
        const dh = displayElement.height;
        const sw = canvasProp.width;
        const sh = canvasProp.height;

        const scale = Math.max(dw / sw, dh / sh);
        const scaledWidth = sw * scale;
        const scaledHeight = sh * scale;
        const dx = (dw - scaledWidth) / 2;
        const dy = (dh - scaledHeight) / 2;

        context.clearRect(0, 0, dw, dh);
        context.drawImage(
          canvasProp,
          0,
          0,
          sw,
          sh,
          dx,
          dy,
          scaledWidth,
          scaledHeight,
        );
      } else {
        context.clearRect(0, 0, displayElement.width, displayElement.height);
      }
    }, [canvasProp, previewVersion, isLoading]); // Added previewVersion and isLoading

    const handleMainClick = () => {
      if (!isInteractive || isLoading) return;
      if (canvasProp && enableViewFullSize) {
        setIsCanvasViewerOpen(true);
      } else if (!canvasProp && onUploadPlaceholderClick) {
        onUploadPlaceholderClick();
      }
    };

    const handleRemoveClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (isInteractive && onRemove) {
        onRemove(e);
      }
    };

    const defaultTitle = useMemo(() => {
      if (isLoading) return "Loading...";
      if (!isInteractive) return altText;
      if (canvasProp) {
        return enableViewFullSize ? "Click to view full size" : altText;
      }
      return onUploadPlaceholderClick ? uploadText : "No canvas content";
    }, [
      isLoading,
      isInteractive,
      canvasProp,
      enableViewFullSize,
      altText,
      onUploadPlaceholderClick,
      uploadText,
    ]);

    const spinner = customSpinner || (
      <svg
        className="animate-spin h-8 w-8 text-primary"
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
    );

    const baseContainerClasses =
      "relative group flex items-center justify-center overflow-hidden transition-all duration-200";
    const interactiveClasses =
      isInteractive && !isLoading && (canvasProp || onUploadPlaceholderClick)
        ? "cursor-pointer"
        : "cursor-default";

    if (isLoading) {
      return (
        <div
          className={cn(
            baseContainerClasses,
            "bg-background/50 border border-dashed border-border",
            className,
            placeholderContainerClassName,
          )}
          title={customTitle ?? defaultTitle}
        >
          {spinner}
        </div>
      );
    }

    return (
      <>
        <div
          className={cn(
            baseContainerClasses,
            interactiveClasses,
            className,
            !canvasProp &&
            "border border-dashed border-border hover:border-primary bg-background/50",
            !canvasProp && placeholderContainerClassName,
          )}
          onClick={handleMainClick}
          title={customTitle ?? defaultTitle}
          role={
            isInteractive && (canvasProp || onUploadPlaceholderClick)
              ? "button"
              : undefined
          }
          tabIndex={
            isInteractive && (canvasProp || onUploadPlaceholderClick) ? 0 : -1
          }
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (isInteractive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              handleMainClick();
            }
          }}
        >
          {canvasProp ? (
            <>
              <canvas
                ref={displayCanvasRef}
                className={cn("w-full h-full", canvasClassName)}
                aria-label={altText}
              />
              {isInteractive && onRemove && showRemoveButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveClick}
                  className={`
                    absolute top-1 right-1 p-0.5 w-6 h-6
                    bg-white/80 hover:bg-white active:bg-gray-100
                    text-gray-700 hover:text-black
                    rounded-full shadow-md
                    z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition
                    focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-black/20
                    hover:scale-110 active:scale-95
                    duration-150
                  `}
                  title="Remove canvas content"
                  aria-label="Remove canvas content"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}

              {isInteractive && enableViewFullSize && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center pointer-events-none">
                  <div className="p-2 bg-black/50 backdrop-blur-sm rounded-md flex items-center gap-1.5 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-200">
                    <Maximize className="w-4 h-4" />
                    <span className="text-xs font-medium">View Full Size</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            isInteractive &&
            onUploadPlaceholderClick && (
              <div
                className={cn(
                  "text-center p-2 text-foreground-muted",
                  placeholderContentClassName,
                )}
              >
                {effectiveUploadIcon}
                <p className="text-xs leading-tight mt-1">{uploadText}</p>
              </div>
            )
          )}
        </div>
        {canvasProp && isCanvasViewerOpen && (
          <CanvasViewer
            canvas={canvasProp}
            onClose={() => setIsCanvasViewerOpen(false)}
          />
        )}
      </>
    );
  },
);

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
