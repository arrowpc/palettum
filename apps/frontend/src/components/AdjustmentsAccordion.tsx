import { useState, useEffect, useCallback } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const MAPPING_PALETTIZED = "Palettized";
export const MAPPING_SMOOTHED = "Smoothed";
export const MAPPING_SMOOTHED_PALETTIZED = "SmoothedPalettized";
export type MappingKey =
  | typeof MAPPING_PALETTIZED
  | typeof MAPPING_SMOOTHED
  | typeof MAPPING_SMOOTHED_PALETTIZED;

export const FORMULA_CIEDE2000 = "CIEDE2000";
export const FORMULA_CIE94 = "CIE94";
export const FORMULA_CIE76 = "CIE76";
export type FormulaKey =
  | typeof FORMULA_CIEDE2000
  | typeof FORMULA_CIE94
  | typeof FORMULA_CIE76;

const FORMULA_OPTIONS: FormulaKey[] = [
  FORMULA_CIEDE2000,
  FORMULA_CIE94,
  FORMULA_CIE76,
];
const FORMULA_TOOLTIPS: Record<FormulaKey, string> = {
  [FORMULA_CIEDE2000]: "Most accurate color matching (slower)",
  [FORMULA_CIE94]: "Good balance of accuracy and speed",
  [FORMULA_CIE76]: "Fastest color matching (less accurate)",
};

export const WEIGHTING_KERNEL_GAUSSIAN = "Gaussian";
export const WEIGHTING_KERNEL_INVERSE_DISTANCE_POWER = "InverseDistancePower";
export type WeightingKernelKey =
  | typeof WEIGHTING_KERNEL_GAUSSIAN
  | typeof WEIGHTING_KERNEL_INVERSE_DISTANCE_POWER;

const WEIGHTING_KERNEL_OPTIONS: WeightingKernelKey[] = [
  WEIGHTING_KERNEL_INVERSE_DISTANCE_POWER,
  WEIGHTING_KERNEL_GAUSSIAN,
];
const WEIGHTING_KERNEL_NAMES: Record<WeightingKernelKey, string> = {
  [WEIGHTING_KERNEL_GAUSSIAN]: "Gaussian",
  [WEIGHTING_KERNEL_INVERSE_DISTANCE_POWER]: "Inverse Distance",
};
const WEIGHTING_KERNEL_TOOLTIPS: Record<WeightingKernelKey, string> = {
  [WEIGHTING_KERNEL_GAUSSIAN]: "Smooth falloff with bell curve distribution",
  [WEIGHTING_KERNEL_INVERSE_DISTANCE_POWER]:
    "Sharper falloff with more defined color transitions",
};

const DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED = 128;
const MAX_THRESHOLD = 255;
const MIN_THRESHOLD = 1;

const MIN_SMOOTHED_SCALE = 0.1;
const MAX_SMOOTHED_SCALE = 10.0;
const SMOOTHED_SCALE_STEP = 0.1;
const DEFAULT_SMOOTHED_SCALE = 1.0;
const MIN_SMOOTHED_SHAPE = 0.02;
const MAX_SMOOTHED_SHAPE = 0.2;
const SMOOTHED_SHAPE_STEP = 0.01;
const MIN_SMOOTHED_POWER = 2.0;
const MAX_SMOOTHED_POWER = 5.0;
const SMOOTHED_POWER_STEP = 0.1;

interface AdjustmentsAccordionProps {
  file: File | null;
  currentMapping: MappingKey;
  currentFormula: FormulaKey;
  currentWeightingKernel: WeightingKernelKey;
  currentThreshold: number;
  currentLabScales: [number, number, number];
  currentShapeParam: number;
  currentPowerParam: number;
  onMappingChange: (mapping: MappingKey) => void;
  onFormulaChange: (formula: FormulaKey) => void;
  onWeightingKernelChange: (kernel: WeightingKernelKey) => void;
  onThresholdChange: (threshold: number) => void;
  onLabScalesChange: (scales: [number, number, number]) => void;
  onShapeParamChange: (shape: number) => void;
  onPowerParamChange: (power: number) => void;
}

const AdjustmentsAccordion: React.FC<AdjustmentsAccordionProps> = ({
  file,
  currentMapping,
  currentFormula,
  currentWeightingKernel,
  currentThreshold,
  currentLabScales,
  currentShapeParam,
  currentPowerParam,
  onFormulaChange,
  onWeightingKernelChange,
  onThresholdChange,
  onLabScalesChange,
  onShapeParamChange,
  onPowerParamChange,
}) => {
  const [imageSupportsTransparency, setImageSupportsTransparency] =
    useState(false);
  const [transparencyEnabled, setTransparencyEnabled] = useState(false);
  const isImageUploaded = !!file;

  const usesPalettized =
    currentMapping === MAPPING_PALETTIZED ||
    currentMapping === MAPPING_SMOOTHED_PALETTIZED;
  const usesSmoothed =
    currentMapping === MAPPING_SMOOTHED ||
    currentMapping === MAPPING_SMOOTHED_PALETTIZED;

  useEffect(() => {
    let isMounted = true;
    if (!file) {
      setImageSupportsTransparency(false);
      return;
    }
    if (file.type === "image/gif") {
      setImageSupportsTransparency(true);
      return;
    }
    let revoked = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    const cleanup = () => {
      if (!revoked) URL.revokeObjectURL(url);
      revoked = true;
      isMounted = false;
    };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_CHECK_DIM = 128;
      const aspect = img.width / img.height;
      canvas.width = Math.min(img.width, MAX_CHECK_DIM);
      canvas.height = Math.min(img.height, Math.round(MAX_CHECK_DIM / aspect));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        if (isMounted) setImageSupportsTransparency(false);
        cleanup();
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let hasAlpha = false;
        for (let i = 3; i < imageData.data.length; i += 4) {
          if (imageData.data[i] < 255) {
            hasAlpha = true;
            break;
          }
        }
        if (isMounted) setImageSupportsTransparency(hasAlpha);
      } catch (e) {
        console.warn("Transparency check failed:", e);
        if (isMounted) setImageSupportsTransparency(false);
      } finally {
        cleanup();
      }
    };
    img.onerror = () => {
      if (isMounted) setImageSupportsTransparency(false);
      cleanup();
    };
    return cleanup;
  }, [file]);

  useEffect(() => {
    setTransparencyEnabled(currentThreshold > 0);
  }, [currentThreshold]);

  useEffect(() => {
    if (isImageUploaded && usesPalettized) {
      if (imageSupportsTransparency) {
        if (transparencyEnabled && currentThreshold === 0) {
          onThresholdChange(
            Math.max(MIN_THRESHOLD, DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED),
          );
        }
      } else {
        if (currentThreshold > 0) {
          onThresholdChange(0);
          setTransparencyEnabled(false);
        }
      }
    } else {
      if (currentThreshold > 0) {
        onThresholdChange(0);
        setTransparencyEnabled(false);
      }
    }
  }, [
    isImageUploaded,
    usesPalettized,
    imageSupportsTransparency,
    transparencyEnabled,
    currentThreshold,
    onThresholdChange,
  ]);

  const isGaussianActive =
    usesSmoothed && currentWeightingKernel === WEIGHTING_KERNEL_GAUSSIAN;
  const isInverseDistanceActive =
    usesSmoothed &&
    currentWeightingKernel === WEIGHTING_KERNEL_INVERSE_DISTANCE_POWER;

  const handleTransparencySwitchChange = useCallback(
    (checked: boolean) => {
      setTransparencyEnabled(checked);
      onThresholdChange(
        checked
          ? Math.max(MIN_THRESHOLD, DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED)
          : 0,
      );
    },
    [onThresholdChange],
  );

  const handleThresholdSliderChange = useCallback(
    (value: number[]) => {
      onThresholdChange(Math.max(MIN_THRESHOLD, value[0]));
    },
    [onThresholdChange],
  );

  const handleLabScaleChange = useCallback(
    (index: 0 | 1 | 2, value: number) => {
      const newScales: [number, number, number] = [...currentLabScales];
      newScales[index] = value;
      onLabScalesChange(newScales);
    },
    [currentLabScales, onLabScalesChange],
  );

  const handleShapeSliderChange = useCallback(
    (value: number[]) => {
      onShapeParamChange(value[0]);
    },
    [onShapeParamChange],
  );

  const handlePowerSliderChange = useCallback(
    (value: number[]) => {
      onPowerParamChange(value[0]);
    },
    [onPowerParamChange],
  );

  const isPalettizedActive = isImageUploaded && usesPalettized;
  const isSmoothedActive = isImageUploaded && usesSmoothed;
  const isTransparencyControlDisabled =
    !isPalettizedActive || !imageSupportsTransparency;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="adjustments">
        <AccordionTrigger className="text-lg font-medium hover:no-underline">
          Advanced Options
        </AccordionTrigger>
        <AccordionContent className="pt-4 space-y-6">
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

            <div className="grid grid-cols-2 gap-8 items-start">
              <div className="space-y-4 p-4 border rounded-lg bg-background">
                <div
                  className={cn(
                    "space-y-4 transition-opacity duration-200",
                    !isPalettizedActive && "opacity-60",
                  )}
                >
                  <Label className="block text-center text-xs font-medium">
                    Color Difference Formula
                  </Label>
                  <TooltipProvider delayDuration={200}>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {FORMULA_OPTIONS.map((option) => (
                        <Tooltip key={option}>
                          <TooltipTrigger asChild>
                            <Button
                              variant={
                                currentFormula === option
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => onFormulaChange(option)}
                              disabled={!isPalettizedActive}
                              className={cn(
                                !isPalettizedActive &&
                                "opacity-60 cursor-not-allowed",
                              )}
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
                              : !usesPalettized
                                ? "Requires palette mode"
                                : FORMULA_TOOLTIPS[option]}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-background">
                <div
                  className={cn(
                    "space-y-4 transition-opacity duration-200",
                    !isPalettizedActive && "opacity-60",
                  )}
                >
                  <div className="flex justify-center items-center gap-2 mb-2">
                    <Switch
                      id="transparency-switch"
                      checked={transparencyEnabled}
                      onCheckedChange={handleTransparencySwitchChange}
                      disabled={isTransparencyControlDisabled}
                      className={cn(
                        isTransparencyControlDisabled && "opacity-60",
                      )}
                    />
                    <Label
                      htmlFor="transparency-switch"
                      className={cn(
                        "text-xs font-medium",
                        isTransparencyControlDisabled &&
                        "opacity-60 cursor-not-allowed",
                      )}
                    >
                      Enable Transparency
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="transparency-slider"
                      className={cn(
                        "block text-center text-xs",
                        (isTransparencyControlDisabled ||
                          !transparencyEnabled) &&
                        "opacity-60",
                      )}
                    >
                      Alpha Threshold
                    </Label>
                    <Slider
                      id="transparency-slider"
                      min={MIN_THRESHOLD}
                      max={MAX_THRESHOLD}
                      step={1}
                      value={[currentThreshold]}
                      onValueChange={handleThresholdSliderChange}
                      disabled={
                        isTransparencyControlDisabled || !transparencyEnabled
                      }
                      className={cn(
                        "w-full",
                        (isTransparencyControlDisabled ||
                          !transparencyEnabled) &&
                        "opacity-60",
                      )}
                    />
                    <div className="text-center text-xs text-secondary-foreground">
                      {!isImageUploaded
                        ? "Upload an image first"
                        : !usesPalettized
                          ? "Requires palette mode"
                          : !imageSupportsTransparency
                            ? "Current image has no transparency"
                            : transparencyEnabled
                              ? `Pixels with alpha < ${currentThreshold} become transparent`
                              : "Transparency disabled"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
              <div className="space-y-3">
                <Label
                  className={cn(
                    "block text-center text-xs font-medium",
                    !isSmoothedActive && "opacity-60",
                  )}
                >
                  Blending Method
                </Label>
                <TooltipProvider delayDuration={200}>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {WEIGHTING_KERNEL_OPTIONS.map((option) => (
                      <Tooltip key={option}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={
                              currentWeightingKernel === option
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => onWeightingKernelChange(option)}
                            disabled={!isSmoothedActive}
                            className={cn(
                              !isSmoothedActive &&
                              "opacity-60 cursor-not-allowed",
                            )}
                          >
                            {WEIGHTING_KERNEL_NAMES[option]}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="center"
                          className="max-w-[200px] text-center"
                        >
                          {!isImageUploaded
                            ? "Upload an image first"
                            : !usesSmoothed
                              ? "Requires blend mode"
                              : WEIGHTING_KERNEL_TOOLTIPS[option]}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4 p-4 border rounded-lg bg-background">
                  <h3
                    className={cn(
                      "text-xs font-medium text-center",
                      !isSmoothedActive && "opacity-60",
                    )}
                  >
                    LAB Color Component Weights
                  </h3>

                  {(() => {
                    const sliderHeight = 100;
                    const labels = ["L", "a", "b"];

                    return (
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          {
                            index: 0,
                            gradient:
                              "linear-gradient(to top, white 0%, black 100%)",
                          },
                          {
                            index: 1,
                            gradient:
                              "linear-gradient(to bottom, #f87171 0%, #4ade80 100%)",
                          },
                          {
                            index: 2,
                            gradient:
                              "linear-gradient(to top, #facc15 0%, #60a5fa 100%)",
                          },
                        ].map(({ index, gradient }) => (
                          <div
                            key={index}
                            className="flex flex-col items-center"
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center mb-2",
                                !isSmoothedActive && "opacity-60",
                              )}
                            >
                              <span className="text-xs">{labels[index]}</span>
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
                                  step={0.01}
                                  value={[Math.log10(currentLabScales[index])]}
                                  onValueChange={(v) => {
                                    const actualValue = Math.pow(10, v[0]);
                                    handleLabScaleChange(
                                      index as 0 | 1 | 2,
                                      actualValue,
                                    );
                                  }}
                                  disabled={!isSmoothedActive}
                                  gradient={gradient}
                                  style={{
                                    height: sliderHeight,
                                  }}
                                  className={cn(
                                    !isSmoothedActive && "opacity-60",
                                  )}
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
                                    handleLabScaleChange(
                                      index as 0 | 1 | 2,
                                      val,
                                    );
                                  }
                                }}
                                className={cn(
                                  "h-7 w-16 text-center text-xs mb-1",
                                  !isSmoothedActive && "opacity-60",
                                )}
                                disabled={!isSmoothedActive}
                              />

                              {currentLabScales[index] !==
                                DEFAULT_SMOOTHED_SCALE && (
                                  <button
                                    onClick={() =>
                                      handleLabScaleChange(
                                        index as 0 | 1 | 2,
                                        DEFAULT_SMOOTHED_SCALE,
                                      )
                                    }
                                    className={cn(
                                      "text-xs text-primary",
                                      !isSmoothedActive &&
                                      "opacity-60 cursor-not-allowed",
                                    )}
                                    disabled={!isSmoothedActive}
                                  >
                                    Reset
                                  </button>
                                )}
                              {currentLabScales[index] ===
                                DEFAULT_SMOOTHED_SCALE && (
                                  <span
                                    className={cn(
                                      "text-xs text-secondary-foreground",
                                      !isSmoothedActive && "opacity-60",
                                    )}
                                  >
                                    Default
                                  </span>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div
                    className={cn(
                      "space-y-4 transition-opacity duration-200",
                      !isSmoothedActive && "opacity-60",
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

                <div className="space-y-8 p-4 border rounded-lg bg-background">
                  <div
                    className={cn(
                      "space-y-4 transition-opacity duration-200",
                      (!isSmoothedActive || !isInverseDistanceActive) &&
                      "opacity-60",
                    )}
                  >
                    <Label
                      htmlFor="power-slider"
                      className="block text-center text-xs font-medium"
                    >
                      Blend Intensity (Power)
                    </Label>
                    <Slider
                      id="power-slider"
                      min={MIN_SMOOTHED_POWER}
                      max={MAX_SMOOTHED_POWER}
                      step={SMOOTHED_POWER_STEP}
                      value={[currentPowerParam]}
                      onValueChange={handlePowerSliderChange}
                      disabled={!isSmoothedActive || !isInverseDistanceActive}
                      className="mt-2"
                    />
                    <div className="text-center text-xs text-secondary-foreground">
                      {currentPowerParam.toFixed(1)}
                    </div>
                    <p className="text-xs text-secondary-foreground text-center">
                      {!isImageUploaded
                        ? "Upload an image first"
                        : !usesSmoothed
                          ? "Requires blend mode"
                          : isInverseDistanceActive
                            ? "Controls the influence falloff between colors"
                            : "Available with Inverse Distance blending method"}
                    </p>
                  </div>

                  <Separator />

                  <div
                    className={cn(
                      "space-y-4 transition-opacity duration-200",
                      (!isSmoothedActive || !isGaussianActive) && "opacity-60",
                    )}
                  >
                    <Label
                      htmlFor="shape-slider"
                      className="block text-center text-xs font-medium"
                    >
                      Blend Radius (Shape)
                    </Label>
                    <Slider
                      id="shape-slider"
                      min={MIN_SMOOTHED_SHAPE}
                      max={MAX_SMOOTHED_SHAPE}
                      step={SMOOTHED_SHAPE_STEP}
                      value={[currentShapeParam]}
                      onValueChange={handleShapeSliderChange}
                      disabled={!isSmoothedActive || !isGaussianActive}
                      className="mt-2"
                    />
                    <div className="text-center text-xs text-secondary-foreground">
                      {currentShapeParam.toFixed(2)}
                    </div>
                    <p className="text-xs text-secondary-foreground text-center">
                      {!isImageUploaded
                        ? "Upload an image first"
                        : !usesSmoothed
                          ? "Requires blend mode"
                          : isGaussianActive
                            ? "Controls how far colors influence each other"
                            : "Available with Gaussian blending method"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AdjustmentsAccordion;
