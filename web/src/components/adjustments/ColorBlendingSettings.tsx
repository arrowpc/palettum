import React from "react";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SmoothingStyleSelector } from "./SmoothingStyleSelector";
import { SmoothingStrengthControl } from "./SmoothingStrengthControl";
import { DynamicGrid } from "./DynamicGrid";

interface ColorBlendingSettingsProps {
  isSmoothedActive: boolean;
  isImageUploaded: boolean;
  usesSmoothed: boolean;
}

export const ColorBlendingSettings: React.FC<ColorBlendingSettingsProps> = ({
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
        <h3 className="text-base font-medium">Blend Settings</h3>
        <Badge variant={isSmoothedActive ? "default" : "outline"}>
          {isSmoothedActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <DynamicGrid>
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <TooltipProvider delayDuration={200}>
            <SmoothingStyleSelector
              isActive={isSmoothedActive}
              isImageUploaded={isImageUploaded}
              usesSmoothed={usesSmoothed}
            />
          </TooltipProvider>
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <SmoothingStrengthControl
            isActive={isSmoothedActive}
            isImageUploaded={isImageUploaded}
            usesSmoothed={usesSmoothed}
          />
        </div>
      </DynamicGrid>
    </div>
  );
};
