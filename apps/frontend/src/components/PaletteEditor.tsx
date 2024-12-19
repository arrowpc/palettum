import React, { useState, useEffect } from "react";
import { Trash2, Pipette, X, Plus } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  onSave: (palette: Palette) => void;
}

const rgbToHex = (color: Color): string => {
  return (
    "#" +
    [color.r, color.g, color.b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

const hexToRgb = (hex: string): Color | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
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
  const [selectedColor, setSelectedColor] = useState<Color>({
    r: 0,
    g: 0,
    b: 0,
  });
  const [hexValue, setHexValue] = useState<string>("#000000");
  const [isEyeDropperSupported, setIsEyeDropperSupported] =
    useState<boolean>(false);
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false);

  useEffect(() => {
    setIsEyeDropperSupported("EyeDropper" in window);
  }, []);

  useEffect(() => {
    setHexValue(rgbToHex(selectedColor));
  }, [selectedColor]);

  const handleHexChange = (hex: string) => {
    setHexValue(hex);
    const rgb = hexToRgb(hex);
    if (rgb) setSelectedColor(rgb);
  };

  const handleRGBChange = (component: keyof Color, value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(255, numValue));
    setSelectedColor((prev) => ({ ...prev, [component]: clampedValue }));
  };

  const handleEyeDropper = async () => {
    try {
      setIsPickerActive(true);
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      handleHexChange(result.sRGBHex);
    } catch (error) {
      console.error("EyeDropper error:", error);
    } finally {
      setIsPickerActive(false);
    }
  };

  const addColor = () => {
    setPalette((prev) => ({
      ...prev,
      colors: [...prev.colors, selectedColor],
    }));
  };

  const removeColor = (index: number) => {
    setPalette((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 flex flex-col w-[560px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Edit Palette</h2>
          <button
            onClick={onClose}
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
                onChange={(e) =>
                  setPalette((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter palette name"
              />
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
                    >
                      <Pipette
                        className={`w-4 h-4 ${isPickerActive ? "text-white" : "text-gray-600"}`}
                      />
                    </button>
                  )}
                  <input
                    type="text"
                    value={hexValue}
                    onChange={(e) => handleHexChange(e.target.value)}
                    className="w-24 px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-center"
                  />
                </div>
                <div className="w-24 ml-8">
                  <span className="text-xs font-medium text-gray-700 block text-center">
                    HEX
                  </span>
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
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(palette)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaletteEditor;
