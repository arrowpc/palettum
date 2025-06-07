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
  FormulaKey,
  FORMULA_OPTIONS,
  FORMULA_TOOLTIPS,
} from "./adjustments.types";
import { useShader } from "@/ShaderContext";

interface FormulaSelectorProps {
  isActive: boolean;
  isImageUploaded: boolean;
}

export const FormulaSelector: React.FC<FormulaSelectorProps> = ({
  isActive,
  isImageUploaded,
}) => {
  const { shader, setShader } = useShader();
  const { config } = shader;

  const onFormulaChange = (formula: FormulaKey) => {
    setShader((prev) => ({
      ...prev,
      config: { ...prev.config, diffFormula: formula },
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
        Color Difference Formula
      </Label>
      <div className="flex flex-wrap gap-2 justify-center">
        {FORMULA_OPTIONS.map((option) => (
          <Tooltip key={option}>
            <TooltipTrigger asChild>
              <Button
                variant={config.diffFormula === option ? "default" : "outline"}
                size="sm"
                onClick={() => onFormulaChange(option)}
                disabled={!isActive}
                className={cn(!isActive && "opacity-60 cursor-not-allowed")}
              >
                {option}
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="center"
              className="max-w-[200px] text-center"
            >
              {!isImageUploaded
                ? "Upload an image first"
                : FORMULA_TOOLTIPS[option]}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
