import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FormulaSelector } from "./FormulaSelector";
import { FilterSelector } from "./FilterSelector";
import { QuantizationLevelControl } from "./QuantizationLevelControl";
import { DynamicGrid } from "./DynamicGrid";
import { Badge } from "@/components/ui/badge";

interface GeneralSettingsProps {
  isImageUploaded: boolean;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  isImageUploaded,
}) => {
  return (
    <div className="space-y-6 p-4 rounded-md border border-primary/30 bg-primary/5 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">General Settings</h3>
        <Badge variant={isImageUploaded ? "default" : "outline"}>
          {isImageUploaded ? "Active" : "Inactive"}
        </Badge>
      </div>

      <DynamicGrid>
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <TooltipProvider delayDuration={200}>
            <FormulaSelector
              isActive={isImageUploaded}
              isImageUploaded={isImageUploaded}
            />
          </TooltipProvider>
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <QuantizationLevelControl isImageUploaded={isImageUploaded} />
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <TooltipProvider delayDuration={200}>
            <FilterSelector
              isActive={isImageUploaded}
              isImageUploaded={isImageUploaded}
            />
          </TooltipProvider>
        </div>
      </DynamicGrid>
    </div>
  );
};
