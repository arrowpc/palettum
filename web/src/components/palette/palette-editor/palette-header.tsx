import React from "react";
import { cn, LIMITS } from "@/lib/utils";

interface PaletteHeaderProps {
  paletteName: string;
  onNameChange: (name: string) => void;
}

export const PaletteHeader = React.memo(function PaletteHeader({
  paletteName,
  onNameChange,
}: PaletteHeaderProps) {
  const isNameInvalid = paletteName.length > LIMITS.MAX_ID_LENGTH;

  return (
    <div className="mb-4 sm:mb-6">
      <input
        type="text"
        value={paletteName}
        onChange={(e) => onNameChange(e.target.value)}
        className={cn(
          "w-full px-3 py-2 text-lg font-semibold bg-background border-b-2 rounded-none",
          "focus:ring-0 focus:outline-none focus:border-primary",
          isNameInvalid ? "border-destructive" : "border-border",
        )}
        placeholder="Enter Palette Name"
        maxLength={LIMITS.MAX_ID_LENGTH}
        aria-invalid={isNameInvalid}
      />
    </div>
  );
});
