import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DitheringKey,
  DITHERING_OPTIONS,
  DITHERING_NAMES,
  DITHERING_TOOLTIPS,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface DitheringSelectorProps {
  isActive: boolean;
  isImageUploaded: boolean;
}

export const DitheringSelector: React.FC<DitheringSelectorProps> = ({
  isActive,
  isImageUploaded,
}) => {
  const { shader, setShader } = useShader();
  const { config } = shader;

  const onDitheringStyleChange = (style: DitheringKey) => {
    setShader((prev) => ({
      ...prev,
      config: { ...prev.config, ditherAlgorithm: style },
    }));
  };

  return (
    <div
      className={cn(
        "space-y-4 transition-opacity duration-200",
        !isActive && "opacity-60",
      )}
    >
      <Label className="block text-center text-xs font-medium">
        Dithering Style
      </Label>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap gap-2 justify-center">
          {DITHERING_OPTIONS.map((option) => (
            <Tooltip key={option}>
              <TooltipTrigger asChild>
                <Button
                  variant={
                    config.ditherAlgorithm === option ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => onDitheringStyleChange(option)}
                  disabled={!isActive}
                  className={cn(!isActive && "opacity-60 cursor-not-allowed")}
                >
                  {DITHERING_NAMES[option]}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="center"
                className="max-w-[220px] text-center"
              >
                {!isImageUploaded
                  ? "Upload an image first"
                  : !isActive
                    ? "Requires match style"
                    : DITHERING_TOOLTIPS[option]}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
};
