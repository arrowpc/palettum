import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FormulaKey } from "./adjustments.types";
import { FormulaSelector } from "./FormulaSelector";
import { QuantizationLevelControl } from "./QuantizationLevelControl";

interface GeneralSettingsProps {
  currentFormula: FormulaKey;
  onFormulaChange: (formula: FormulaKey) => void;
  currentQuantLevel: number;
  onQuantLevelChange: (value: number[]) => void;
  isImageUploaded: boolean;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  currentFormula,
  onFormulaChange,
  currentQuantLevel,
  onQuantLevelChange,
  isImageUploaded,
}) => {
  return (
    <div className="space-y-6 p-4 rounded-md border border-primary/30 bg-primary/5 mb-6">
      <h3 className="text-base font-medium text-center">General Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <TooltipProvider delayDuration={200}>
            <FormulaSelector
              currentFormula={currentFormula}
              onFormulaChange={onFormulaChange}
              isActive={isImageUploaded} // Formula selector active if image is uploaded
              isImageUploaded={isImageUploaded}
            />
          </TooltipProvider>
        </div>
        <QuantizationLevelControl
          currentQuantLevel={currentQuantLevel}
          onQuantLevelChange={onQuantLevelChange}
          isImageUploaded={isImageUploaded}
        />
      </div>
    </div>
  );
};
