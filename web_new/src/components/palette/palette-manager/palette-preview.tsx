import { ChevronDown } from "lucide-react";
import { rgbToHex } from "@/lib/utils";
import { type Palette } from "palettum";
import { cn } from "@/lib/utils";
import { useColorCycle } from "@/hooks/use-color-cycle";

interface Props {
  palette: Palette;
  isOpen: boolean;
  onToggle: () => void;
}

const chipCls =
  "w-color-square h-color-square rounded-sm ring-1 ring-border bg-background";

const PalettePreview: React.FC<Props> = ({ palette, isOpen, onToggle }) => {
  const MAX_VISIBLE = 5;
  const index = useColorCycle(
    palette.colors.length,
    palette.colors.length > MAX_VISIBLE,
  );

  const visible =
    palette.colors.length > MAX_VISIBLE
      ? [...Array(MAX_VISIBLE).keys()].map(
        (i) => palette.colors[(index + i) % palette.colors.length],
      )
      : palette.colors;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center p-3 bg-background border border-border rounded-md shadow-sm hover:bg-secondary"
    >
      <span className="truncate mr-2">{palette.id}</span>

      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <div className="flex -space-x-1">
          {visible.map((c, i) => (
            <div
              key={i}
              className={chipCls}
              style={{ backgroundColor: rgbToHex(c) }}
            />
          ))}
          {palette.colors.length > MAX_VISIBLE && (
            <div
              className={`${chipCls} bg-secondary flex items-center justify-center`}
            >
              <span className="text-xs font-medium">
                +{palette.colors.length - MAX_VISIBLE}
              </span>
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </div>
    </button>
  );
};

export default PalettePreview;
