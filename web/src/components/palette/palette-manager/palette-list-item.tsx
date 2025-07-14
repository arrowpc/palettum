import React, { useMemo } from "react";
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
import { useColorCycle } from "@/hooks/use-color-cycle";
import { type Palette, type Rgb } from "palettum";

const COLOR_SIZE = "w-6 h-6";
const COLOR_RING = "";
const COLOR_BASE = `rounded-xs ${COLOR_RING} ${COLOR_SIZE}`;

interface Props {
  palette: Palette;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMobileMenu: () => void;
  onHoverOn: () => void;
  onHoverOff: () => void;
}

const PaletteCard: React.FC<Props> = ({
  palette,
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
  const startIndex = useColorCycle(
    palette.colors.length,
    hovered && palette.colors.length > 3,
    200,
  );

  const colours = useMemo(
    () =>
      getDisplayedColors(palette, 3, startIndex).map(
        (c: Rgb, i: number) => (
          <div
            key={i}
            className={COLOR_BASE}
            style={{ backgroundColor: rgbToHex(c) }}
          />
        ),
      ),
    [palette, startIndex],
  );

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const desktopActions = [
    {
      label: "Duplicate",
      icon: Copy,
      onClick: onDuplicate,
      disabled: false,
    },
    {
      label: "Export",
      icon: Download,
      onClick: onExport,
      disabled: false,
    },
    {
      label: "Edit",
      icon: Edit2,
      onClick: onEdit,
      disabled: palette.kind === "Default",
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
      disabled: palette.kind === "Default",
    },
  ] as const;

  return (
    <li
  onClick={onSelect}
  onMouseEnter={onHoverOn}
  onMouseLeave={onHoverOff}
  className={cn(
    "relative isolate overflow-hidden rounded-md",
    "cursor-pointer transition-colors duration-150",
    "hover:bg-secondary/40",
  )}
>
  <div
    className={cn(
      "grid grid-cols-[1fr_auto] items-center",
      "gap-x-4 px-4 py-3",
    )}
  >
    <header className="min-w-[9rem]">
      <div className="truncate font-medium leading-none">
        {palette.id}
      </div>
      {palette.kind === "Default" && (
        <span className="text-xs text-muted-foreground">
          (default)
        </span>
      )}
      {palette.source && (
        <TooltipWrapper enabled={hovered} content="View source">
          <a
            href={palette.source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            className="ml-1 inline-block align-middle"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </TooltipWrapper>
      )}
    </header>

    <div className="flex items-center gap-3">
      <div className="flex -space-x-1">
        {colours}
      </div>
      <aside className="hidden sm:flex items-center gap-1">
        {desktopActions.map(
          ({ label, icon: Icon, onClick, disabled }) => (
            <TooltipWrapper
              key={label}
              enabled={hovered}
              content={label}
            >
              <button
                disabled={disabled}
                onClick={(e) => {
                  stop(e);
                  if (!disabled) onClick();
                }}
                className={cn(
                  "grid place-items-center p-1.5",
                  disabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-accent rounded",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            </TooltipWrapper>
          ),
        )}
      </aside>
    </div>
  </div>

  <button
    onClick={(e) => {
      stop(e);
      onMobileMenu();
    }}
    className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center sm:hidden"
    aria-label="Show actions"
  >
    <MoreVertical className="h-5 w-5" />
  </button>
</li>

  );
};

export default React.memo(PaletteCard);
