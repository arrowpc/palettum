import React, {
  useMemo,
  useRef,
  useEffect,
  MouseEvent,
  ReactNode,
  KeyboardEvent,
  useState,
} from "react";
import { X, Maximize, ImageIcon as DefaultUploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CanvasPreviewProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  hasContent: boolean;
  altText?: string;
  onRemove?: (e: MouseEvent) => void;
  onUploadPlaceholderClick?: () => void;
  onViewFullSize?: () => void;
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
  sourceDimensions?: { width: number; height: number };
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = React.memo(
  ({
    onCanvasReady,
    hasContent,
    altText = "Preview",
    onRemove,
    onUploadPlaceholderClick,
    onViewFullSize,
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
    sourceDimensions,
  }) => {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({
      width: 0,
      height: 0,
    });

    const effectiveUploadIcon = uploadIcon || (
      <DefaultUploadIcon className="mx-auto w-6 h-6 sm:w-8 sm:h-8" />
    );

    const canvasStyle = useMemo(() => {
      if (
        !sourceDimensions ||
        !containerRef.current ||
        containerSize.width === 0 ||
        containerSize.height === 0
      ) {
        return {};
      }

      const { width: sourceWidth, height: sourceHeight } = sourceDimensions;
      const { width: containerWidth, height: containerHeight } = containerSize;

      const sourceAspect = sourceWidth / sourceHeight;
      const containerAspect = containerWidth / containerHeight;

      let displayWidth, displayHeight;

      if (sourceAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / sourceAspect;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * sourceAspect;
      }

      return {
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        imageRendering: "pixelated" as const,
      };
    }, [sourceDimensions, containerSize]);

    useEffect(() => {
      const displayElement = displayCanvasRef.current;
      if (displayElement) {
        onCanvasReady(displayElement);
      }
    }, [onCanvasReady]);

    useEffect(() => {
      const displayElement = displayCanvasRef.current;
      if (displayElement) {
        if (sourceDimensions) {
          if (
            displayElement.width !== sourceDimensions.width ||
            displayElement.height !== sourceDimensions.height
          ) {
            displayElement.width = sourceDimensions.width;
            displayElement.height = sourceDimensions.height;
          }
        } else {
          if (displayElement.width !== 1 || displayElement.height !== 1) {
            displayElement.width = 1;
            displayElement.height = 1;
          }
        }
      }
    }, [sourceDimensions]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setContainerSize({ width, height });
        }
      });

      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    const handleMainClick = () => {
      if (!isInteractive || isLoading) return;
      if (hasContent && enableViewFullSize && onViewFullSize) {
        onViewFullSize();
      } else if (!hasContent && onUploadPlaceholderClick) {
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
      if (hasContent) {
        return enableViewFullSize ? "Click to view full size" : altText;
      }
      return onUploadPlaceholderClick ? uploadText : "No canvas content";
    }, [
      isLoading,
      isInteractive,
      hasContent,
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
      "relative group w-full h-full flex items-center justify-center overflow-hidden transition-all duration-200";
    const interactiveClasses =
      isInteractive && !isLoading && (hasContent || onUploadPlaceholderClick)
        ? "cursor-pointer"
        : "cursor-default";

    if (isLoading) {
      return (
        <div
          ref={containerRef}
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
      <div
        ref={containerRef}
        className={cn(
          baseContainerClasses,
          interactiveClasses,
          className,
          !hasContent &&
          "border border-dashed border-border hover:border-primary bg-background/50",
          !hasContent && placeholderContainerClassName,
        )}
        onClick={handleMainClick}
        title={customTitle ?? defaultTitle}
        role={
          isInteractive && (hasContent || onUploadPlaceholderClick)
            ? "button"
            : undefined
        }
        tabIndex={
          isInteractive && (hasContent || onUploadPlaceholderClick) ? 0 : -1
        }
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (isInteractive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleMainClick();
          }
        }}
      >
        <canvas
          ref={displayCanvasRef}
          style={canvasStyle}
          className={cn(
            "transition-all duration-200 group-hover:filter group-hover:brightness-[.8]",
            !hasContent && "hidden",
            canvasClassName,
          )}
          aria-label={altText}
        />
        {!hasContent && isInteractive && onUploadPlaceholderClick && (
          <div
            className={cn(
              "text-center p-2 text-foreground-muted",
              placeholderContentClassName,
            )}
          >
            {effectiveUploadIcon}
            <p className="text-xs leading-tight mt-1">{uploadText}</p>
          </div>
        )}
        {hasContent && (
          <>
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
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="p-2 bg-black/50 backdrop-blur-sm rounded-md flex items-center gap-1.5 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-200">
                  <Maximize className="w-4 h-4" />
                  <span className="text-xs font-medium">View Full Size</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  },
);

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
