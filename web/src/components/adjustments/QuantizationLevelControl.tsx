import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MIN_QUANT_LEVEL,
  MAX_QUANT_LEVEL,
  QUANT_LEVEL_STEP,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface QuantizationLevelControlProps {
  isImageUploaded: boolean;
}

export const QuantizationLevelControl: React.FC<
  QuantizationLevelControlProps
> = ({ isImageUploaded }) => {
  const { shader, setShader } = useShader();
  const { config } = shader;
  const isActive = isImageUploaded;

  const onQuantLevelChange = (value: number[]) => {
    setShader((prev) => ({
      ...prev,
      config: { ...prev.config, quantLevel: value[0] },
    }));
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background md:col-span-2">
      <div className={cn("space-y-2", !isActive && "opacity-60")}>
        <Label
          htmlFor="quant-level-slider"
          className="block text-center text-xs font-medium"
        >
          Quantization Level
        </Label>
        <Slider
          id="quant-level-slider"
          min={MIN_QUANT_LEVEL}
          max={MAX_QUANT_LEVEL}
          step={QUANT_LEVEL_STEP}
          value={[config.quantLevel || 0]}
          onValueChange={onQuantLevelChange}
          disabled={!isActive}
          className="mt-2"
        />
        <div className="text-center text-xs text-secondary-foreground">
          {isActive ? config.quantLevel : "-"}
        </div>
        <p className="text-xs text-secondary-foreground text-center">
          {!isImageUploaded
            ? "Upload an image first"
            : "Higher is faster but slightly less accurate (0 for highest quality)"}
        </p>
      </div>
    </div>
  );
};
