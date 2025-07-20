import React, { useMemo, useCallback } from "react";
import {
  Copy,
  Download,
  Edit2,
  ExternalLink,
  MoreVertical,
  Sparkle,
  Trash2,
} from "lucide-react";
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

const ListActionButton = React.memo<{
  icon: React.ComponentType<{ className?: string }>;
  onClick: (e: React.MouseEvent) => void;
  label: string;
  disabled?: boolean;
  showTooltip: boolean;
  isParentHovered: boolean;
}>(({ icon: Icon, onClick, label, disabled, showTooltip, isParentHovered }) => (
  <TooltipWrapper content={label} shouldRender={showTooltip}>
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded transition-colors",
        disabled
          ? "text-muted-foreground cursor-not-allowed"
          : "text-foreground hover:bg-background",
        isParentHovered
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  </TooltipWrapper>
));

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
    isHovered && palette.colors.length > 3,
    200,
  );

  const displayedColors = useMemo(() => {
    return getDisplayedColors(palette, 3, colorCycleIndex);
  }, [palette, colorCycleIndex]);

  const handleAction = useCallback(
    (e: React.MouseEvent, action: () => void) => {
      e.stopPropagation();
      action();
    },
    [],
  );

  const actions = useMemo(() => {
    if (!isHovered) return [];

    return [
      {
        icon: Copy,
        onClick: (e: React.MouseEvent) => handleAction(e, onDuplicate),
        label: "Duplicate",
      },
      {
        icon: Download,
        onClick: (e: React.MouseEvent) => handleAction(e, onExport),
        label: "Export",
      },
      {
        icon: Edit2,
        onClick: (e: React.MouseEvent) => handleAction(e, onEdit),
        label: "Edit",
        disabled: palette.kind === "Default",
      },
      {
        icon: Trash2,
        onClick: (e: React.MouseEvent) => handleAction(e, onDelete),
        label: "Delete",
        disabled: palette.kind === "Default",
      },
    ];
  }, [
    isHovered,
    handleAction,
    onDuplicate,
    onExport,
    onEdit,
    onDelete,
    palette.kind,
  ]);

  const handleMobileMenuClick = useCallback(
    (e: React.MouseEvent) => {
      handleAction(e, onMobileMenu);
    },
    [handleAction, onMobileMenu],
  );

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex items-center gap-3 p-3 cursor-pointer transition-colors",
        selected
          ? "bg-primary/10 border-r-2 border-primary"
          : "hover:bg-muted/50",
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
        {palette.colors.length > 3 && (
          <div className="w-6 h-6 bg-muted flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">
              +{palette.colors.length - 3}
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
          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-2">
            {palette.kind === "Default" && (
              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded flex items-center gap-1">
                <Sparkle className="w-3 h-3" />
              </span>
            )}
            {palette.source && (
              <TooltipWrapper content="View source" shouldRender={isHovered}>
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
      </div>

      {/* Mobile */}
      <div className="sm:hidden flex items-center gap-2 ml-auto pr-2">
        {palette.kind === "Default" && (
          <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded flex items-center gap-1">
            <Sparkle className="w-3 h-3" />
          </span>
        )}
        {palette.source && (
          <TooltipWrapper content="View source" shouldRender={isHovered}>
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
        <button
          onClick={handleMobileMenuClick}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop Actions */}
      <div className="hidden sm:flex items-center gap-1 min-h-[36px]">
        {actions.map(({ icon, onClick, label, disabled }) => (
          <ListActionButton
            key={label}
            icon={icon}
            onClick={onClick}
            label={label}
            disabled={disabled}
            showTooltip={isHovered}
            isParentHovered={isHovered}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(PaletteListItem);
