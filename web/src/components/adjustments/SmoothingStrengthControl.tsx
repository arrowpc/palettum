import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MIN_SMOOTHING_STRENGTH,
  MAX_SMOOTHING_STRENGTH,
  SMOOTHING_STRENGTH_STEP,
} from "./adjustments.types";

interface SmoothingStrengthControlProps {
  currentSmoothingStrength: number;
  onSmoothingStrengthChange: (value: number[]) => void;
  isActive: boolean;
  isImageUploaded: boolean;
  usesSmoothed: boolean;
}

export const SmoothingStrengthControl: React.FC<
  SmoothingStrengthControlProps
> = ({
  currentSmoothingStrength,
  onSmoothingStrengthChange,
  isActive,
  isImageUploaded,
  usesSmoothed,
}) => {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className={cn("space-y-2", !isActive && "opacity-60")}>
        <Label
          htmlFor="strength-slider"
          className="block text-center text-xs font-medium"
        >
          Smoothing Strength
        </Label>
        <Slider
          id="strength-slider"
          min={MIN_SMOOTHING_STRENGTH}
          max={MAX_SMOOTHING_STRENGTH}
          step={SMOOTHING_STRENGTH_STEP}
          value={[currentSmoothingStrength]}
          onValueChange={onSmoothingStrengthChange}
          disabled={!isActive}
          className="mt-2"
        />
        <div className="text-center text-xs text-secondary-foreground">
          {currentSmoothingStrength.toFixed(2)}
        </div>
        <p className="text-xs text-secondary-foreground text-center">
          {!isImageUploaded
            ? "Upload an image first"
            : !usesSmoothed
              ? "Requires blend mode"
              : "Controls smoothing intensity between colors"}
        </p>
      </div>
    </div>
  );
};
