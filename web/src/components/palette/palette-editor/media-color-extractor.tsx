import React, { useState } from "react";
import { Upload, CircleX, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface Props {
  onMediaFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  mediaPreviewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  numColorsToExtract: number;
  onNumColorsToExtractChange: (v: number) => void;
  maxExtractable: number;
  onExtractColors: () => void;
  isExtractingColors: boolean;
  canExtractMore: boolean;
  mediaFile: File | null;
  isMobile: boolean;
}

export const MediaColorExtractor: React.FC<Props> = ({
  onMediaFileChange,
  onRemove,
  mediaPreviewUrl,
  fileInputRef,
  numColorsToExtract,
  onNumColorsToExtractChange,
  maxExtractable,
  onExtractColors,
  isExtractingColors,
  canExtractMore,
  mediaFile,
  isMobile,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-4 flex justify-between items-center hover:bg-muted/50 rounded-t-lg">
          <span className="text-sm font-medium">Extract from media</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t p-4 space-y-6">
          {/* Hidden file input */}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={onMediaFileChange}
            ref={fileInputRef}
            className="hidden"
          />

          {mediaPreviewUrl ? (
            <div className="relative">
              <div
                className="border rounded-lg overflow-hidden cursor-pointer bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <img
                  src={mediaPreviewUrl}
                  alt="Preview"
                  className={`w-full object-contain bg-background/50 ${isMobile ? "max-h-32" : "max-h-40"}`}
                />
              </div>
              <CircleX
                aria-label="Clear media"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute -top-2 -right-2 h-8 w-8 fill-primary cursor-pointer hover:opacity-80 transition-opacity z-20"
              />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 hover:border-primary/50 hover:bg-muted/20 cursor-pointer text-center min-h-[120px] flex flex-col items-center justify-center gap-3"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm">Upload Media</p>
              <p className="text-xs text-muted-foreground">
                Images & GIFs supported
              </p>
            </div>
          )}

          {mediaFile && (
            <>
              {canExtractMore ? (
                <>
                  <div className="px-2">
                    <Slider
                      value={[numColorsToExtract]}
                      onValueChange={([v]) => onNumColorsToExtractChange(v)}
                      min={1}
                      max={maxExtractable}
                      step={1}
                      disabled={isExtractingColors}
                      className="w-full"
                    />
                  </div>

                  <Button
                    onClick={onExtractColors}
                    disabled={isExtractingColors}
                    className="w-full"
                    size={isMobile ? "sm" : "default"}
                  >
                    {isExtractingColors ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Extracting...
                      </>
                    ) : (
                      `Extract ${numColorsToExtract} Color${numColorsToExtract !== 1 ? "s" : ""}`
                    )}
                  </Button>
                </>
              ) : (
                <div className="px-3 py-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    Palette is full. Remove some colors to extract more.
                  </p>
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
