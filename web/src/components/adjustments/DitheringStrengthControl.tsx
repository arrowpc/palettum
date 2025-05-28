import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MIN_DITHERING_STRENGTH,
  MAX_DITHERING_STRENGTH,
  DITHERING_STRENGTH_STEP,
} from "./adjustments.types";

interface DitheringStrengthControlProps {
  currentStrength: number;
  onStrengthChange: (value: number[]) => void;
  isActive: boolean; // True if a dithering method (not 'None') is selected AND palettized mode is active
  isImageUploaded: boolean;
}

export const DitheringStrengthControl: React.FC<
  DitheringStrengthControlProps
> = ({ currentStrength, onStrengthChange, isActive, isImageUploaded }) => {
  return (
    <div
      className={cn(
        "space-y-2 transition-opacity duration-200",
        !isActive && "opacity-60",
      )}
    >
      <Label
        htmlFor="dithering-strength-slider"
        className={cn(
          "block text-center text-xs font-medium",
          !isActive && "cursor-not-allowed",
        )}
      >
        Dithering Strength
      </Label>
      <Slider
        id="dithering-strength-slider"
        min={MIN_DITHERING_STRENGTH}
        max={MAX_DITHERING_STRENGTH}
        step={DITHERING_STRENGTH_STEP}
        value={[currentStrength]}
        onValueChange={onStrengthChange}
        disabled={!isActive}
        className={cn("mt-2", !isActive && "cursor-not-allowed")}
      />
      <div
        className={cn(
          "text-center text-xs text-secondary-foreground",
          !isActive && "cursor-not-allowed",
        )}
      >
        {isActive ? currentStrength.toFixed(2) : "-"}
      </div>
      <p
        className={cn(
          "text-xs text-secondary-foreground text-center",
          !isActive && "cursor-not-allowed",
        )}
      >
        {!isImageUploaded
          ? "Upload an image first"
          : !isActive
            ? "Select a dithering method (other than None) first"
            : "Controls the intensity of the dithering effect"}
      </p>
    </div>
  );
};
