import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Comlink from "comlink";
import { cn } from "@/lib/utils";
import {
  LIMITS,
  DEFAULTS,
  rgbToHex,
  hexToRgb,
  isSameColor,
  validatePalette,
} from "@/lib/utils";
import { type Palette, type Rgb } from "palettum";
import { toast } from "sonner";

import { PaletteHeader } from "./palette-header";
import { ColorPickerControl } from "./color-picker-control";
import { MediaColorExtractor } from "./media-color-extractor";
import { ColorDisplayArea } from "./color-display-area";
import { PaletteEditorActions } from "./palette-editor-actions";
import type { Extractor } from "@/workers/core/extractor";
import ExtractorWorker from "@/workers/extractor?worker";

interface PaletteEditorProps {
  palette: Palette;
  onClose: () => void;
  onSave: (palette: Palette) => Promise<void>;
}

const MAX_COLORS_FROM_MEDIA_INPUT = 255;
const DEFAULT_COLORS_TO_EXTRACT = 8;

export const PaletteEditor: React.FC<PaletteEditorProps> = ({
  palette: initialPalette,
  onClose,
  onSave,
}) => {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [selectedColor, setSelectedColor] = useState<Rgb>(DEFAULTS.COLOR);
  const [rgbInputs, setRgbInputs] = useState<{
    r: string;
    g: string;
    b: string;
  }>({
    r: selectedColor.r.toString(),
    g: selectedColor.g.toString(),
    b: selectedColor.b.toString(),
  });
  const [hexValue, setHexValue] = useState<string>(rgbToHex(DEFAULTS.COLOR));
  const [isEyeDropperSupported, setIsEyeDropperSupported] =
    useState<boolean>(false);
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [uploadedMediaFile, setUploadedMediaFile] = useState<File | null>(null);
  const extractorWorkerRef = useRef<Worker | null>(null);
  const extractorRef = useRef<Comlink.Remote<typeof Extractor> | null>(null);

  const maxColorsToRequestFromMedia = Math.max(
    1,
    Math.min(
      MAX_COLORS_FROM_MEDIA_INPUT,
      LIMITS.MAX_COLORS - palette.colors.length,
    ),
  );

  const [numColorsToExtract, setNumColorsToExtract] = useState<number>(
    Math.min(DEFAULT_COLORS_TO_EXTRACT, maxColorsToRequestFromMedia),
  );
  const [suggestedColors, setSuggestedColors] = useState<Rgb[]>([]);
  const [isExtractingColors, setIsExtractingColors] = useState<boolean>(false);

  useEffect(() => {
    extractorWorkerRef.current = new ExtractorWorker();
    extractorRef.current = Comlink.wrap<typeof Extractor>(
      extractorWorkerRef.current,
    );

    return () => {
      extractorWorkerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const hasChanges =
      JSON.stringify(palette) !== JSON.stringify(initialPalette) ||
      suggestedColors.length > 0;
    setHasUnsavedChanges(hasChanges);
  }, [palette, initialPalette, suggestedColors]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    setIsEyeDropperSupported(
      typeof window !== "undefined" && "EyeDropper" in window,
    );
  }, []);

  useEffect(() => {
    setHexValue(rgbToHex(selectedColor));
  }, [selectedColor]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl && mediaPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  useEffect(() => {
    const newMax = Math.max(
      1,
      Math.min(
        MAX_COLORS_FROM_MEDIA_INPUT,
        LIMITS.MAX_COLORS - palette.colors.length,
      ),
    );
    if (numColorsToExtract > newMax) {
      setNumColorsToExtract(newMax);
    }
  }, [palette.colors.length, numColorsToExtract]);

  useEffect(() => {
    setRgbInputs({
      r: selectedColor.r.toString(),
      g: selectedColor.g.toString(),
      b: selectedColor.b.toString(),
    });
  }, [selectedColor]);

  const handleClose = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "You have unsaved changes. Are you sure you want to close?",
      )
    ) {
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  const isValidHex = (hex: string): boolean =>
    /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(
      hex.charAt(0) === "#" ? hex : `#${hex}`,
    );

  const handlePaletteNameChange = useCallback((newName: string) => {
    if (newName.length <= LIMITS.MAX_ID_LENGTH) {
      setPalette((prev) => ({ ...prev, id: newName }));
    } else {
      toast.error(`Name too long (max ${LIMITS.MAX_ID_LENGTH}).`);
      setPalette((prev) => ({ ...prev, id: newName }));
    }
  }, []);

  const handleHexChange = useCallback((hex: string) => {
    const sanitized = hex.replace(/[^#A-Fa-f0-9]/g, "").slice(0, 7);
    setHexValue(sanitized);
    const rgb = hexToRgb(sanitized);
    if (rgb) setSelectedColor(rgb);
  }, []);

  const validateHexOnBlur = useCallback(
    (hex: string) => {
      if (!isValidHex(hex)) {
        toast.error("Invalid hex color code.");
        setHexValue(rgbToHex(selectedColor));
        return;
      }
      const rgb = hexToRgb(hex);
      if (rgb) {
        setSelectedColor(rgb);
      } else {
        toast.error("Invalid hex color code.");
        setHexValue(rgbToHex(selectedColor)); // Revert
      }
    },
    [selectedColor],
  );

  const handleEyeDropper = useCallback(async () => {
    if (!isEyeDropperSupported) {
      toast.info("Eyedropper not supported by your browser.");
      return;
    }
    try {
      setIsPickerActive(true);
      // @ts-ignore
      const result = await new window.EyeDropper().open();
      handleHexChange(result.sRGBHex);
    } catch (error) {
      toast.info("Eyedropper failed or cancelled.");
    } finally {
      setIsPickerActive(false);
    }
  }, [isEyeDropperSupported, handleHexChange]);

  const addSelectedColorToPalette = useCallback(() => {
    if (palette.colors.length >= LIMITS.MAX_COLORS) {
      toast.error(`Palette full (max ${LIMITS.MAX_COLORS} colors).`);
      return;
    }
    if (palette.colors.some((c) => isSameColor(c, selectedColor))) {
      toast.warning("Color already in palette.");
      return;
    }
    setPalette((p) => ({ ...p, colors: [selectedColor, ...p.colors] }));
    toast.success("Color added to palette!");
    setSelectedColor(DEFAULTS.COLOR);
  }, [selectedColor, palette.colors]);

  const removeFromPalette = useCallback((indexToRemove: number) => {
    setPalette((p) => ({
      ...p,
      colors: p.colors.filter((_, i) => i !== indexToRemove),
    }));
    toast.info("Color removed from palette.");
  }, []);

  const addSuggestedToPalette = useCallback(
    (colorToAdd: Rgb) => {
      if (palette.colors.length >= LIMITS.MAX_COLORS) {
        toast.error(`Palette full (max ${LIMITS.MAX_COLORS} colors).`);
        return;
      }
      if (palette.colors.some((c) => isSameColor(c, colorToAdd))) {
        toast.warning("Color already in palette.");
        // Still remove from suggestions even if already present
      } else {
        setPalette((p) => ({ ...p, colors: [colorToAdd, ...p.colors] }));
        toast.success("Suggested color added!");
      }
      setSuggestedColors((prev) =>
        prev.filter((sc) => !isSameColor(sc, colorToAdd)),
      );
    },
    [palette.colors],
  );

  const dismissSuggestion = useCallback((colorToDismiss: Rgb) => {
    toast.info("Suggestion dismissed.");
    setSuggestedColors((prev) =>
      prev.filter((sc) => !isSameColor(sc, colorToDismiss)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (
      suggestedColors.length > 0 &&
      !window.confirm(
        `You have ${suggestedColors.length} unhandled suggested color(s). Save anyway?`,
      )
    ) {
      return;
    }

    const validationErrors = validatePalette(palette);
    if (validationErrors.length > 0) {
      validationErrors
        .map((err) => err.replace("ID", "Name"))
        .forEach((msg) => toast.error(msg));
      return;
    }

    try {
      await onSave(palette);
      setHasUnsavedChanges(false);
      setSuggestedColors([]); // Clear suggestions on successful save
      toast.success("Palette saved!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save palette. Please try again.");
    }
  }, [palette, suggestedColors, onSave]);

  const handleMediaFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (mediaPreviewUrl && mediaPreviewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(mediaPreviewUrl);
        }
        setUploadedMediaFile(file);
        setMediaPreviewUrl(URL.createObjectURL(file));
        setSuggestedColors([]); // Clear old suggestions
        toast.info("Media loaded. Ready to extract colors.");
      }
    },
    [mediaPreviewUrl],
  );

  const handleRemoveMedia = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (mediaPreviewUrl && mediaPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
      setMediaPreviewUrl(null);
      setUploadedMediaFile(null);
      setSuggestedColors([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.info("Media removed.");
    },
    [mediaPreviewUrl],
  );

  const handleExtractColorsFromMedia = useCallback(async () => {
    if (!uploadedMediaFile) {
      toast.warning("Please select a media file first to extract colors.");
      return;
    }
    if (palette.colors.length >= LIMITS.MAX_COLORS) {
      toast.info(
        `Palette is full. Cannot extract more colors. Max ${LIMITS.MAX_COLORS}.`,
      );
      return;
    }

    setIsExtractingColors(true);
    const toastId = "extracting-colors-toast";
    toast.loading(`Extracting ${numColorsToExtract} color(s)...`, {
      id: toastId,
    });

    try {
      const extracted = await extractorRef.current?.extract(
        uploadedMediaFile,
        numColorsToExtract,
      );

      if (!extracted) {
        toast.error("Color extraction failed. Please try again.", {
          id: toastId,
        });
        return;
      }

      const newSuggestions = extracted.colors.filter(
        (extractedColor: Rgb) =>
          !palette.colors.some((paletteColor) =>
            isSameColor(paletteColor, extractedColor),
          ) &&
          !suggestedColors.some((existingSuggestion) =>
            isSameColor(existingSuggestion, extractedColor),
          ),
      );
      setSuggestedColors((prev) =>
        [...prev, ...newSuggestions].slice(0, MAX_COLORS_FROM_MEDIA_INPUT),
      ); // Add new, unique suggestions

      if (extracted.colors.length === 0) {
        toast.info("No distinct colors found in the media.", { id: toastId });
      } else if (newSuggestions.length === 0) {
        toast.info(
          `All extracted colors are already in your palette or suggestions.`,
          { id: toastId },
        );
      } else {
        const numAlreadyInPaletteOrSuggested =
          extracted.colors.length - newSuggestions.length;
        let messageText = `Extracted ${newSuggestions.length} new color suggestion(s)`;
        if (numAlreadyInPaletteOrSuggested > 0) {
          messageText += ` (${numAlreadyInPaletteOrSuggested} already present/suggested).`;
        } else {
          messageText += ".";
        }
        toast.success(messageText, { id: toastId });
      }
    } catch (err) {
      console.error("Extraction error:", err);
      toast.error(
        "Color extraction failed. Please try a different media file or format.",
        { id: toastId },
      );
    } finally {
      setIsExtractingColors(false);
    }
  }, [
    uploadedMediaFile,
    numColorsToExtract,
    palette.colors,
    suggestedColors,
    extractorRef,
  ]);

  const handleAcceptAllSuggestions = useCallback(() => {
    if (suggestedColors.length === 0) {
      toast.info("No suggestions to accept.");
      return;
    }

    let addedCount = 0;
    let alreadyPresentCount = 0;
    let fullCount = 0;
    const colorsToAdd: Rgb[] = [];
    const currentPaletteColors = [...palette.colors]; // Snapshot of current colors

    for (const colorToAdd of suggestedColors) {
      if (
        currentPaletteColors.length + colorsToAdd.length >=
        LIMITS.MAX_COLORS
      ) {
        fullCount++;
        continue;
      }
      if (
        currentPaletteColors.some((c) => isSameColor(c, colorToAdd)) ||
        colorsToAdd.some((c) => isSameColor(c, colorToAdd)) // Check against newly added ones too
      ) {
        alreadyPresentCount++;
        continue;
      }
      colorsToAdd.push(colorToAdd);
      addedCount++;
    }

    if (colorsToAdd.length > 0) {
      setPalette((p) => ({ ...p, colors: [...colorsToAdd, ...p.colors] }));
    }

    let messageParts: string[] = [];
    if (addedCount > 0) messageParts.push(`${addedCount} color(s) added.`);
    if (alreadyPresentCount > 0)
      messageParts.push(`${alreadyPresentCount} already in palette.`);
    if (fullCount > 0)
      messageParts.push(
        `${fullCount} skipped (palette would exceed max of ${LIMITS.MAX_COLORS}).`,
      );

    if (messageParts.length > 0) {
      toast.info(messageParts.join(" "));
    } else if (suggestedColors.length > 0) {
      // This case implies all suggestions were either duplicates or would make palette full
      toast.info("No new colors could be added from suggestions.");
    }
    setSuggestedColors([]);
  }, [suggestedColors, palette.colors]);

  const handleRejectAllSuggestions = useCallback(() => {
    if (suggestedColors.length === 0) {
      toast.info("No suggestions to dismiss.");
      return;
    }
    toast.info(`${suggestedColors.length} suggestion(s) dismissed.`);
    setSuggestedColors([]);
  }, [suggestedColors]);

  const maxExtractable = Math.max(
    1,
    Math.min(
      MAX_COLORS_FROM_MEDIA_INPUT,
      LIMITS.MAX_COLORS - palette.colors.length,
    ),
  );
  const canExtractMore = palette.colors.length < LIMITS.MAX_COLORS;
  const canSave = hasUnsavedChanges || suggestedColors.length > 0;

  const handleRGBInputChange = (component: keyof Rgb, value: string) => {
    if (/^\d{0,3}$/.test(value)) {
      setRgbInputs((prev) => {
        const next = { ...prev, [component]: value };
        // Only update selectedColor if all fields are valid numbers in 0-255
        const r = parseInt(next.r, 10);
        const g = parseInt(next.g, 10);
        const b = parseInt(next.b, 10);
        if (
          next.r !== "" &&
          next.g !== "" &&
          next.b !== "" &&
          !isNaN(r) &&
          !isNaN(g) &&
          !isNaN(b) &&
          r >= 0 &&
          r <= 255 &&
          g >= 0 &&
          g <= 255 &&
          b >= 0 &&
          b <= 255
        ) {
          setSelectedColor({ r, g, b });
        }
        return next;
      });
    }
  };

  const handleRGBInputBlur = (component: keyof Rgb) => {
    const value = rgbInputs[component];
    if (value === "") {
      // If left empty, revert to current selectedColor
      setRgbInputs((prev) => ({
        ...prev,
        [component]: selectedColor[component].toString(),
      }));
      return;
    }
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;
    num = Math.max(0, Math.min(255, num));
    setSelectedColor((prev) => ({ ...prev, [component]: num }));
  };

  return (
    <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div
        className={cn(
          "bg-background rounded-lg p-4 sm:p-6 flex flex-col border border-border shadow-xl overflow-hidden",
          "w-full max-w-[95vw] sm:max-w-[480px] md:max-w-[600px] lg:max-w-[700px]",
          "max-h-[90vh] overflow-y-auto",
        )}
      >
        <PaletteHeader
          paletteName={palette.id}
          onNameChange={handlePaletteNameChange}
        />

        <div
          className={cn(
            "flex flex-1 min-h-0",
            isMobile ? "flex-col gap-4" : "flex-row gap-6",
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-4 sm:gap-6 min-h-0 overflow-y-auto",
              isMobile ? "w-full order-1" : "w-[260px] order-2",
            )}
          >
            <ColorPickerControl
              hexValue={hexValue}
              onHexChange={handleHexChange}
              onValidateHexOnBlur={validateHexOnBlur}
              rgbInputs={rgbInputs}
              onRGBInputChange={handleRGBInputChange}
              onRGBInputBlur={handleRGBInputBlur}
              isEyeDropperSupported={isEyeDropperSupported}
              isPickerActive={isPickerActive}
              onEyeDropper={handleEyeDropper}
              isMobile={isMobile}
            />
            <MediaColorExtractor
              mediaPreviewUrl={mediaPreviewUrl}
              onMediaFileChange={handleMediaFileChange}
              onRemove={handleRemoveMedia}
              fileInputRef={fileInputRef}
              numColorsToExtract={numColorsToExtract}
              onNumColorsToExtractChange={setNumColorsToExtract}
              maxExtractable={maxExtractable}
              onExtractColors={handleExtractColorsFromMedia}
              isExtractingColors={isExtractingColors}
              canExtractMore={canExtractMore}
              mediaFile={uploadedMediaFile}
              isMobile={isMobile}
            />
          </div>

          <ColorDisplayArea
            paletteColors={palette.colors}
            suggestedColors={suggestedColors}
            hexValueSelected={hexValue}
            onAddSelectedColorToPalette={addSelectedColorToPalette}
            onRemoveFromPalette={removeFromPalette}
            onAddSuggestedToPalette={addSuggestedToPalette}
            onDismissSuggestion={dismissSuggestion}
            onAcceptAllSuggestions={handleAcceptAllSuggestions}
            onRejectAllSuggestions={handleRejectAllSuggestions}
            isMobile={isMobile}
          />
        </div>

        <PaletteEditorActions
          paletteColorCount={palette.colors.length}
          onClose={handleClose}
          onSave={handleSave}
          canSave={canSave}
        />
      </div>
    </div>
  );
};

export default PaletteEditor;
