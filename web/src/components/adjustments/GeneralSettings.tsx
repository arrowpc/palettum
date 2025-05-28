import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FilterKey, FormulaKey } from "./adjustments.types";
import { FormulaSelector } from "./FormulaSelector";
import { FilterSelector } from "./FilterSelector";
import { QuantizationLevelControl } from "./QuantizationLevelControl";
import { DynamicGrid } from "./DynamicGrid";
import { Filter } from "@/wasm/pkg/wasm";
import { Badge } from "@/components/ui/badge";

interface GeneralSettingsProps {
  currentFormula: FormulaKey;
  onFormulaChange: (formula: FormulaKey) => void;
  currentQuantLevel: number;
  onQuantLevelChange: (value: number[]) => void;
  isImageUploaded: boolean;
  currentFilter: Filter;
  onFilterChange: (filter: FilterKey) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  currentFormula,
  onFormulaChange,
  currentQuantLevel,
  onQuantLevelChange,
  isImageUploaded,
  currentFilter,
  onFilterChange,
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
              currentFormula={currentFormula}
              onFormulaChange={onFormulaChange}
              isActive={isImageUploaded}
              isImageUploaded={isImageUploaded}
            />
          </TooltipProvider>
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <QuantizationLevelControl
            currentQuantLevel={currentQuantLevel}
            onQuantLevelChange={onQuantLevelChange}
            isImageUploaded={isImageUploaded}
          />
        </div>

        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <TooltipProvider delayDuration={200}>
            <FilterSelector
              currentFilter={currentFilter}
              onFilterChange={onFilterChange}
              isActive={isImageUploaded}
              isImageUploaded={isImageUploaded}
            />
          </TooltipProvider>
        </div>
      </DynamicGrid>
    </div>
  );
};
