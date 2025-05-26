import React from "react";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/palettes";

interface PaletteEditorActionsProps {
  paletteColorCount: number;
  onClose: () => void;
  onSave: () => void;
  canSave: boolean;
}

export const PaletteEditorActions: React.FC<PaletteEditorActionsProps> =
  React.memo(({ paletteColorCount, onClose, onSave, canSave }) => {
    return (
      <div className="flex justify-between items-center gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
        <div className="text-sm text-foreground-muted">
          {paletteColorCount} / {LIMITS.MAX_COLORS} colors
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className={cn(
              "px-3 py-2 sm:px-4 border text-sm rounded-md transition-colors",
              "bg-secondary hover:bg-secondary-hover border-border text-foreground",
              "disabled:opacity-50",
            )}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className={cn(
              "px-3 py-2 sm:px-4 text-sm rounded-md transition-colors",
              "bg-primary text-primary-foreground",
              "hover:bg-primary-hover",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            Save
          </button>
        </div>
      </div>
    );
  });
