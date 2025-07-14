import React from "react";
import { cn } from "@/lib/utils";
// import SharedImagePreview from "../SharedImagePreview";
import { ImageIcon } from "lucide-react";

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
      const handleUploadPlaceholderClick = () => {
        if (!isExtractingColors && canExtractMore && fileInputRef.current) {
          fileInputRef.current.click();
        }
      };

      const previewIsInteractive = !isExtractingColors && canExtractMore;

      const previewTitle =
        !canExtractMore && uploadedImageFile
          ? "Palette full, cannot change image"
          : imagePreviewUrl
            ? "Click to view full size or change image"
            : "Click to upload image";

      return (
        <div className="p-3 border border-border/70 rounded-md bg-secondary/20 space-y-3">
          <div
            className={cn(
              "flex gap-3",
              isMobile ? "items-start" : "flex-col items-center",
            )}
          >
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
                  className="text-xs text-muted-foreground sr-only"
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
                    "text-xs text-muted-foreground",
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

ImageColorExtractor.displayName = "ImageColorExtractor";
