import { useState, useRef, useEffect } from "react";
import { ChevronDown, Edit2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import PaletteEditor from "./PaletteEditor";
import {
  type Color,
  type Palette,
  defaultPalettes,
  rgbToHex,
} from "@/lib/palettes";

interface PaletteManagerProps {
  onPaletteSelect: (colors: Color[]) => void;
}

function PaletteManager({ onPaletteSelect }: PaletteManagerProps) {
  const [selectedPalette, setSelectedPalette] = useState<Palette>(
    defaultPalettes[0],
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<Palette | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [palettes, setPalettes] = useState<Palette[]>([...defaultPalettes]);
  const [maxVisibleColors, setMaxVisibleColors] = useState(5);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPaletteSelect(selectedPalette.colors);
  }, [selectedPalette, onPaletteSelect]);

  useEffect(() => {
    const updateVisibleColors = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        const colorWidth = 20;
        const spacingWidth = 4;
        const minCounterWidth = 32;
        const availableWidth = containerWidth - minCounterWidth;
        const maxColors = Math.floor(
          availableWidth / (colorWidth + spacingWidth),
        );
        setMaxVisibleColors(Math.max(1, maxColors));
      }
    };

    updateVisibleColors();
    const resizeObserver = new ResizeObserver(updateVisibleColors);
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const handleCreatePalette = () => {
    const newPalette: Palette = {
      id: crypto.randomUUID(),
      name: "New Palette",
      colors: [],
    };
    setEditingPalette(newPalette);
    setIsEditModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleEditPalette = (palette: Palette) => {
    setEditingPalette({ ...palette });
    setIsEditModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleSavePalette = async (updatedPalette: Palette) => {
    setPalettes((currentPalettes) => {
      const existingPaletteIndex = currentPalettes.findIndex(
        (p) => p.id === updatedPalette.id,
      );

      if (existingPaletteIndex === -1) {
        return [...currentPalettes, updatedPalette];
      }

      const newPalettes = [...currentPalettes];
      newPalettes[existingPaletteIndex] = updatedPalette;
      return newPalettes;
    });

    setSelectedPalette(updatedPalette);
    setIsEditModalOpen(false);
    setEditingPalette(null);
  };

  const handleCloseEditor = () => {
    setIsEditModalOpen(false);
    setEditingPalette(null);
  };

  const filteredPalettes = palettes.filter((palette) =>
    palette.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="relative">
      <div className="relative w-full">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center p-3 bg-dropdown-background border border-dropdown-border rounded-lg shadow-sm hover:bg-dropdown-hover transition-colors"
        >
          <span className="font-medium truncate mr-2 max-w-palette-name text-dropdown-text-primary">
            {selectedPalette.name}
          </span>
          <div className="flex items-center justify-end gap-2 flex-1">
            <div
              ref={previewContainerRef}
              className="flex items-center justify-end min-w-0 flex-1"
            >
              <div className="flex -space-x-1">
                {selectedPalette.colors
                  .slice(0, maxVisibleColors)
                  .map((color: Color, i: number) => (
                    <div
                      key={i}
                      className="w-color-square h-color-square rounded-sm ring-1 ring-gray-200 bg-[#f5f5f5]"
                      style={{ backgroundColor: rgbToHex(color) }}
                    />
                  ))}
                {selectedPalette.colors.length > maxVisibleColors && (
                  <div className="w-color-square h-color-square rounded-sm ring-1 ring-gray-200 flex items-center justify-center bg-palette-preview-more-background">
                    <span className="scale-90 text-xs font-medium text-palette-preview-more-text">
                      +{selectedPalette.colors.length - maxVisibleColors}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "w-5 h-5 transition-transform flex-shrink-0 text-dropdown-icon",
                isDropdownOpen && "rotate-180",
              )}
            />
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-2 bg-dropdown-background border border-dropdown-border rounded-lg shadow-dropdown flex flex-col">
            <div className="p-2 border-b border-dropdown-border">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search palettes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-search-border rounded focus:outline-none focus:ring-1 focus:ring-search-ring bg-search-background placeholder-search-placeholder"
                />
                <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-search-icon" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 max-h-[175px]">
              {filteredPalettes.map((palette) => (
                <div
                  key={palette.id}
                  className="flex items-center justify-between p-3 hover:bg-dropdown-hover cursor-pointer"
                  onClick={() => {
                    setSelectedPalette(palette);
                    setIsDropdownOpen(false);
                  }}
                >
                  <span className="truncate max-w-palette-name text-dropdown-text-primary">
                    {palette.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {palette.colors
                        .slice(0, 3)
                        .map((color: Color, i: number) => (
                          <div
                            key={i}
                            className="w-color-square h-color-square rounded-sm ring-1 ring-gray-200 bg-[#f5f5f5]"
                            style={{ backgroundColor: rgbToHex(color) }}
                          />
                        ))}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPalette(palette);
                      }}
                      className="p-2 text-dropdown-icon hover:text-dropdown-icon-hover"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center p-3 border-t border-dropdown-border hover:bg-dropdown-hover cursor-pointer"
              onClick={handleCreatePalette}
            >
              <Plus className="w-4 h-4 mr-2 text-dropdown-icon" />
              <span className="text-dropdown-text-primary">
                Create New Palette
              </span>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && editingPalette && (
        <PaletteEditor
          palette={editingPalette}
          onClose={handleCloseEditor}
          onSave={handleSavePalette}
        />
      )}
    </div>
  );
}

export default PaletteManager;
