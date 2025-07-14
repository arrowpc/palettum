import React, { useRef, useLayoutEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { rgbToHex, cn } from "@/lib/utils";
import { type Palette } from "palettum";
import { useColorCycle } from "@/hooks/use-color-cycle";

interface Props {
  palette: Palette;
  isOpen: boolean;
  onToggle: () => void;
}

const CHIP_WIDTH = 16; 
const CHIP_GAP = 0;    
const COLOR_RING = "";
const COLOR_BASE = `${COLOR_RING} w-6 h-6`;

const PalettePreview: React.FC<Props> = ({ palette, isOpen, onToggle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState<number>(palette.colors.length);

  useLayoutEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      let chips = palette.colors.length;
      let total = chips * CHIP_WIDTH + (chips - 1) * CHIP_GAP;
      while (chips > 1 && total > width) {
        chips--;
        total = (chips + 1) * CHIP_WIDTH + chips * CHIP_GAP;
      }
      setMaxVisible(chips);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [palette.colors.length]);

  const index = useColorCycle(
    palette.colors.length,
    palette.colors.length > maxVisible
  );

  const visible =
    palette.colors.length > maxVisible
      ? [...Array(maxVisible).keys()].map(
          (i) => palette.colors[(index + i) % palette.colors.length]
        )
      : palette.colors;

  const hiddenCount =
    palette.colors.length > maxVisible
      ? palette.colors.length - maxVisible
      : 0;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center p-3 bg-background border border-border rounded-md shadow-sm hover:bg-secondary"
    >
      <span className="truncate mr-2">{palette.id}</span>
      <div
        className="flex-1 flex items-center justify-end gap-2 min-w-0"
        ref={containerRef}
      >
        <div className="flex min-w-0">
          {visible.map((c, i) => (
            <div
              key={i}
              className={COLOR_BASE}
              style={{ backgroundColor: rgbToHex(c) }}
            />
          ))}
          {hiddenCount > 0 && (
            <div
              className={`${COLOR_BASE} bg-secondary flex items-center justify-center`}
            >
              <span className="text-xs font-medium">+{hiddenCount}</span>
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </div>
    </button>
  );
};

export default PalettePreview;
