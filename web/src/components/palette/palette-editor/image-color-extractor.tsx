import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ImageColorExtractorProps {
  onImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  imagePreviewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  numColorsToExtract: number;
  onNumColorsToExtractChange: (value: number) => void;
  currentMaxColorsToExtract: number;
  onExtractColors: () => void;
  isExtractingColors: boolean;
  canExtractMore: boolean;
  uploadedImageFile: File | null;
  isMobile: boolean;
}

export const ImageColorExtractor: React.FC<ImageColorExtractorProps> = ({
  onImageFileChange,
  onRemoveImage,
  imagePreviewUrl,
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
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="image-upload"
          className="text-sm font-medium cursor-pointer hover:text-primary"
        >
          Upload Image/GIF
        </Label>
        <Input
          id="image-upload"
          type="file"
          accept="image/png, image/jpeg, image/gif"
          onChange={onImageFileChange}
          ref={fileInputRef}
          className="hidden"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse
        </Button>
      </div>

      {imagePreviewUrl && uploadedImageFile && (
        <div className="relative group aspect-video bg-muted rounded-md overflow-hidden">
          <img
            src={imagePreviewUrl}
            alt="Preview"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="destructive" size="sm" onClick={onRemoveImage}>
              Remove
            </Button>
          </div>
        </div>
      )}

      {uploadedImageFile && canExtractMore && (
        <div className="space-y-4 pt-2">
          <div className="space-y-3">
            <Label className="flex items-center justify-between">
              <span>Colors to Extract</span>
              <span className="text-sm font-normal bg-muted px-2 py-1 rounded-md">
                {numColorsToExtract}
              </span>
            </Label>
            <Slider
              value={[numColorsToExtract]}
              onValueChange={([val]) => onNumColorsToExtractChange(val)}
              min={1}
              max={currentMaxColorsToExtract}
              step={1}
              disabled={isExtractingColors}
            />
          </div>
          <Button
            onClick={onExtractColors}
            disabled={isExtractingColors || !uploadedImageFile}
            className="w-full"
            size={isMobile ? "sm" : "default"}
          >
            {isExtractingColors ? "Extracting..." : "Extract Colors"}
          </Button>
        </div>
      )}

      {!canExtractMore && uploadedImageFile && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          Palette is full. Cannot extract more colors.
        </p>
      )}
    </div>
  );
};
