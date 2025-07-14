import React from "react";
import { Trash2, Plus, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cn,
  rgbToHex,
  getContrastColor,
  getOppositeTextColor,
} from "@/lib/utils";
import { type Rgb } from "palettum";

interface ColorTileProps {
  color: Rgb;
  isMobile: boolean;
  isSuggested?: boolean;
  addSuggestedToPalette?: (color: Rgb) => void;
  dismissSpecificSuggestion?: (color: Rgb) => void;
  itemIndex?: number;
  removeFromPaletteByIndex?: (index: number) => void;
}

export const ColorTile = React.memo(function ColorTile({
  color,
  isMobile,
  isSuggested,
  addSuggestedToPalette,
  dismissSpecificSuggestion,
  itemIndex,
  removeFromPaletteByIndex,
}: ColorTileProps) {
  const hex = rgbToHex(color);

  const buttonBg = getContrastColor(color, 0.8);
  const iconColor = getOppositeTextColor(color);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={50}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative group aspect-square rounded-lg shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden",
              isSuggested
                ? "border border-transparent"
                : "border border-border",
            )}
            style={{ backgroundColor: hex }}
          >
            {isSuggested && (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-lg overflow-hidden">
                <div
                  className={cn("absolute inset-0 rounded-lg animate-rotate")}
                  style={{
                    background: `conic-gradient(
                      ${getContrastColor(color, 0.7)} 60deg,
                      transparent 360deg
                    )`,
                  }}
                />
                <div
                  className="absolute inset-[2px] rounded-md"
                  style={{ backgroundColor: hex }}
                />
              </div>
            )}

            {isSuggested ? (
              isMobile ? (
                // Mobile: Only show "+" button, centered
                <div className="absolute inset-0 flex items-center justify-center z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addSuggestedToPalette?.(color);
                    }}
                    className="p-1.5 rounded-full shadow-sm"
                    style={{ background: buttonBg }}
                    title="Add to palette"
                  >
                    <Plus className="w-4 h-4" style={{ color: iconColor }} />
                  </button>
                </div>
              ) : (
                // Desktop: Show both "+" and "X" on hover, centered
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addSuggestedToPalette?.(color);
                    }}
                    className="p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform duration-150"
                    style={{ background: buttonBg }}
                    title="Add to palette"
                  >
                    <Plus className="w-4 h-4" style={{ color: iconColor }} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissSpecificSuggestion?.(color);
                    }}
                    className="p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform duration-150"
                    style={{ background: buttonBg }}
                    title="Dismiss suggestion"
                  >
                    <X className="w-4 h-4" style={{ color: iconColor }} />
                  </button>
                </div>
              )
            ) : !isSuggested &&
              removeFromPaletteByIndex &&
              itemIndex !== undefined ? (
              // For palette colors: show trash on hover (desktop) or always (mobile)
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center z-30",
                  isMobile
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                )}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromPaletteByIndex(itemIndex);
                  }}
                  className="p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform duration-150"
                  style={{ background: buttonBg }}
                  title="Remove from palette"
                >
                  <Trash2 className="w-4 h-4" style={{ color: iconColor }} />
                </button>
              </div>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-popover text-popover-foreground px-2 py-1 text-sm rounded shadow-lg"
        >
          {color.r}, {color.g}, {color.b}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
