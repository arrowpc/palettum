import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MIN_SMOOTHING_STRENGTH,
  MAX_SMOOTHING_STRENGTH,
  SMOOTHING_STRENGTH_STEP,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface SmoothingStrengthControlProps {
  isActive: boolean;
  isImageUploaded: boolean;
  usesSmoothed: boolean;
}

export const SmoothingStrengthControl: React.FC<
  SmoothingStrengthControlProps
> = ({ isActive, isImageUploaded, usesSmoothed }) => {
  const { shader, setShader } = useShader();
  const { config } = shader;

  const onSmoothingStrengthChange = (value: number[]) => {
    setShader((prev) => ({
      ...prev,
      config: { ...prev.config, smoothingStrength: value[0] },
    }));
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background md:col-span-2">
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
          value={[config.smoothStrength]}
          onValueChange={onSmoothingStrengthChange}
          disabled={!isActive}
          className="mt-2"
        />
        <div className="text-center text-xs text-secondary-foreground">
          {config.smoothStrength?.toFixed(2)}
        </div>
        <p className="text-xs text-secondary-foreground text-center">
          {!isImageUploaded
            ? "Upload an image first"
            : !usesSmoothed
              ? "Requires blend style"
              : "Controls smoothing intensity between colors"}
        </p>
      </div>
    </div>
  );
};
