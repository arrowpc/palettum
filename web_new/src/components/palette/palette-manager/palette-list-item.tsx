import React from "react";
import {
  Copy,
  Download,
  Edit2,
  ExternalLink,
  MoreVertical,
  Trash2,
} from "lucide-react";
import TooltipWrapper from "./tooltip-wrapper";
import { rgbToHex, cn, getDisplayedColors } from "@/lib/utils";
import { type Palette, type Rgb } from "palettum";
import { useColorCycle } from "@/hooks/use-color-cycle";

const chip =
  "w-color-square h-color-square rounded-sm ring-1 ring-border bg-background";

interface ItemProps {
  palette: Palette;
  selected: boolean;
  hovered: boolean;
  // startIndex: number; // REMOVED: This is now managed internally
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMobileMenu: () => void;
  onHoverOn: () => void;
  onHoverOff: () => void;
}

const PaletteListItem: React.FC<ItemProps> = ({
  palette,
  selected,
  hovered,
  onSelect,
  onDuplicate,
  onExport,
  onEdit,
  onDelete,
  onMobileMenu,
  onHoverOn,
  onHoverOff,
}) => {
  // NEW: Manage startIndex internally based on hovered state
  const startIndex = useColorCycle(
    palette.colors.length,
    hovered && palette.colors.length > 3, // Only cycle if hovered and enough colors (e.g., > 3 displayed)
    200,
  );

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr,80px,auto] items-center p-3 cursor-pointer",
        selected ? "bg-secondary/50" : "hover:bg-secondary",
      )}
      onClick={onSelect}
      onMouseEnter={onHoverOn}
      onMouseLeave={onHoverOff}
    >
      <div className="flex items-center min-w-0">
        <div className="flex flex-col">
          <span className="truncate max-w-[180px]">{palette.id}</span>
          {palette.kind === "Default" && (
            <span className="text-xs text-foreground-muted">(default)</span>
          )}
        </div>
        {palette.source && (
          <TooltipWrapper enabled={hovered} content="View source">
            <a
              href={palette.source}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-1.5 shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </TooltipWrapper>
        )}
      </div>

      <div className="flex justify-center">
        <div className="flex -space-x-1">
          {getDisplayedColors(palette, 3, startIndex).map(
            (color: Rgb, i: number) => (
              <div
                key={i}
                className={chip}
                style={{ backgroundColor: rgbToHex(color) }}
              />
            ),
          )}
        </div>
      </div>

      <div className="hidden sm:flex justify-end gap-1">
        <TooltipWrapper enabled={hovered} content="Duplicate">
          <button onClick={onDuplicate} className="p-1.5 cursor-pointer">
            <Copy className="w-4 h-4" />
          </button>
        </TooltipWrapper>

        <TooltipWrapper enabled={hovered} content="Export">
          <button onClick={onExport} className="p-1.5 cursor-pointer">
            <Download className="w-4 h-4" />
          </button>
        </TooltipWrapper>

        <TooltipWrapper enabled={hovered} content="Edit">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (palette.kind === "Custom") onEdit();
            }}
            className={cn(
              "p-1.5 cursor-pointer",
              palette.kind === "Default" ? "opacity-50 cursor-not-allowed" : "",
            )}
            disabled={palette.kind === "Default"}
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </TooltipWrapper>

        <TooltipWrapper enabled={hovered} content="Delete">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (palette.kind === "Custom") onDelete();
            }}
            className={cn(
              "p-1.5 cursor-pointer",
              palette.kind === "Default" ? "opacity-50 cursor-not-allowed" : "",
            )}
            disabled={palette.kind === "Default"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </TooltipWrapper>
      </div>

      <div className="flex sm:hidden justify-end">
        <button
          className="p-2"
          onClick={(e) => {
            e.stopPropagation();
            onMobileMenu();
          }}
          aria-label="Show actions"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default React.memo(PaletteListItem);
