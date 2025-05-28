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
  FilterKey,
  FILTER_OPTIONS,
  FILTER_TOOLTIPS,
} from "./adjustments.types";

interface FilterSelectorProps {
  currentFilter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  isActive: boolean;
  isImageUploaded: boolean;
}

export const FilterSelector: React.FC<FilterSelectorProps> = ({
  currentFilter,
  onFilterChange,
  isActive,
  isImageUploaded,
}) => {
  return (
    <div
      className={cn(
        "space-y-4 transition-opacity duration-200",
        !isActive && "opacity-60",
      )}
    >
      <Label className="block text-center text-xs font-medium">
        Resize Filter
      </Label>
      <div className="flex flex-wrap gap-2 justify-center">
        {FILTER_OPTIONS.map((option) => (
          <Tooltip key={option}>
            <TooltipTrigger asChild>
              <Button
                variant={currentFilter === option ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange(option)}
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
                : FILTER_TOOLTIPS[option]}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
