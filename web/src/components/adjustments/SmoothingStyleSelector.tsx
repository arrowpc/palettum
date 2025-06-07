import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  SmoothingStyleKey,
  SMOOTHING_STYLE_OPTIONS,
  SMOOTHING_STYLE_NAMES,
  SMOOTHING_STYLE_TOOLTIPS,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface SmoothingStyleSelectorProps {
  isActive: boolean;
  isImageUploaded: boolean;
  usesSmoothed: boolean;
}

export const SmoothingStyleSelector: React.FC<SmoothingStyleSelectorProps> = ({
  isActive,
  isImageUploaded,
  usesSmoothed,
}) => {
  const { shader, setShader } = useShader();
  const { config } = shader;

  const onSmoothingStyleChange = (style: SmoothingStyleKey) => {
    setShader((prev) => ({
      ...prev,
      config: { ...prev.config, smoothFormula: style },
    }));
  };

  return (
    <div className="space-y-3">
      <Label
        className={cn(
          "block text-center text-xs font-medium",
          !isActive && "opacity-60",
        )}
      >
        Smoothing Style
      </Label>
      <div className="flex flex-wrap gap-2 justify-center">
        {SMOOTHING_STYLE_OPTIONS.map((option) => (
          <Tooltip key={option}>
            <TooltipTrigger asChild>
              <Button
                variant={
                  config.smoothFormula === option ? "default" : "outline"
                }
                size="sm"
                onClick={() => onSmoothingStyleChange(option)}
                disabled={!isActive}
                className={cn(!isActive && "opacity-60 cursor-not-allowed")}
              >
                {SMOOTHING_STYLE_NAMES[option]}
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="center"
              className="max-w-[200px] text-center"
            >
              {!isImageUploaded
                ? "Upload an image first"
                : !usesSmoothed
                  ? "Requires blend mode"
                  : SMOOTHING_STYLE_TOOLTIPS[option]}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
