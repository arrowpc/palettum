import { useState, useRef, useEffect } from "react";
import { ChevronDown, Edit2, Plus, Search } from "lucide-react";
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
          className="w-full flex items-center p-3 bg-white border rounded-lg shadow-sm hover:bg-gray-50"
        >
          <span className="font-medium truncate mr-2 max-w-[200px]">
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
                      className="w-5 h-5 rounded-sm ring-1 ring-white"
                      style={{ backgroundColor: rgbToHex(color) }}
                    />
                  ))}
                {selectedPalette.colors.length > maxVisibleColors && (
                  <div className="w-5 h-5 rounded-sm ring-1 ring-white flex items-center justify-center bg-gray-100 text-xs font-medium text-gray-600">
                    <span className="scale-90">
                      +{selectedPalette.colors.length - maxVisibleColors}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 transition-transform flex-shrink-0 ${isDropdownOpen ? "rotate-180" : ""
                }`}
            />
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg flex flex-col">
            <div className="p-2 border-b">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search palettes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 max-h-[175px]">
              {filteredPalettes.map((palette) => (
                <div
                  key={palette.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedPalette(palette);
                    setIsDropdownOpen(false);
                  }}
                >
                  <span className="truncate max-w-[200px]">{palette.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {palette.colors
                        .slice(0, 3)
                        .map((color: Color, i: number) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-sm ring-1 ring-white"
                            style={{ backgroundColor: rgbToHex(color) }}
                          />
                        ))}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPalette(palette);
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-center p-3 border-t hover:bg-gray-50 cursor-pointer"
              onClick={handleCreatePalette}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Create New Palette</span>
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
