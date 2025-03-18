import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Edit2,
  Plus,
  Search,
  Copy,
  Trash2,
  ExternalLink,
} from "lucide-react";
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

const LOCAL_STORAGE_KEY = "userPalettes";
const SELECTED_PALETTE_KEY = "selectedPaletteId";
const PREVIEW_CYCLE_INTERVAL = 500; // ms
const HOVER_CYCLE_INTERVAL = 300; // ms

interface PaletteManagerProps {
  onPaletteSelect: (palette: Palette) => void;
}

function PaletteManager({ onPaletteSelect }: PaletteManagerProps) {
  const initialPalettes = defaultPalettes.map((palette) => ({
    ...palette,
    isDefault: true,
  }));

  const loadSavedPalettes = (): Palette[] => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to load palettes:", error);
      return [];
    }
  };

  const loadSelectedPalette = () => {
    try {
      const savedId = localStorage.getItem(SELECTED_PALETTE_KEY);
      const allPalettes = [...initialPalettes, ...loadSavedPalettes()];
      const savedPalette = savedId
        ? allPalettes.find((p) => p.id === savedId)
        : allPalettes[0];
      return savedPalette || allPalettes[0];
    } catch (error) {
      console.error("Failed to load selected palette:", error);
      return initialPalettes[0];
    }
  };

  const [palettes, setPalettes] = useState<Palette[]>(() => [
    ...initialPalettes,
    ...loadSavedPalettes(),
  ]);
  const [selectedPalette, setSelectedPalette] = useState<Palette>(
    loadSelectedPalette(),
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<Palette | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [maxVisibleColors, setMaxVisibleColors] = useState(5);
  const [previewColorIndex, setPreviewColorIndex] = useState(0);
  const [hoveredPaletteId, setHoveredPaletteId] = useState<string | null>(null);
  const [hoveredColorIndices, setHoveredColorIndices] = useState<{
    [key: string]: number;
  }>({});
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userPalettes = palettes.filter((p) => !p.isDefault);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPalettes));
    } catch (error) {
      console.error("Failed to save palettes:", error);
    }
  }, [palettes]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_PALETTE_KEY, selectedPalette.id);
      onPaletteSelect(selectedPalette);
    } catch (error) {
      console.error("Failed to save selected palette:", error);
    }
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

  useEffect(() => {
    if (selectedPalette.colors.length > maxVisibleColors) {
      const interval = setInterval(() => {
        setPreviewColorIndex(
          (prev) => (prev + 1) % selectedPalette.colors.length,
        );
      }, PREVIEW_CYCLE_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [selectedPalette, maxVisibleColors]);

  useEffect(() => {
    if (hoveredPaletteId) {
      const palette = palettes.find((p) => p.id === hoveredPaletteId);
      if (palette && palette.colors.length > 3) {
        const interval = setInterval(() => {
          setHoveredColorIndices((prev) => ({
            ...prev,
            [hoveredPaletteId]: (prev[hoveredPaletteId] ?? 0) + 1,
          }));
        }, HOVER_CYCLE_INTERVAL);
        return () => clearInterval(interval);
      }
    }
  }, [hoveredPaletteId, palettes]);

  const getDisplayedColors = (
    palette: Palette,
    maxColors: number,
    startIndex: number,
  ) => {
    if (palette.colors.length <= maxColors) {
      return palette.colors;
    }
    const displayed = [];
    for (let i = 0; i < maxColors; i++) {
      const index = (startIndex + i) % palette.colors.length;
      displayed.push(palette.colors[index]);
    }
    return displayed;
  };

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

  const handleDeletePalette = (paletteId: string) => {
    setPalettes((current) => {
      const newPalettes = current.filter((p) => p.id !== paletteId);
      if (selectedPalette.id === paletteId) {
        const newSelected = newPalettes[0];
        setSelectedPalette(newSelected);
      }
      return newPalettes;
    });
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
    const copyNumber = copies.length ? Math.max(...copies) + 1 : 0;
    const newName =
      copyNumber === 0
        ? `${truncatedBaseName} (copy)`
        : `${truncatedBaseName} (copy-${copyNumber})`;

    const newPalette: Palette = {
      id: crypto.randomUUID(),
      name: newName.slice(0, LIMITS.MAX_NAME_LENGTH),
      colors: [...palette.colors],
      isDefault: false,
    };
    setPalettes((current) => [...current, newPalette]);
    setSelectedPalette(newPalette);
    setIsDropdownOpen(false);
  };

  const handleSavePalette = async (updatedPalette: Palette) => {
    setPalettes((current) => {
      const index = current.findIndex((p) => p.id === updatedPalette.id);
      if (index === -1) {
        return [...current, updatedPalette];
      }
      const newPalettes = [...current];
      newPalettes[index] = updatedPalette;
      return newPalettes;
    });
    if (selectedPalette.id === updatedPalette.id) {
      setSelectedPalette(updatedPalette);
    }
    setIsEditModalOpen(false);
    setEditingPalette(null);
  };

  const handleCloseEditor = () => {
    setIsEditModalOpen(false);
    setEditingPalette(null);
  };

  const filteredPalettes = palettes.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <TooltipProvider>
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center p-3 bg-background border border-border rounded-md shadow-sm hover:bg-secondary transition-colors"
        >
          <span className="text-sm truncate mr-2 text-foreground">
            {selectedPalette.name}
          </span>
          <div className="flex items-center justify-end gap-2 flex-1">
            <div
              ref={previewContainerRef}
              className="flex items-center justify-end min-w-0 flex-1"
            >
              <div className="flex -space-x-1">
                {getDisplayedColors(
                  selectedPalette,
                  maxVisibleColors,
                  previewColorIndex,
                ).map((color: Color, i: number) => (
                  <div
                    key={i}
                    className="w-color-square h-color-square rounded-sm ring-1 ring-border bg-background transition-all duration-300 ease-in-out"
                    style={{ backgroundColor: rgbToHex(color) }}
                  />
                ))}
                {selectedPalette.colors.length > maxVisibleColors && (
                  <div className="w-color-square h-color-square rounded-sm ring-1 ring-border flex items-center justify-center bg-secondary">
                    <span className="scale-90 text-tiny font-medium text-foreground-secondary">
                      +{selectedPalette.colors.length - maxVisibleColors}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform flex-shrink-0 text-icon-inactive",
                isDropdownOpen && "rotate-180",
              )}
            />
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-2 bg-background border border-border rounded-md shadow-md flex flex-col">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search palettes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring bg-background placeholder-foreground-muted"
                />
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 transform -translate-y-1/2 text-icon-inactive" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 max-h-[175px]">
              {filteredPalettes.map((palette) => {
                const startIndex = hoveredColorIndices[palette.id] ?? 0;
                return (
                  <div
                    key={palette.id}
                    className="flex items-center justify-between p-3 hover:bg-secondary cursor-pointer"
                    onClick={() => {
                      setSelectedPalette(palette);
                      setIsDropdownOpen(false);
                    }}
                    onMouseEnter={() => setHoveredPaletteId(palette.id)}
                    onMouseLeave={() => setHoveredPaletteId(null)}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate text-sm text-foreground">
                        {palette.name}
                      </span>
                      {palette.isDefault && (
                        <span className="ml-1.5 text-tiny font-normal text-foreground-muted flex-shrink-0">
                          (default)
                        </span>
                      )}
                      {palette.source && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={palette.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-1.5 text-icon-inactive hover:text-icon-active flex-shrink-0"
                              title="View palette source"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">View source</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {getDisplayedColors(palette, 3, startIndex).map(
                          (color: Color, i: number) => (
                            <div
                              key={i}
                              className="w-color-square h-color-square rounded-sm ring-1 ring-border bg-background transition-all duration-300 ease-in-out"
                              style={{ backgroundColor: rgbToHex(color) }}
                            />
                          ),
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPalette(palette);
                            }}
                            className="p-1.5 text-icon-inactive hover:text-icon-active"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Duplicate</p>
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
                              "p-1.5",
                              palette.isDefault
                                ? "text-icon-disabled opacity-50 cursor-not-allowed line-through"
                                : "text-icon-inactive hover:text-icon-active",
                            )}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Edit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!palette.isDefault)
                                handleDeletePalette(palette.id);
                            }}
                            className={cn(
                              "p-1.5",
                              palette.isDefault
                                ? "text-icon-disabled opacity-50 cursor-not-allowed line-through"
                                : "text-icon-inactive hover:text-icon-active",
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className="flex items-center justify-center p-2.5 border-t border-border hover:bg-secondary cursor-pointer"
              onClick={handleCreatePalette}
            >
              <Plus className="w-4.5 h-4.5 mr-1.5 text-icon-inactive" />
              <span className="text-sm text-foreground">
                Create New Palette
              </span>
            </div>
          </div>
        )}

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
