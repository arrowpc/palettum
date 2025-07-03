import React from "react";
import { Pipette } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RGBInput } from "./rgb-input";
import { type Rgb } from "palettum";

interface ColorPickerControlProps {
  hexValue: string;
  onHexChange: (hex: string) => void;
  onValidateHexOnBlur: (hex: string) => void;
  rgbInputs: { r: string; g: string; b: string };
  onRGBInputChange: (component: keyof Rgb, value: string) => void;
  onRGBInputBlur: (component: keyof Rgb) => void;
  isEyeDropperSupported: boolean;
  isPickerActive: boolean;
  onEyeDropper: () => void;
  isMobile: boolean;
}

export const ColorPickerControl = React.memo(function ColorPickerControl({
  hexValue,
  onHexChange,
  onValidateHexOnBlur,
  rgbInputs,
  onRGBInputChange,
  onRGBInputBlur,
  isEyeDropperSupported,
  isPickerActive,
  onEyeDropper,
  isMobile,
}: ColorPickerControlProps) {
  return (
    <div className="p-3 border border-border/70 rounded-md bg-secondary/20 space-y-4">
      <div
        className={cn(
          "mx-auto w-full max-w-[200px]",
          isMobile && "max-w-[240px]",
        )}
      >
        <HexColorPicker
          color={hexValue}
          onChange={onHexChange}
          className="!w-full"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="hexInput"
            className="text-sm font-medium text-foreground whitespace-nowrap"
          >
            HEX:
          </label>
          <input
            id="hexInput"
            type="text"
            value={hexValue}
            onChange={(e) => onHexChange(e.target.value)}
            onBlur={() => onValidateHexOnBlur(hexValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onValidateHexOnBlur(hexValue);
            }}
            className="flex-1 min-w-0 px-2 py-1 text-sm text-center bg-background border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-border-active"
          />
          {isEyeDropperSupported && (
            <TooltipProvider>
              <Tooltip delayDuration={50}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onEyeDropper}
                    className={cn(
                      "p-2 border rounded-md flex items-center justify-center transition-colors flex-shrink-0",
                      isPickerActive
                        ? "bg-primary hover:bg-primary-hover border-primary text-primary-foreground"
                        : "hover:bg-muted border-border text-foreground",
                    )}
                  >
                    <Pipette className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Use eyedropper</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex justify-around items-center gap-2">
          {(["r", "g", "b"] as const).map((label) => (
            <RGBInput
              key={label}
              label={label.toUpperCase()}
              value={rgbInputs[label]}
              onChange={(value) => onRGBInputChange(label, value)}
              onBlur={() => onRGBInputBlur(label)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
