import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContrastColor, getOppositeTextColor } from "@/lib/utils";

interface AddColorButtonProps {
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

export const AddColorButton: React.FC<AddColorButtonProps> = React.memo(
  ({ color, onClick, disabled }) => {
    const iconBg = getContrastColor(color, 0.8);
    const iconColor = getOppositeTextColor(color);

    return (
      <div className="relative">
        <div
          className={cn(
            "aspect-square rounded-md overflow-hidden group",
            "border border-border",
            "shadow-sm hover:shadow-md",
            "transition-all duration-150",
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-primary",
          )}
          onClick={!disabled ? onClick : undefined}
          title={disabled ? "Palette is full" : "Add current color to palette"}
        >
          <div className="w-full h-full" style={{ backgroundColor: color }} />
          {!disabled && (
            <div
              className={cn(
                "absolute inset-0 rounded-md flex items-center justify-center",
                "group-hover:bg-background/20",
                "transition-all duration-150",
              )}
            >
              <div
                className="w-6 h-6 rounded-full shadow-md flex items-center justify-center transform group-hover:scale-110 transition-all duration-150"
                style={{
                  background: iconBg,
                }}
              >
                <Plus className="w-4 h-4" style={{ color: iconColor }} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);
