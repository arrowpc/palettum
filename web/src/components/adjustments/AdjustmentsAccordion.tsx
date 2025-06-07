import React, { useState, useEffect, useCallback } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  MAPPING_PALETTIZED,
  MAPPING_SMOOTHED,
  MIN_THRESHOLD,
  DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED,
} from "./adjustments.types";
import { GeneralSettings } from "./GeneralSettings";
import { ColorMatchingSettings } from "./ColorMatchingSettings";
import { ColorBlendingSettings } from "./ColorBlendingSettings";
import { useShader } from "@/ShaderContext";

interface AdjustmentsAccordionProps {
  file: File | null;
}

const AdjustmentsAccordion: React.FC<AdjustmentsAccordionProps> = ({
  file,
}) => {
  const { shader, setShader } = useShader();
  const { config } = shader;
  const [imageSupportsTransparency, setImageSupportsTransparency] =
    useState(false);
  const [transparencyEnabled, setTransparencyEnabled] = useState(false);
  const isImageUploaded = !!file;

  const usesPalettized = config.mapping === MAPPING_PALETTIZED;
  const usesSmoothed = config.mapping === MAPPING_SMOOTHED;

  const onThresholdChange = useCallback(
    (threshold: number) => {
      setShader((prev) => ({
        ...prev,
        config: { ...prev.config, transparencyThreshold: threshold },
      }));
    },
    [setShader],
  );

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
    if (config.transparencyThreshold) {
      setTransparencyEnabled(config.transparencyThreshold > 0);
    }
  }, [config.transparencyThreshold]);

  useEffect(() => {
    if (config.transparencyThreshold) {
      if (isImageUploaded && usesPalettized) {
        if (imageSupportsTransparency) {
          if (transparencyEnabled && config.transparencyThreshold === 0) {
            onThresholdChange(
              Math.max(MIN_THRESHOLD, DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED),
            );
          }
        } else {
          if (config.transparencyThreshold > 0) {
            onThresholdChange(0);
          }
        }
      } else {
        if (config.transparencyThreshold > 0) {
          onThresholdChange(0);
        }
      }
    }
  }, [
    isImageUploaded,
    usesPalettized,
    imageSupportsTransparency,
    transparencyEnabled,
    config.transparencyThreshold,
    onThresholdChange,
  ]);

  const isPalettizedActive = isImageUploaded && usesPalettized;
  const isSmoothedActive = isImageUploaded && usesSmoothed;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="adjustments">
        <AccordionTrigger className="text-lg font-medium hover:no-underline">
          Advanced Options
        </AccordionTrigger>
        <AccordionContent className="pt-4 space-y-6">
          <GeneralSettings isImageUploaded={isImageUploaded} />
          <ColorBlendingSettings
            isSmoothedActive={isSmoothedActive}
            isImageUploaded={isImageUploaded}
            usesSmoothed={usesSmoothed}
          />
          <ColorMatchingSettings
            isPalettizedActive={isPalettizedActive}
            isImageUploaded={isImageUploaded}
            usesPalettized={usesPalettized}
            imageSupportsTransparency={imageSupportsTransparency}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AdjustmentsAccordion;
