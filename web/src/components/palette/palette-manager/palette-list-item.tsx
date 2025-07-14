import React, { useMemo } from "react";
import { Copy, Download, Edit2, ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import { rgbToHex, cn, getDisplayedColors } from "@/lib/utils";
import { useColorCycle } from "@/hooks/use-color-cycle";
import { type Palette } from "palettum";
import TooltipWrapper from "./tooltip-wrapper";

interface Props {
  palette: Palette;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMobileMenu: () => void;
}

const PaletteListItem: React.FC<Props> = ({
  palette,
  selected,
  onSelect,
  onDuplicate,
  onExport,
  onEdit,
  onDelete,
  onMobileMenu,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  const colorCycleIndex = useColorCycle(
    palette.colors.length,
    isHovered && palette.colors.length > 4,
    200
  );

  const displayedColors = useMemo(() => {
    return getDisplayedColors(palette, 4, colorCycleIndex);
  }, [palette, colorCycleIndex]);

  const actions = [
    { icon: Copy, onClick: onDuplicate, label: "Duplicate" },
    { icon: Download, onClick: onExport, label: "Export" },
    { icon: Edit2, onClick: onEdit, label: "Edit", disabled: palette.kind === "Default" },
    { icon: Trash2, onClick: onDelete, label: "Delete", disabled: palette.kind === "Default" },
  ];

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex items-center gap-3 p-3 cursor-pointer transition-colors",
        selected 
          ? "bg-primary/10 border-r-2 border-primary" 
          : "hover:bg-muted/50"
      )}
    >
      {/* Colors */}
      <div className="flex rounded overflow-hidden shadow-sm">
        {displayedColors.map((color, i) => (
          <div
            key={i}
            className="w-6 h-6"
            style={{ backgroundColor: rgbToHex(color) }}
          />
        ))}
        {palette.colors.length > 4 && (
          <div className="w-6 h-6 bg-muted flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">
              +{palette.colors.length - 4}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
            {palette.id}
          </span>
          {palette.kind === "Default" && (
            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
              Default
            </span>
          )}
          {palette.source && (
            <TooltipWrapper content="View source">
              <a
                href={palette.source}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </TooltipWrapper>
          )}
        </div>
      </div>

      {/* Desktop Actions */}
      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {actions.map(({ icon: Icon, onClick, label, disabled }) => (
          <TooltipWrapper key={label} content={label}>
            <button
              onClick={(e) => handleAction(e, onClick)}
              disabled={disabled}
              className={cn(
                "p-1.5 rounded transition-colors",
                disabled 
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-foreground hover:bg-background"
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          </TooltipWrapper>
        ))}
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={(e) => handleAction(e, onMobileMenu)}
        className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
};

export default React.memo(PaletteListItem);
