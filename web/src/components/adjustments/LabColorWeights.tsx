import React, { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MIN_SMOOTHED_SCALE,
  MAX_SMOOTHED_SCALE,
  SMOOTHED_SCALE_STEP,
  DEFAULT_SMOOTHED_SCALE,
} from "./adjustments.types";

interface LabColorWeightsProps {
  currentLabScales: [number, number, number];
  onLabScalesChange: (scales: [number, number, number]) => void;
  isActive: boolean;
  isImageUploaded: boolean;
  usesSmoothed: boolean;
}

const sliderHeight = 100;
const labLabels = ["L", "a", "b"];
const labGradients = [
  "linear-gradient(to top, white 0%, black 100%)",
  "linear-gradient(to bottom, #f87171 0%, #4ade80 100%)",
  "linear-gradient(to top, #60a5fa  0%, #facc15 100%)",
];

export const LabColorWeights: React.FC<LabColorWeightsProps> = ({
  currentLabScales,
  onLabScalesChange,
  isActive,
  isImageUploaded,
  usesSmoothed,
}) => {
  const handleLabScaleChange = useCallback(
    (index: 0 | 1 | 2, value: number) => {
      const newScales: [number, number, number] = [...currentLabScales];
      newScales[index] = value;
      onLabScalesChange(newScales);
    },
    [currentLabScales, onLabScalesChange],
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <h3
        className={cn(
          "text-xs font-medium text-center",
          !isActive && "opacity-60",
        )}
      >
        LAB Color Component Weights
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {([0, 1, 2] as const).map((index) => (
          <div key={index} className="flex flex-col items-center">
            <div
              className={cn(
                "flex items-center justify-center mb-2",
                !isActive && "opacity-60",
              )}
            >
              <span className="text-xs">{labLabels[index]}</span>
            </div>
            <div
              className="relative flex justify-center mb-2"
              style={{ height: sliderHeight }}
            >
              <div className="flex items-center justify-center">
                <Slider
                  orientation="vertical"
                  min={Math.log10(MIN_SMOOTHED_SCALE)}
                  max={Math.log10(MAX_SMOOTHED_SCALE)}
                  step={0.01} // For smoother log scale adjustment
                  value={[Math.log10(currentLabScales[index])]}
                  onValueChange={(v) => {
                    const actualValue = Math.pow(10, v[0]);
                    handleLabScaleChange(index, actualValue);
                  }}
                  disabled={!isActive}
                  // @ts-ignore - gradient is a custom prop for styling
                  gradient={labGradients[index]}
                  style={{ height: sliderHeight }}
                  className={cn(!isActive && "opacity-60")}
                />
              </div>
            </div>
            <div className="flex flex-col items-center mt-1">
              <Input
                type="number"
                min={MIN_SMOOTHED_SCALE}
                max={MAX_SMOOTHED_SCALE}
                step={SMOOTHED_SCALE_STEP}
                value={currentLabScales[index].toFixed(1)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (
                    !isNaN(val) &&
                    val >= MIN_SMOOTHED_SCALE &&
                    val <= MAX_SMOOTHED_SCALE
                  ) {
                    handleLabScaleChange(index, val);
                  }
                }}
                className={cn(
                  "h-7 w-16 text-center text-xs mb-1",
                  !isActive && "opacity-60",
                )}
                disabled={!isActive}
              />
              {currentLabScales[index] !== DEFAULT_SMOOTHED_SCALE && (
                <button
                  onClick={() =>
                    handleLabScaleChange(index, DEFAULT_SMOOTHED_SCALE)
                  }
                  className={cn(
                    "text-xs text-primary",
                    !isActive && "opacity-60 cursor-not-allowed",
                  )}
                  disabled={!isActive}
                >
                  Reset
                </button>
              )}
              {currentLabScales[index] === DEFAULT_SMOOTHED_SCALE && (
                <span
                  className={cn(
                    "text-xs text-secondary-foreground",
                    !isActive && "opacity-60",
                  )}
                >
                  Default
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "space-y-4 transition-opacity duration-200",
          !isActive && "opacity-60",
        )}
      >
        <p className="text-xs text-secondary-foreground text-center mt-2">
          {!isImageUploaded
            ? "Upload an image first"
            : !usesSmoothed
              ? "Requires blend mode"
              : "Higher values increase component influence, 1.0 is default"}
        </p>
      </div>
    </div>
  );
};
