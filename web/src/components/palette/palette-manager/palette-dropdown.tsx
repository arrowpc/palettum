import React, { useMemo, useCallback } from "react";
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
  selectedId: string;
  onSelect: (p: Palette) => void;
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
  selectedId,
  onSelect,
  onDuplicate,
  onExport,
  onEdit,
  onDelete,
  onMobileMenu,
  onNewPalette,
  onImport,
  close,
}) => {
  useOutsideClick(anchorRef, close, open);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  }, [onSearch]);

  const emptyState = useMemo(() => (
    <div className="p-4 text-center text-muted-foreground">
      No palettes found
    </div>
  ), []);

  const paletteList = useMemo(() => {
    return palettes.map((palette) => (
      <PaletteListItem
        key={palette.id}
        palette={palette}
        selected={palette.id === selectedId}
        onSelect={() => onSelect(palette)}
        onDuplicate={() => onDuplicate(palette)}
        onExport={() => onExport(palette)}
        onEdit={() => onEdit(palette)}
        onDelete={() => onDelete(palette.id)}
        onMobileMenu={() => onMobileMenu(palette.id)}
      />
    ));
  }, [palettes, selectedId, onSelect, onDuplicate, onExport, onEdit, onDelete, onMobileMenu]);

  if (!open) return null;

  return (
    <div className="absolute z-50 w-full mt-2 bg-card rounded-lg shadow-lg border border-border overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search palettes..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* Palette List */}
      <div className="max-h-64 overflow-y-auto">
        {palettes.length === 0 ? emptyState : paletteList}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex gap-2">
          <button
            onClick={onNewPalette}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Palette
          </button>
          <button
            onClick={onImport}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-background border border-border rounded-md hover:bg-muted transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PaletteDropdown);
