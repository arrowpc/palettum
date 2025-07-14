import { Search, Plus, Upload } from "lucide-react";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { type Palette } from "palettum";
import PaletteListItem from "./palette-list-item";

interface Props {
  open: boolean;
  anchorRef: React.RefObject<HTMLDivElement>;
  search: string;
  onSearch: (s: string) => void;
  palettes: Palette[];
  hoveredId: string | null;
  selectedId: string;
  onSelect: (p: Palette) => void;
  onHoverOn: (id: string) => void;
  onHoverOff: () => void;
  onDuplicate: (p: Palette) => void;
  onExport: (p: Palette) => void;
  onEdit: (p: Palette) => void;
  onDelete: (id: string) => void;
  onMobileMenu: (id: string) => void;
  onNewPalette: () => void;
  onImport: () => void;
  close: () => void;
}

const PaletteDropdown: React.FC<Props> = ({
  open,
  anchorRef,
  search,
  onSearch,
  palettes,
  hoveredId,
  selectedId,
  ...actions
}) => {
  useOutsideClick(anchorRef, actions.close, open);

  if (!open) return null;

  return (
    <div className="absolute z-10 w-full mt-2 bg-background border border-border rounded-md shadow-md flex flex-col">
      {/* search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <input
            type="text"
            placeholder="Search palettes…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* list */}
      <div className="overflow-y-auto max-h-[175px]">
        {palettes.map((p) => (
          <PaletteListItem
            key={p.id}
            palette={p}
            selected={p.id === selectedId}
            hovered={p.id === hoveredId}
            onSelect={() => actions.onSelect(p)}
            onDuplicate={() => actions.onDuplicate(p)}
            onExport={() => actions.onExport(p)}
            onEdit={() => actions.onEdit(p)}
            onDelete={() => actions.onDelete(p.id)}
            onMobileMenu={() => actions.onMobileMenu(p.id)}
            onHoverOn={() => actions.onHoverOn(p.id)}
            onHoverOff={actions.onHoverOff}
          />
        ))}
      </div>

      {/* footer */}
      <div className="border-t border-border p-2 flex justify-between">
        <button
          className="flex items-center px-3 py-1.5 hover:bg-secondary rounded"
          onClick={actions.onNewPalette}
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Palette
        </button>
        <button
          className="flex items-center px-3 py-1.5 hover:bg-secondary rounded"
          onClick={actions.onImport}
        >
          <Upload className="w-4 h-4 mr-1.5" /> Import
        </button>
      </div>
    </div>
  );
};

export default PaletteDropdown;
