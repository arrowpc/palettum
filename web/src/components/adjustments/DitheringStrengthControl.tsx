import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MIN_DITHERING_STRENGTH,
  MAX_DITHERING_STRENGTH,
  DITHERING_STRENGTH_STEP,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface DitheringStrengthControlProps {
  isActive: boolean;
  isImageUploaded: boolean;
}

export const DitheringStrengthControl: React.FC<
  DitheringStrengthControlProps
> = ({ isActive, isImageUploaded }) => {
  const { shader, setShader } = useShader();
  const { config } = shader;

  const onStrengthChange = (value: number[]) => {
    setShader((prev) => ({
      ...prev,
      config: { ...prev.config, ditherStrength: value[0] },
    }));
  };

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
        value={[config.ditherStrength || 0]}
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
        {isActive ? config.ditherStrength?.toFixed(2) : "-"}
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
