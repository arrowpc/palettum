import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Edit2,
  Plus,
  Search,
  Copy,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  MoreVertical,
  X,
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
const MOBILE_MENU_TRANSITION_DURATION = 200; // ms

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [mobileActionPaletteId, setMobileActionPaletteId] = useState<
    string | null
  >(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Disable background scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showMobileMenu]);

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
            [hoveredPaletteId]:
              ((prev[hoveredPaletteId] ?? 0) + 1) % palette.colors.length,
          }));
        }, HOVER_CYCLE_INTERVAL);
        return () => clearInterval(interval);
      }
    }
  }, [hoveredPaletteId, palettes]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (mobileActionPaletteId) {
      setShowMobileMenu(true);
      setTimeout(() => setIsMenuVisible(true), 10);
    } else {
      setIsMenuVisible(false);
      setTimeout(
        () => setShowMobileMenu(false),
        MOBILE_MENU_TRANSITION_DURATION,
      );
    }
  }, [mobileActionPaletteId]);

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
  };

  const handleEditPalette = (palette: Palette) => {
    if (palette.isDefault) return;
    setEditingPalette({ ...palette });
    setIsEditModalOpen(true);
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
  };

  const handleExportPalette = (palette: Palette) => {
    const json = JSON.stringify(palette, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${palette.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPalette = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const json = e.target?.result as string;
          if (!json) throw new Error("Failed to read file");

          const imported = JSON.parse(json);

          if (!imported.name || !Array.isArray(imported.colors)) {
            throw new Error("Invalid palette format");
          }

          const importedPalette: Palette = {
            ...imported,
            id: crypto.randomUUID(),
            isDefault: false,
          };

          const existingNames = palettes.map((p) => p.name);
          if (existingNames.includes(importedPalette.name)) {
            let counter = 1;
            let newName = `${importedPalette.name} (${counter})`;
            while (existingNames.includes(newName)) {
              counter++;
              newName = `${importedPalette.name} (${counter})`;
            }
            importedPalette.name = newName;
          }

          setPalettes((current) => [...current, importedPalette]);
          setSelectedPalette(importedPalette);
          setIsDropdownOpen(false);
        } catch (error) {
          console.error("Failed to import palette:", error);
          alert("Failed to import palette. Please check the file format.");
        }
      };
      reader.readAsText(file);
    }

    if (event.target) {
      event.target.value = "";
    }
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

  const closeMobileMenu = () => {
    setIsMenuVisible(false);
    setTimeout(() => {
      setShowMobileMenu(false);
      setMobileActionPaletteId(null);
    }, MOBILE_MENU_TRANSITION_DURATION);
  };

  return (
    <TooltipProvider>
      <div ref={dropdownRef} className="relative">
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
                    className={cn(
                      "grid grid-cols-[1fr,80px,auto] items-center p-3 hover:bg-secondary cursor-pointer",
                      palette.id === selectedPalette.id && "bg-secondary/50",
                    )}
                    onClick={() => {
                      setSelectedPalette(palette);
                      setIsDropdownOpen(false);
                    }}
                    onMouseEnter={() => setHoveredPaletteId(palette.id)}
                    onMouseLeave={() => setHoveredPaletteId(null)}
                  >
                    <div className="flex items-center min-w-0">
                      <div className="flex flex-col">
                        <span className="truncate text-sm text-foreground max-w-[150px] sm:max-w-[180px]">
                          {palette.name}
                        </span>
                        {palette.isDefault && (
                          <span className="text-tiny font-normal text-foreground-muted">
                            (default)
                          </span>
                        )}
                      </div>
                      {palette.source && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={palette.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-1.5 text-icon-inactive hover:text-icon-active flex-shrink-0"
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

                    {/* Color preview */}
                    <div className="flex justify-center items-center w-[80px]">
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
                    </div>

                    <div className="hidden sm:flex items-center justify-end gap-1">
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
                              handleExportPalette(palette);
                            }}
                            className="p-1.5 text-icon-inactive hover:text-icon-active"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Export</p>
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
                                ? "text-icon-disabled opacity-50 cursor-not-allowed"
                                : "text-icon-inactive hover:text-icon-active",
                            )}
                            disabled={palette.isDefault}
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
                                ? "text-icon-disabled opacity-50 cursor-not-allowed"
                                : "text-icon-inactive hover:text-destructive",
                            )}
                            disabled={palette.isDefault}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex sm:hidden items-center justify-end">
                      <button
                        className="p-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileActionPaletteId(palette.id);
                        }}
                        aria-label="Show actions"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-2 flex justify-between">
              <button
                className="flex items-center justify-center px-3 py-1.5 text-sm hover:bg-secondary rounded"
                onClick={handleCreatePalette}
                type="button"
              >
                <Plus className="w-4 h-4 mr-1.5 text-icon-inactive" />
                <span>New Palette</span>
              </button>

              <button
                className="flex items-center justify-center px-3 py-1.5 text-sm hover:bg-secondary rounded"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload className="w-4 h-4 mr-1.5 text-icon-inactive" />
                <span>Import</span>
              </button>
            </div>
          </div>
        )}

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className="hidden"
          onChange={handleImportPalette}
        />

        {showMobileMenu && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40">
            <div className="absolute inset-0" onClick={closeMobileMenu} />
            <div
              className={cn(
                "relative w-full bg-background rounded-t-2xl p-4 shadow-lg transition-transform ease-in-out",
                isMenuVisible ? "translate-y-0" : "translate-y-full",
              )}
              style={{
                willChange: "transform",
                transitionDuration: `${MOBILE_MENU_TRANSITION_DURATION}ms`,
              }}
            >
              {" "}
              {mobileActionPaletteId && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium truncate">
                      {
                        palettes.find((p) => p.id === mobileActionPaletteId)
                          ?.name
                      }
                    </span>
                    <button
                      onClick={closeMobileMenu}
                      className="p-2"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-col text-sm gap-2">
                    <button
                      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary"
                      onClick={() => {
                        const palette = palettes.find(
                          (p) => p.id === mobileActionPaletteId,
                        );
                        if (palette) handleCopyPalette(palette);
                        closeMobileMenu();
                      }}
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <button
                      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-secondary"
                      onClick={() => {
                        const palette = palettes.find(
                          (p) => p.id === mobileActionPaletteId,
                        );
                        if (palette) handleExportPalette(palette);
                        closeMobileMenu();
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded",
                        palettes.find((p) => p.id === mobileActionPaletteId)
                          ?.isDefault
                          ? "text-icon-disabled opacity-50 cursor-not-allowed"
                          : "hover:bg-secondary",
                      )}
                      onClick={() => {
                        const palette = palettes.find(
                          (p) => p.id === mobileActionPaletteId,
                        );
                        if (palette && !palette.isDefault)
                          handleEditPalette(palette);
                        closeMobileMenu();
                      }}
                      disabled={
                        palettes.find((p) => p.id === mobileActionPaletteId)
                          ?.isDefault
                      }
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded",
                        palettes.find((p) => p.id === mobileActionPaletteId)
                          ?.isDefault
                          ? "text-icon-disabled opacity-50 cursor-not-allowed"
                          : "hover:bg-secondary text-destructive",
                      )}
                      onClick={() => {
                        const palette = palettes.find(
                          (p) => p.id === mobileActionPaletteId,
                        );
                        if (palette && !palette.isDefault)
                          handleDeletePalette(palette.id);
                        closeMobileMenu();
                      }}
                      disabled={
                        palettes.find((p) => p.id === mobileActionPaletteId)
                          ?.isDefault
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </>
              )}
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
