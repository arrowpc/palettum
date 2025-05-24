import React, { useState, useEffect, useRef } from "react";
import { Trash2, Pipette, X, Plus } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import {
  LIMITS,
  DEFAULTS,
  rgbToHex,
  hexToRgb,
  isSameColor,
  validatePalette,
} from "@/lib/palettes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Palette, type Rgb } from "palettum";

interface PaletteEditorProps {
  palette: Palette;
  onClose: () => void;
  onSave: (palette: Palette) => Promise<void>;
}

interface ColorTileProps {
  color: Rgb;
  onRemove: () => void;
  isMobile: boolean;
}

interface RGBInputProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
}

const ColorTile: React.FC<ColorTileProps> = ({ color, onRemove, isMobile }) => (
  <TooltipProvider>
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>
        <div className="relative group">
          <div
            className="aspect-square rounded-lg shadow-sm hover:shadow-md transition-all duration-150 border border-gray-200"
            style={{ backgroundColor: rgbToHex(color) }}
          />
          <div
            className={cn(
              "absolute inset-0 rounded-lg flex items-center justify-center",
              isMobile ? "bg-black/10" : "bg-black/0 group-hover:bg-black/20",
            )}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className={cn(
                "p-2 bg-black/50 rounded-full transform transition-all duration-150",
                isMobile
                  ? "opacity-100 hover:bg-black/70"
                  : "opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:scale-110",
              )}
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-gray-900 text-white px-2 py-1 text-sm rounded shadow-lg"
      >
        {color.r}, {color.g}, {color.b}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const RGBInput: React.FC<RGBInputProps> = ({ label, value, onChange }) => (
  <div className="flex flex-col items-center">
    <span className="text-xs font-medium text-foreground mb-1">{label}</span>
    <input
      type="number"
      min="0"
      max="255"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-12 px-1 py-1 border rounded-lg text-xs text-center bg-background border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-border-active text-center [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  </div>
);

const AddColorButton: React.FC<{
  color: string;
  onClick: () => void;
}> = ({ color, onClick }) => (
  <div className="relative">
    <div
      className={cn(
        "aspect-square rounded-md overflow-hidden cursor-pointer group",
        "border border-border",
        "shadow-sm hover:shadow-md",
        "transition-all duration-150",
      )}
      onClick={onClick}
    >
      <div className="w-full h-full" style={{ backgroundColor: color }} />
      <div
        className={cn(
          "absolute inset-0 rounded-md flex items-center justify-center",
          "bg-background/50 group-hover:bg-background/30",
          "transition-all duration-150",
        )}
      >
        <div className="w-6 h-6 rounded-full bg-background shadow-md flex items-center justify-center transform group-hover:scale-110 transition-all duration-150">
          <Plus className="w-4 h-4 text-foreground" />
        </div>
      </div>
    </div>
  </div>
);

export const PaletteEditor: React.FC<PaletteEditorProps> = ({
  palette: initialPalette,
  onClose,
  onSave,
}) => {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [selectedColor, setSelectedColor] = useState<Rgb>(DEFAULTS.COLOR);
  const [hexValue, setHexValue] = useState<string>(rgbToHex(DEFAULTS.COLOR));
  const [isEyeDropperSupported, setIsEyeDropperSupported] =
    useState<boolean>(false);
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const hasChanges =
      JSON.stringify(palette) !== JSON.stringify(initialPalette);
    setHasUnsavedChanges(hasChanges);
  }, [palette, initialPalette]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    setIsEyeDropperSupported("EyeDropper" in window);
  }, []);

  useEffect(() => {
    setHexValue(rgbToHex(selectedColor));
  }, [selectedColor]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (
        window.confirm(
          "You have unsaved changes. Are you sure you want to close?",
        )
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const isValidHex = (hex: string): boolean => {
    const normalized = hex.charAt(0) === "#" ? hex : `#${hex}`;
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(normalized);
  };

  const handleHexChange = (hex: string) => {
    const sanitized = hex.replace(/[^#A-Fa-f0-9]/g, "").slice(0, 7);
    setHexValue(sanitized);
    const rgb = hexToRgb(sanitized);
    if (rgb) {
      setSelectedColor(rgb);
    }
  };

  const validateHex = (hex: string) => {
    if (!isValidHex(hex)) {
      setErrors(["Invalid hex color code"]);
      setHexValue(rgbToHex(selectedColor));
      return;
    }

    const rgb = hexToRgb(hex);
    if (rgb) {
      setSelectedColor(rgb);
      setErrors([]);
    } else {
      setErrors(["Invalid hex color code"]);
      setHexValue(rgbToHex(selectedColor));
    }
  };

  const handleRGBChange = (component: keyof Rgb, value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(255, numValue));
    setSelectedColor((prev) => ({ ...prev, [component]: clampedValue }));
  };

  const handleEyeDropper = async () => {
    if (!isEyeDropperSupported) return;

    try {
      setIsPickerActive(true);
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      handleHexChange(result.sRGBHex);
    } catch (error) {
      setErrors((prev) => [
        ...prev,
        "Failed to access color picker. Please try again.",
      ]);
    } finally {
      setIsPickerActive(false);
    }
  };

  const addColor = () => {
    setErrors([]);

    if (palette.colors.length >= LIMITS.MAX_COLORS) {
      setErrors([`Cannot add more than ${LIMITS.MAX_COLORS} colors`]);
      return;
    }

    const isDuplicate = palette.colors.some((color) =>
      isSameColor(color, selectedColor),
    );

    if (isDuplicate) {
      setErrors(["This color is already in the palette"]);
      return;
    }

    setPalette((prev) => ({
      ...prev,
      colors: [...prev.colors, selectedColor],
    }));
  };

  const removeColor = (index: number) => {
    setErrors([]);

    setPalette((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    const validationErrors = validatePalette(palette);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setErrors([]);

    try {
      await onSave(palette);
      setHasUnsavedChanges(false);
    } catch (error) {
      setErrors(["Failed to save palette. Please try again."]);
    } finally {
      setIsSaving(false);
    }
  };

  // Reverse the colors array for display (newest first)
  const displayColors = [...palette.colors].reverse();

  return (
    <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        className={cn(
          "bg-background rounded-lg p-6 flex flex-col border border-border shadow-lg overflow-hidden",
          isMobile
            ? "w-full max-w-[95vw] max-h-[95vh]"
            : "w-[560px] max-h-[90vh]",
        )}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-foreground">
            Edit Palette
          </h2>
          <button
            onClick={handleClose}
            className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Palette ID
          </label>
          <input
            type="text"
            value={palette.id}
            onChange={(e) => {
              const newId = e.target.value;
              if (newId.length <= LIMITS.MAX_ID_LENGTH) {
                setPalette((prev) => ({ ...prev, id: newId }));
              }
            }}
            className={cn(
              "w-full px-4 py-2 text-sm bg-background border rounded-md",
              "focus:ring-2 focus:ring-ring focus:border-border-active",
              errors.some((e) => e.includes("id")) && "border-destructive",
            )}
            placeholder="Enter palette id"
            maxLength={LIMITS.MAX_ID_LENGTH}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-foreground-muted">
              {palette.id.length}/{LIMITS.MAX_ID_LENGTH}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-1 min-h-0",
            isMobile ? "flex-col gap-6" : "gap-6",
          )}
        >
          <div
            className={cn("min-h-0", isMobile ? "w-full order-2" : "flex-1")}
          >
            <div
              ref={gridContainerRef}
              className={cn(
                "h-[300px] overflow-y-auto pr-2 scrollbar-thin",
                isMobile && "h-[220px]",
              )}
            >
              <div
                className="grid gap-2 auto-rows-[1fr] pb-4"
                style={{
                  gridTemplateColumns: isMobile
                    ? "repeat(auto-fill, minmax(60px, 1fr))"
                    : "repeat(4, 1fr)", // Force 4 columns on desktop
                }}
              >
                <AddColorButton color={hexValue} onClick={addColor} />

                {displayColors.map((color, index) => (
                  <ColorTile
                    key={palette.colors.length - 1 - index}
                    color={color}
                    onRemove={() =>
                      removeColor(palette.colors.length - 1 - index)
                    }
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={cn(isMobile ? "w-full order-1" : "w-[200px]")}>
            <div className={cn("mb-6", isMobile && "flex justify-center")}>
              <HexColorPicker
                color={hexValue}
                onChange={handleHexChange}
                className={cn(isMobile && "w-[200px]")}
              />
            </div>

            <div className="space-y-6">
              <div
                className={cn(
                  "w-full flex justify-center",
                  isMobile ? "flex-row items-center gap-4" : "flex-col gap-4",
                )}
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium text-foreground mb-1">
                    HEX
                  </span>
                  <div className="flex items-center gap-2">
                    {isEyeDropperSupported && (
                      <button
                        onClick={handleEyeDropper}
                        className={cn(
                          "p-1.5 border rounded-md flex items-center justify-center transition-colors",
                          isPickerActive
                            ? "bg-primary hover:bg-primary-hover border-primary text-primary-foreground"
                            : "hover:bg-secondary-hover border-border text-foreground",
                        )}
                        title="Use eyedropper"
                        onBlur={() => validateHex(hexValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            validateHex(hexValue);
                          }
                        }}
                      >
                        <Pipette className="w-4 h-4" />
                      </button>
                    )}
                    <input
                      type="text"
                      value={hexValue}
                      onChange={(e) => handleHexChange(e.target.value)}
                      className={cn(
                        "w-24 px-2 py-1.5 text-xs text-center",
                        "bg-background border border-border rounded-md",
                        "focus:ring-2 focus:ring-ring focus:border-border-active",
                      )}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {(["r", "g", "b"] as const).map((label) => (
                    <RGBInput
                      key={label}
                      label={label.toUpperCase()}
                      value={selectedColor[label]}
                      onChange={(value) => handleRGBChange(label, value)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6">
                {errors.map((error, index) => (
                  <Alert key={index} variant="destructive" className="mb-2">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-border">
          <div className="text-sm text-foreground-muted">
            {palette.colors.length} / {LIMITS.MAX_COLORS} colors
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className={cn(
                "px-4 py-2 border text-sm rounded-md transition-colors",
                "bg-secondary hover:bg-secondary-hover border-border text-foreground",
                "disabled:opacity-50",
              )}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                "bg-primary text-primary-foreground",
                "hover:bg-primary-hover",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaletteEditor;
