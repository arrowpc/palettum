import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DITHERING_NONE } from "./adjustments.types";
import { TransparencyControl } from "./TransparencyControl";
import { DitheringSelector } from "./DitheringSelector";
import { DitheringStrengthControl } from "./DitheringStrengthControl";
import { DynamicGrid } from "./DynamicGrid";
import { useShader } from "@/ShaderContext";

interface ColorMatchingSettingsProps {
  isPalettizedActive: boolean;
  isImageUploaded: boolean;
  usesPalettized: boolean;
  imageSupportsTransparency: boolean;
}

export const ColorMatchingSettings: React.FC<ColorMatchingSettingsProps> = ({
  isPalettizedActive,
  isImageUploaded,
  usesPalettized,
  imageSupportsTransparency,
}) => {
  const { shader } = useShader();
  const { config } = shader;

  const isDitheringStrengthControlActive =
    isPalettizedActive && config.ditherAlgorithm !== DITHERING_NONE;

  return (
    <div
      className={cn(
        "space-y-6 p-4 rounded-md border",
        isPalettizedActive
          ? "border-primary/30 bg-primary/5"
          : "border-muted bg-muted/5",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Match Settings</h3>
        <Badge variant={isPalettizedActive ? "default" : "outline"}>
          {isPalettizedActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <DynamicGrid>
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <TransparencyControl
            isControlDisabled={
              !isPalettizedActive || !imageSupportsTransparency
            }
            imageSupportsTransparency={imageSupportsTransparency}
            isImageUploaded={isImageUploaded}
            usesPalettized={usesPalettized}
          />
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <DitheringSelector
            isActive={isPalettizedActive}
            isImageUploaded={isImageUploaded}
          />
        </div>
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <DitheringStrengthControl
            isActive={isDitheringStrengthControlActive}
            isImageUploaded={isImageUploaded}
          />
        </div>
      </DynamicGrid>
    </div>
  );
};
