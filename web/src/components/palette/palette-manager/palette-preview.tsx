import React, { useRef, useLayoutEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Edit2, Trash2 } from "lucide-react";
import { rgbToHex, cn } from "@/lib/utils";
import { type Palette } from "palettum";
import { useColorCycle } from "@/hooks/use-color-cycle";
import TooltipWrapper from "./tooltip-wrapper";

interface Props {
  palette: Palette;
  isOpen: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  canCycle: boolean;
}

const PalettePreview: React.FC<Props> = ({
  palette,
  isOpen,
  onToggle,
  onPrevious,
  onNext,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  canCycle,
}) => {
  const colorsRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState<number>(palette.colors.length);

  useLayoutEffect(() => {
    const update = () => {
      if (!colorsRef.current) return;
      const containerWidth = colorsRef.current.offsetWidth;
      const colorSize = 32; // 8 * 4 = 32px for w-8 h-8
      const maxColors = Math.floor(containerWidth / colorSize);
      setMaxVisible(Math.max(1, maxColors));
    };
    
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [palette.colors.length]);

  const colorCycleIndex = useColorCycle(
    palette.colors.length,
    palette.colors.length > maxVisible,
    150
  );

  const visibleColors = palette.colors.length > maxVisible
    ? [...Array(maxVisible - 1).keys()].map(
        (i) => palette.colors[(colorCycleIndex + i) % palette.colors.length]
      )
    : palette.colors;

  const hiddenCount = palette.colors.length > maxVisible 
    ? palette.colors.length - maxVisible + 1 
    : 0;

  const actions = [
    { icon: Copy, onClick: onDuplicate, label: "Duplicate" },
    { icon: Download, onClick: onExport, label: "Export" },
    { icon: Edit2, onClick: onEdit, label: "Edit", disabled: palette.kind === "Default" },
    { icon: Trash2, onClick: onDelete, label: "Delete", disabled: palette.kind === "Default" },
  ];

  return (
    <div className="bg-card rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="font-medium text-foreground truncate">
            {palette.id}
          </h3>
          {palette.kind === "Default" && (
            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
              Default
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-1">
            {actions.map(({ icon: Icon, onClick, label, disabled }) => (
              <TooltipWrapper key={label} content={label}>
                <button
                  onClick={onClick}
                  disabled={disabled}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    disabled 
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              </TooltipWrapper>
            ))}
          </div>

          {/* Palette Navigation */}
          {canCycle && (
            <div className="flex items-center gap-1 ml-2">
              <TooltipWrapper content="Previous palette">
                <button
                  onClick={onPrevious}
                  className="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </TooltipWrapper>
              <TooltipWrapper content="Next palette">
                <button
                  onClick={onNext}
                  className="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </TooltipWrapper>
            </div>
          )}
        </div>
      </div>

      {/* Colors and Dropdown */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <div ref={colorsRef} className="flex-1">
            <div className="flex rounded-md overflow-hidden shadow-sm">
              {visibleColors.map((color, i) => (
                <div
                  key={i}
                  className="h-8 flex-1 min-w-0"
                  style={{ backgroundColor: rgbToHex(color) }}
                />
              ))}
              {hiddenCount > 0 && (
                <div className="h-8 w-8 bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    +{hiddenCount}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <TooltipWrapper content="Browse palettes">
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-muted text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
          </TooltipWrapper>
        </div>
      </div>
    </div>
  );
};

export default PalettePreview;
