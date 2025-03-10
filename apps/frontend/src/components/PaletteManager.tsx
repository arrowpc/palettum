import { useState, useRef, useEffect } from "react";
import { ChevronDown, Edit2, Plus, Search, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import PaletteEditor from "@/components/PaletteEditor";
import {
  type Color,
  type Palette,
  defaultPalettes,
  rgbToHex,
  LIMITS,
} from "@/lib/palettes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaletteManagerProps {
  onPaletteSelect: (palette: Palette) => void;
}

function PaletteManager({ onPaletteSelect }: PaletteManagerProps) {
  const initialPalettes = defaultPalettes.map((palette) => ({
    ...palette,
    isDefault: true,
  }));

  const [selectedPalette, setSelectedPalette] = useState<Palette>(
    initialPalettes[0],
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<Palette | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [palettes, setPalettes] = useState<Palette[]>([...initialPalettes]);
  const [maxVisibleColors, setMaxVisibleColors] = useState(5);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPaletteSelect(selectedPalette);
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
      isDefault: false,
    };
    setEditingPalette(newPalette);
    setIsEditModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleEditPalette = (palette: Palette) => {
    if (palette.isDefault) return;

    setEditingPalette({ ...palette });
    setIsEditModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleCopyPalette = (palette: Palette) => {
    const baseName = palette.name.replace(/\s*\(copy(-\d+)?\)$/, "");

    const truncatedBaseName = baseName.slice(0, LIMITS.MAX_NAME_LENGTH - 12);

    const copyPattern = new RegExp(
      `^${truncatedBaseName}\\s*\\(copy(?:-(\\d+))?\\)$`,
    );

    const copies = palettes
      .filter((p) => copyPattern.test(p.name))
      .map((p) => {
        const match = p.name.match(copyPattern);
        return match && match[1] ? parseInt(match[1], 10) : 1;
      })
      .filter(Boolean) as number[];

    let copyNumber = 0;
    if (copies.length === 0) {
      copyNumber = 0;
    } else {
      copyNumber = Math.max(...copies) + 1;
    }

    let newName =
      copyNumber === 0
        ? `${truncatedBaseName} (copy)`
        : `${truncatedBaseName} (copy-${copyNumber})`;

    if (newName.length > LIMITS.MAX_NAME_LENGTH) {
      newName = newName.slice(0, LIMITS.MAX_NAME_LENGTH);
    }

    const newPalette: Palette = {
      id: crypto.randomUUID(),
      name: newName,
      colors: [...palette.colors],
      isDefault: false,
    };

    setPalettes((currentPalettes) => [...currentPalettes, newPalette]);
    setSelectedPalette(newPalette);
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
    <TooltipProvider>
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
                      {palette.isDefault && (
                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                          (default)
                        </span>
                      )}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPalette(palette);
                            }}
                            className="p-2 text-dropdown-icon hover:text-dropdown-icon-hover"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Duplicate</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!palette.isDefault)
                                handleEditPalette(palette);
                            }}
                            className={cn(
                              "p-2 text-dropdown-icon",
                              palette.isDefault
                                ? "opacity-50 cursor-not-allowed line-through"
                                : "hover:text-dropdown-icon-hover",
                            )}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit</p>
                        </TooltipContent>
                      </Tooltip>
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
    </TooltipProvider>
  );
}

export default PaletteManager;
