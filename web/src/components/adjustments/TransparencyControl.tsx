import React, { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MIN_THRESHOLD,
  MAX_THRESHOLD,
  DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface TransparencyControlProps {
  isControlDisabled: boolean;
  imageSupportsTransparency: boolean;
  isImageUploaded: boolean;
  usesPalettized: boolean;
}

export const TransparencyControl: React.FC<TransparencyControlProps> = ({
  isControlDisabled,
  imageSupportsTransparency,
  isImageUploaded,
  usesPalettized,
}) => {
  const { shader, setShader } = useShader();
  const { config } = shader;
  const [transparencyEnabled, setTransparencyEnabled] = useState(
    (config.transparencyThreshold ?? 0) > 0,
  );

  useEffect(() => {
    setTransparencyEnabled((config.transparencyThreshold ?? 0) > 0);
  }, [config.transparencyThreshold]);

  const onThresholdChange = useCallback(
    (value: number[]) => {
      setShader((prev) => ({
        ...prev,
        config: { ...prev.config, transparencyThreshold: value[0] },
      }));
    },
    [setShader],
  );

  const onTransparencySwitchChange = useCallback(
    (checked: boolean) => {
      setShader((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          transparencyThreshold: checked
            ? Math.max(MIN_THRESHOLD, DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED)
            : 0,
        },
      }));
    },
    [setShader],
  );

  return (
    <div
      className={cn(
        "space-y-4 transition-opacity duration-200",
        isControlDisabled && transparencyEnabled && "opacity-60", // Keep visible if enabled but parent inactive
        isControlDisabled && !transparencyEnabled && "opacity-60",
      )}
    >
      <div className="flex justify-center items-center gap-2 mb-2">
        <Switch
          id="transparency-switch"
          checked={transparencyEnabled}
          onCheckedChange={onTransparencySwitchChange}
          disabled={isControlDisabled}
          className={cn(isControlDisabled && "opacity-60")}
        />
        <Label
          htmlFor="transparency-switch"
          className={cn(
            "text-xs font-medium",
            isControlDisabled && "opacity-60 cursor-not-allowed",
          )}
        >
          Transparency
        </Label>
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="transparency-slider"
          className={cn(
            "block text-center text-xs",
            (isControlDisabled || !transparencyEnabled) && "opacity-60",
          )}
        >
          Alpha Threshold
        </Label>
        <Slider
          id="transparency-slider"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          step={1}
          value={[config.transparencyThreshold ?? 0]}
          onValueChange={onThresholdChange}
          disabled={isControlDisabled || !transparencyEnabled}
          className={cn(
            "w-full",
            (isControlDisabled || !transparencyEnabled) && "opacity-60",
          )}
        />
        <div className="text-center text-xs text-secondary-foreground">
          {!isImageUploaded
            ? "Upload an image first"
            : !usesPalettized
              ? "Requires match style"
              : !imageSupportsTransparency
                ? "Current image has no transparency"
                : transparencyEnabled
                  ? `Pixels with alpha < ${config.transparencyThreshold} become transparent`
                  : "Transparency disabled"}
        </div>
      </div>
    </div>
  );
};
