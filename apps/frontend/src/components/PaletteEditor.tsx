import React, { useState, useEffect } from "react";
import { Trash2, Pipette, X, Plus } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MAX_PALETTE_NAME_LENGTH = 50;
const MIN_COLORS = 1;
const MAX_COLORS = 256;
const DEFAULT_COLOR: Color = { r: 0, g: 0, b: 0 };

type Color = {
  r: number;
  g: number;
  b: number;
};

type Palette = {
  id: string;
  name: string;
  colors: Color[];
};

type ValidationError = {
  message: string;
  field?: string;
};

interface ColorTileProps {
  color: Color;
  onRemove: () => void;
}

interface RGBInputProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
}

interface PaletteEditorProps {
  palette: Palette;
  onClose: () => void;
  onSave: (palette: Palette) => Promise<void>;
}

const rgbToHex = (color: Color): string => {
  try {
    return (
      "#" +
      [color.r, color.g, color.b]
        .map((x) => {
          const hex = Math.max(0, Math.min(255, x)).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  } catch (error) {
    console.error("RGB to HEX conversion error:", error);
    return "#000000";
  }
};

const hexToRgb = (hex: string): Color | null => {
  try {
    const normalized = hex.charAt(0) === "#" ? hex : `#${hex}`;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
    if (!result) return null;

    const [, r, g, b] = result;
    return {
      r: parseInt(r, 16),
      g: parseInt(g, 16),
      b: parseInt(b, 16),
    };
  } catch (error) {
    console.error("HEX to RGB conversion error:", error);
    return null;
  }
};

const validatePalette = (palette: Palette): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!palette.name.trim()) {
    errors.push({ message: "Palette name is required", field: "name" });
  }

  if (palette.name.length > MAX_PALETTE_NAME_LENGTH) {
    errors.push({
      message: `Name must be ${MAX_PALETTE_NAME_LENGTH} characters or less`,
      field: "name",
    });
  }

  if (palette.colors.length < MIN_COLORS) {
    errors.push({
      message: `Palette must have at least ${MIN_COLORS} color`,
      field: "colors",
    });
  }

  if (palette.colors.length > MAX_COLORS) {
    errors.push({
      message: `Palette cannot have more than ${MAX_COLORS} colors`,
      field: "colors",
    });
  }

  return errors;
};

const ColorTile: React.FC<ColorTileProps> = ({ color, onRemove }) => (
  <TooltipProvider>
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>
        <div className="relative group">
          <div
            className="aspect-square rounded-lg shadow-sm hover:shadow-md transition-all duration-150 border border-gray-200"
            style={{ backgroundColor: rgbToHex(color) }}
          />
          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-all duration-150">
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors transform hover:scale-110"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            </div>
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
    <span className="text-xs font-medium text-gray-700 mb-1">{label}</span>
    <input
      type="number"
      min="0"
      max="255"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-12 px-1 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-center [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  </div>
);

export const PaletteEditor: React.FC<PaletteEditorProps> = ({
  palette: initialPalette,
  onClose,
  onSave,
}) => {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [selectedColor, setSelectedColor] = useState<Color>(DEFAULT_COLOR);
  const [hexValue, setHexValue] = useState<string>("#000000");
  const [isEyeDropperSupported, setIsEyeDropperSupported] =
    useState<boolean>(false);
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  useEffect(() => {
    const hasChanges =
      JSON.stringify(palette) !== JSON.stringify(initialPalette);
    setHasUnsavedChanges(hasChanges);
  }, [palette, initialPalette]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    setIsEyeDropperSupported("EyeDropper" in window);
  }, []);

  useEffect(() => {
    try {
      setHexValue(rgbToHex(selectedColor));
    } catch (error) {
      console.error("Error updating hex value:", error);
      setHexValue("#000000");
    }
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
  };

  const validateHex = (hex: string) => {
    if (!isValidHex(hex)) {
      setErrors([{ message: "Invalid hex color code" }]);

      setHexValue(rgbToHex(selectedColor));
      return;
    }

    const rgb = hexToRgb(hex);
    if (rgb) {
      setSelectedColor(rgb);
      setErrors([]);
    } else {
      setErrors([{ message: "Invalid hex color code" }]);
      setHexValue(rgbToHex(selectedColor));
    }
  };

  const handleRGBChange = (component: keyof Color, value: string) => {
    try {
      const numValue = parseInt(value) || 0;
      const clampedValue = Math.max(0, Math.min(255, numValue));
      setSelectedColor((prev) => ({ ...prev, [component]: clampedValue }));
    } catch (error) {
      console.error("Error updating RGB value:", error);
    }
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
      console.error("EyeDropper error:", error);
      setErrors((prev) => [
        ...prev,
        {
          message: "Failed to access color picker. Please try again.",
        },
      ]);
    } finally {
      setIsPickerActive(false);
    }
  };

  const addColor = () => {
    setErrors([]);

    if (palette.colors.length >= MAX_COLORS) {
      setErrors([
        {
          message: `Cannot add more than ${MAX_COLORS} colors`,
          field: "colors",
        },
      ]);
      return;
    }

    const isDuplicate = palette.colors.some(
      (color) =>
        color.r === selectedColor.r &&
        color.g === selectedColor.g &&
        color.b === selectedColor.b,
    );

    if (isDuplicate) {
      setErrors([
        {
          message: "This color is already in the palette",
          field: "colors",
        },
      ]);
      return;
    }

    setPalette((prev) => ({
      ...prev,
      colors: [...prev.colors, selectedColor],
    }));
    setHasUnsavedChanges(true);
  };

  const removeColor = (index: number) => {
    setErrors([]);

    if (palette.colors.length <= MIN_COLORS) {
      setErrors([
        {
          message: `Cannot remove the last color`,
          field: "colors",
        },
      ]);
      return;
    }

    setPalette((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
    setHasUnsavedChanges(true);
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
      console.error("Error saving palette:", error);
      setErrors([{ message: "Failed to save palette. Please try again." }]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 flex flex-col w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Edit Palette</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Palette Name
              </label>
              <input
                type="text"
                value={palette.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  if (newName.length <= MAX_PALETTE_NAME_LENGTH) {
                    setPalette((prev) => ({ ...prev, name: newName }));
                    setHasUnsavedChanges(true);
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some((e) => e.field === "name") ? "border-red-500" : ""
                  }`}
                placeholder="Enter palette name"
                maxLength={MAX_PALETTE_NAME_LENGTH}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {palette.name.length}/{MAX_PALETTE_NAME_LENGTH}
                </span>
                {errors.some((e) => e.field === "name") && (
                  <span className="text-xs text-red-500">
                    {errors.find((e) => e.field === "name")?.message}
                  </span>
                )}
              </div>
            </div>

            <div className="h-[300px] overflow-y-auto pr-2">
              <div className="grid grid-cols-4 gap-2 auto-rows-[1fr] pb-8">
                {palette.colors.map((color, index) => (
                  <ColorTile
                    key={index}
                    color={color}
                    onRemove={() => removeColor(index)}
                  />
                ))}
                <div className="relative">
                  <div
                    className="aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer group border border-gray-200"
                    onClick={addColor}
                  >
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: hexValue }}
                    />
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-all duration-150 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transform group-hover:scale-110 transition-all duration-150">
                        <Plus className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[200px]">
            <div className="mb-6">
              <HexColorPicker color={hexValue} onChange={handleHexChange} />
            </div>

            <div className="space-y-6">
              <div className="w-full flex flex-col items-center space-y-1">
                <div className="flex items-center gap-2">
                  {isEyeDropperSupported && (
                    <button
                      onClick={handleEyeDropper}
                      className={`p-1.5 border rounded-lg flex items-center justify-center transition-colors ${isPickerActive
                          ? "bg-gray-900 hover:bg-gray-800"
                          : "hover:bg-gray-50"
                        }`}
                      title="Use eyedropper"
                      onBlur={() => validateHex(hexValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          validateHex(hexValue);
                        }
                      }}
                    >
                      <Pipette
                        className={`w-4 h-4 ${isPickerActive ? "text-white" : "text-gray-600"
                          }`}
                      />
                    </button>
                  )}
                  <input
                    type="text"
                    value={hexValue}
                    onChange={(e) => handleHexChange(e.target.value)}
                    className="w-24 px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-center"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="w-full px-2">
                <div className="flex justify-between">
                  {(["R", "G", "B"] as const).map((label) => (
                    <RGBInput
                      key={label}
                      label={label}
                      value={selectedColor[label.toLowerCase() as keyof Color]}
                      onChange={(value) =>
                        handleRGBChange(
                          label.toLowerCase() as keyof Color,
                          value,
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6">
                {errors.map((error, index) => (
                  <Alert key={index} variant="destructive" className="mb-2">
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t">
          <div className="text-sm text-gray-500">
            {palette.colors.length} / {MAX_COLORS} colors
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaletteEditor;
