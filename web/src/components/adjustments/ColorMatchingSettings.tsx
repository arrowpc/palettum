import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DitheringKey, DITHERING_NONE } from "./adjustments.types";
import { TransparencyControl } from "./TransparencyControl";
import { DitheringSelector } from "./DitheringSelector";
import { DitheringStrengthControl } from "./DitheringStrengthControl";
import { DynamicGrid } from "./DynamicGrid";

interface ColorMatchingSettingsProps {
  currentThreshold: number;
  onThresholdSliderChange: (value: number[]) => void;
  transparencyEnabled: boolean;
  onTransparencySwitchChange: (checked: boolean) => void;
  isPalettizedActive: boolean;
  isImageUploaded: boolean;
  usesPalettized: boolean;
  imageSupportsTransparency: boolean;
  currentDitheringStyle: DitheringKey;
  onDitheringStyleChange: (style: DitheringKey) => void;
  currentDitheringStrength: number;
  onDitheringStrengthSliderChange: (value: number[]) => void;
}

export const ColorMatchingSettings: React.FC<ColorMatchingSettingsProps> = ({
  currentThreshold,
  onThresholdSliderChange,
  transparencyEnabled,
  onTransparencySwitchChange,
  isPalettizedActive,
  isImageUploaded,
  usesPalettized,
  imageSupportsTransparency,
  currentDitheringStyle,
  onDitheringStyleChange,
  currentDitheringStrength,
  onDitheringStrengthSliderChange,
}) => {
  const isDitheringStrengthControlActive =
    isPalettizedActive && currentDitheringStyle !== DITHERING_NONE;

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
            currentThreshold={currentThreshold}
            onThresholdChange={onThresholdSliderChange}
            transparencyEnabled={transparencyEnabled}
            onTransparencySwitchChange={onTransparencySwitchChange}
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
            currentDitheringStyle={currentDitheringStyle}
            onDitheringStyleChange={onDitheringStyleChange}
            isActive={isPalettizedActive}
            isImageUploaded={isImageUploaded}
          />
        </div>
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <DitheringStrengthControl
            currentStrength={currentDitheringStrength}
            onStrengthChange={onDitheringStrengthSliderChange}
            isActive={isDitheringStrengthControlActive}
            isImageUploaded={isImageUploaded}
          />
        </div>
      </DynamicGrid>
    </div>
  );
};
