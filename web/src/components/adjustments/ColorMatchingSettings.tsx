import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DitheringKey, DITHERING_NONE } from "./adjustments.types";
import { TransparencyControl } from "./TransparencyControl";
import { DitheringSelector } from "./DitheringSelector";
import { DitheringStrengthControl } from "./DitheringStrengthControl";

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
  const isTransparencyControlDisabled =
    !isPalettizedActive || !imageSupportsTransparency;

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
        <h3 className="text-base font-medium">Color Matching Settings</h3>
        <Badge variant={isPalettizedActive ? "default" : "outline"}>
          {isPalettizedActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="space-y-4 p-4 border rounded-lg bg-background">
        <TransparencyControl
          currentThreshold={currentThreshold}
          onThresholdChange={onThresholdSliderChange}
          transparencyEnabled={transparencyEnabled}
          onTransparencySwitchChange={onTransparencySwitchChange}
          isControlDisabled={isTransparencyControlDisabled}
          imageSupportsTransparency={imageSupportsTransparency}
          isImageUploaded={isImageUploaded}
          usesPalettized={usesPalettized}
        />
      </div>

      <div className="space-y-6 p-4 border rounded-lg bg-background">
        <DitheringSelector
          currentDitheringStyle={currentDitheringStyle}
          onDitheringStyleChange={onDitheringStyleChange}
          isActive={isPalettizedActive}
          isImageUploaded={isImageUploaded}
        />
        <DitheringStrengthControl
          currentStrength={currentDitheringStrength}
          onStrengthChange={onDitheringStrengthSliderChange}
          isActive={isDitheringStrengthControlActive}
          isImageUploaded={isImageUploaded}
        />
      </div>
    </div>
  );
};
