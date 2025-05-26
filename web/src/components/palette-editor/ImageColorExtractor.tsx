import React from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageColorExtractorProps {
  imagePreviewUrl: string | null;
  onImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (e?: React.MouseEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  numColorsToExtract: number;
  onNumColorsToExtractChange: (num: number) => void;
  currentMaxColorsToExtract: number;
  onExtractColors: () => void;
  isExtractingColors: boolean;
  canExtractMore: boolean;
  uploadedImageFile: File | null;
  isMobile: boolean;
}

export const ImageColorExtractor: React.FC<ImageColorExtractorProps> =
  React.memo(
    ({
      imagePreviewUrl,
      onImageFileChange,
      onRemoveImage,
      fileInputRef,
      numColorsToExtract,
      onNumColorsToExtractChange,
      currentMaxColorsToExtract,
      onExtractColors,
      isExtractingColors,
      canExtractMore,
      uploadedImageFile,
      isMobile,
    }) => {
      return (
        <div className="p-3 border border-border/70 rounded-md bg-secondary/20 space-y-3">
          <div
            className={cn(
              "flex gap-3",
              isMobile ? "items-start" : "flex-col items-center",
            )}
          >
            <div
              className={cn(
                "relative group rounded border border-dashed border-border hover:border-primary transition-colors",
                "flex items-center justify-center bg-background/50",
                isMobile ? "w-20 h-20 flex-shrink-0" : "w-full h-24 sm:h-28",
                (isExtractingColors || !canExtractMore) &&
                "cursor-default opacity-70",
                canExtractMore && "cursor-pointer",
              )}
              onClick={() =>
                !isExtractingColors &&
                canExtractMore &&
                fileInputRef.current?.click()
              }
              title={
                !canExtractMore
                  ? "Palette full"
                  : imagePreviewUrl
                    ? "Click to change image"
                    : "Click to upload image"
              }
            >
              {!imagePreviewUrl && !isExtractingColors && (
                <div className="text-center p-1 text-foreground-muted">
                  <ImageIcon className="mx-auto mb-1 w-6 h-6 sm:w-8 sm:h-8" />
                  <p className="text-[10px] sm:text-xs leading-tight">
                    Upload Image
                  </p>
                </div>
              )}
              {imagePreviewUrl && (
                <>
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover rounded"
                  />
                  {!isExtractingColors && (
                    <button
                      onClick={onRemoveImage}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-black/80 rounded-full text-white z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
              {isExtractingColors && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                  <svg
                    className="animate-spin h-6 w-6 text-white"
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
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImageFileChange}
              accept="image/*,.gif"
              className="hidden"
              disabled={isExtractingColors || !canExtractMore}
            />
            <div
              className={cn(
                "flex-1 space-y-1.5",
                isMobile ? "w-auto" : "w-full",
              )}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onExtractColors}
                  disabled={
                    !uploadedImageFile ||
                    isExtractingColors ||
                    !canExtractMore ||
                    numColorsToExtract <= 0
                  }
                  className="w-full py-1.5 px-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs sm:text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Extract
                </button>
                <label
                  htmlFor="numColorsToExtract"
                  className="text-xs text-foreground-muted sr-only"
                >
                  Number of colors
                </label>
                <input
                  type="number"
                  id="numColorsToExtract"
                  value={numColorsToExtract}
                  onChange={(e) =>
                    onNumColorsToExtractChange(
                      Math.max(
                        1,
                        Math.min(
                          currentMaxColorsToExtract,
                          parseInt(e.target.value) || 1,
                        ),
                      ),
                    )
                  }
                  min="1"
                  max={currentMaxColorsToExtract}
                  className={cn(
                    "w-12 px-1 py-0.5 border rounded-md text-xs text-center bg-background border-border focus:ring-1 focus:ring-ring",
                    (!uploadedImageFile ||
                      isExtractingColors ||
                      !canExtractMore ||
                      numColorsToExtract <= 0) &&
                    "opacity-50 cursor-not-allowed",
                  )}
                  disabled={
                    !uploadedImageFile ||
                    isExtractingColors ||
                    !canExtractMore ||
                    numColorsToExtract <= 0
                  }
                />
                <span
                  className={cn(
                    "text-xs text-foreground-muted",
                    (!uploadedImageFile || !canExtractMore) && "opacity-60",
                  )}
                >
                  colors
                </span>
              </div>
              {!canExtractMore && uploadedImageFile && (
                <p className="text-xs text-destructive">
                  Palette full. Remove colors to extract.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    },
  );
