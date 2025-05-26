import React from "react";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SmoothingStyleKey } from "./adjustments.types";
import { SmoothingStyleSelector } from "./SmoothingStyleSelector";
import { LabColorWeights } from "./LabColorWeights";
import { SmoothingStrengthControl } from "./SmoothingStrengthControl";

interface ColorBlendingSettingsProps {
  currentSmoothingStyle: SmoothingStyleKey;
  onSmoothingStyleChange: (style: SmoothingStyleKey) => void;
  currentLabScales: [number, number, number];
  onLabScalesChange: (scales: [number, number, number]) => void;
  currentSmoothingStrength: number;
  onSmoothingStrengthSliderChange: (value: number[]) => void;
  isSmoothedActive: boolean;
  isImageUploaded: boolean;
  usesSmoothed: boolean;
}

export const ColorBlendingSettings: React.FC<ColorBlendingSettingsProps> = ({
  currentSmoothingStyle,
  onSmoothingStyleChange,
  currentLabScales,
  onLabScalesChange,
  currentSmoothingStrength,
  onSmoothingStrengthSliderChange,
  isSmoothedActive,
  isImageUploaded,
  usesSmoothed,
}) => {
  return (
    <div
      className={cn(
        "space-y-6 p-4 rounded-md border",
        isSmoothedActive
          ? "border-primary/30 bg-primary/5"
          : "border-muted bg-muted/5",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Color Blending Settings</h3>
        <Badge variant={isSmoothedActive ? "default" : "outline"}>
          {isSmoothedActive ? "Active" : "Inactive"}
        </Badge>
      </div>
      <div className="space-y-6">
        <TooltipProvider delayDuration={200}>
          <SmoothingStyleSelector
            currentSmoothingStyle={currentSmoothingStyle}
            onSmoothingStyleChange={onSmoothingStyleChange}
            isActive={isSmoothedActive}
            isImageUploaded={isImageUploaded}
            usesSmoothed={usesSmoothed}
          />
        </TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <LabColorWeights
            currentLabScales={currentLabScales}
            onLabScalesChange={onLabScalesChange}
            isActive={isSmoothedActive}
            isImageUploaded={isImageUploaded}
            usesSmoothed={usesSmoothed}
          />
          <SmoothingStrengthControl
            currentSmoothingStrength={currentSmoothingStrength}
            onSmoothingStrengthChange={onSmoothingStrengthSliderChange}
            isActive={isSmoothedActive}
            isImageUploaded={isImageUploaded}
            usesSmoothed={usesSmoothed}
          />
        </div>
      </div>
    </div>
  );
};
