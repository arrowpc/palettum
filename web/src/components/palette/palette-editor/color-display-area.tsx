import React from "react";
import { cn } from "@/lib/utils";
import { ColorTile } from "./color-tile";
import { AddColorButton } from "./add-color-button";
import { type Rgb } from "palettum";
import { rgbToHex, LIMITS } from "@/lib/utils";

interface ColorDisplayAreaProps {
  paletteColors: Rgb[];
  suggestedColors: Rgb[];
  hexValueSelected: string;
  onAddSelectedColorToPalette: () => void;
  onRemoveFromPalette: (index: number) => void;
  onAddSuggestedToPalette: (color: Rgb) => void;
  onDismissSuggestion: (color: Rgb) => void;
  onAcceptAllSuggestions: () => void;
  onRejectAllSuggestions: () => void;
  isMobile: boolean;
}

export const ColorDisplayArea = React.memo(function ColorDisplayArea({
  paletteColors,
  suggestedColors,
  hexValueSelected,
  onAddSelectedColorToPalette,
  onRemoveFromPalette,
  onAddSuggestedToPalette,
  onDismissSuggestion,
  onAcceptAllSuggestions,
  onRejectAllSuggestions,
  isMobile,
}: ColorDisplayAreaProps) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col",
        isMobile ? "order-2" : "order-1",
      )}
    >
      {suggestedColors.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          <button
            onClick={onAcceptAllSuggestions}
            className="text-xs px-2 py-1 rounded border border-primary text-primary hover:bg-primary/10 transition-colors"
            title={`Add all ${suggestedColors.length} suggested colors to palette`}
          >
            Accept All
          </button>
          <button
            onClick={onRejectAllSuggestions}
            className="text-xs px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
            title={`Dismiss all ${suggestedColors.length} suggested colors`}
          >
            Reject All
          </button>
        </div>
      )}
      <div className="overflow-y-auto pr-1 scrollbar-thin flex-grow">
        <div
          className="grid gap-2 auto-rows-min pb-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "56px" : "72px"}, 1fr))`,
          }}
        >
          <AddColorButton
            color={hexValueSelected}
            onClick={onAddSelectedColorToPalette}
            disabled={paletteColors.length >= LIMITS.MAX_COLORS}
          />
          {suggestedColors.map((color, loopIndex) => (
            <ColorTile
              key={`suggested-${rgbToHex(color)}-${loopIndex}`}
              color={color}
              isMobile={isMobile}
              isSuggested
              addSuggestedToPalette={onAddSuggestedToPalette}
              dismissSpecificSuggestion={onDismissSuggestion}
            />
          ))}
          {paletteColors.map((color, index) => (
            <ColorTile
              key={`palette-${rgbToHex(color)}-${index}`}
              color={color}
              isMobile={isMobile}
              itemIndex={index}
              removeFromPaletteByIndex={onRemoveFromPalette}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
