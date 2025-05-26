import React, { useState, useEffect, useCallback } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  MappingKey,
  FormulaKey,
  SmoothingStyleKey,
  DitheringKey,
  MAPPING_PALETTIZED,
  MAPPING_SMOOTHED,
  MAPPING_SMOOTHED_PALETTIZED,
  MIN_THRESHOLD,
  DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED,
} from "./adjustments.types";
import { ColorMatchingSettings } from "./ColorMatchingSettings";
import { ColorBlendingSettings } from "./ColorBlendingSettings";

interface AdjustmentsAccordionProps {
  file: File | null;
  currentMapping: MappingKey;
  currentFormula: FormulaKey;
  currentSmoothingStyle: SmoothingStyleKey;
  currentThreshold: number;
  currentLabScales: [number, number, number];
  currentSmoothingStrength: number;
  currentDitheringStyle: DitheringKey;
  currentDitheringStrength: number;
  onMappingChange: (mapping: MappingKey) => void;
  onFormulaChange: (formula: FormulaKey) => void;
  onSmoothingStyleChange: (style: SmoothingStyleKey) => void;
  onThresholdChange: (threshold: number) => void;
  onLabScalesChange: (scales: [number, number, number]) => void;
  onSmoothingStrengthChange: (strength: number) => void;
  onDitheringStyleChange: (style: DitheringKey) => void;
  onDitheringStrengthChange: (strength: number) => void;
}

const AdjustmentsAccordion: React.FC<AdjustmentsAccordionProps> = ({
  file,
  currentMapping,
  currentFormula,
  currentSmoothingStyle,
  currentThreshold,
  currentLabScales,
  currentSmoothingStrength,
  currentDitheringStyle,
  currentDitheringStrength,
  onFormulaChange,
  onSmoothingStyleChange,
  onThresholdChange,
  onLabScalesChange,
  onSmoothingStrengthChange,
  onDitheringStyleChange,
  onDitheringStrengthChange,
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
        }
      }
    } else {
      if (currentThreshold > 0) {
        onThresholdChange(0);
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

  const isPalettizedActive = isImageUploaded && usesPalettized;
  const isSmoothedActive = isImageUploaded && usesSmoothed;

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

  const handleSmoothingStrengthSliderChange = useCallback(
    (value: number[]) => {
      onSmoothingStrengthChange(value[0]);
    },
    [onSmoothingStrengthChange],
  );

  const handleDitheringStrengthSliderChange = useCallback(
    (value: number[]) => {
      onDitheringStrengthChange(value[0]);
    },
    [onDitheringStrengthChange],
  );

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="adjustments">
        <AccordionTrigger className="text-lg font-medium hover:no-underline">
          Advanced Options
        </AccordionTrigger>
        <AccordionContent className="pt-4 space-y-6">
          <ColorMatchingSettings
            currentFormula={currentFormula}
            onFormulaChange={onFormulaChange}
            currentThreshold={currentThreshold}
            onThresholdSliderChange={handleThresholdSliderChange}
            transparencyEnabled={transparencyEnabled}
            onTransparencySwitchChange={handleTransparencySwitchChange}
            isPalettizedActive={isPalettizedActive}
            isImageUploaded={isImageUploaded}
            usesPalettized={usesPalettized}
            imageSupportsTransparency={imageSupportsTransparency}
            currentDitheringStyle={currentDitheringStyle}
            onDitheringStyleChange={onDitheringStyleChange}
            currentDitheringStrength={currentDitheringStrength}
            onDitheringStrengthSliderChange={
              handleDitheringStrengthSliderChange
            }
          />
          <ColorBlendingSettings
            currentSmoothingStyle={currentSmoothingStyle}
            onSmoothingStyleChange={onSmoothingStyleChange}
            currentLabScales={currentLabScales}
            onLabScalesChange={onLabScalesChange}
            currentSmoothingStrength={currentSmoothingStrength}
            onSmoothingStrengthSliderChange={
              handleSmoothingStrengthSliderChange
            }
            isSmoothedActive={isSmoothedActive}
            isImageUploaded={isImageUploaded}
            usesSmoothed={usesSmoothed}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AdjustmentsAccordion;
