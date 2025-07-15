import { useState, useRef, useMemo, useCallback, type ChangeEvent } from "react";
import PalettePreview from "./palette-preview";
import PaletteDropdown from "./palette-dropdown";
import MobileActionSheet from "./mobile-action-sheet";
import PaletteEditor from "@/components/palette/palette-editor";
import { usePaletteStore } from "@/stores";
import { generateUniqueId } from "@/lib/utils";
import { type Palette } from "palettum";

const PaletteManager: React.FC = () => {
  const {
    palettes,
    selectedPalette,
    paletteSelectionOrder,
    setSelectedPalette,
    addPalette,
    updatePalette,
    deletePalette,
  } = usePaletteStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mobilePalette, setMobilePalette] = useState<Palette | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<Palette | null>(null);

  const anchorRef = useRef<HTMLDivElement>(null!);
  const importInput = useRef<HTMLInputElement>(null);

  const sortedPalettes = useMemo(() => {
    return [...palettes].sort((a, b) => {
      const indexA = paletteSelectionOrder.indexOf(a.id);
      const indexB = paletteSelectionOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      if (a.kind !== b.kind) return a.kind === "Default" ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [palettes, paletteSelectionOrder]);

  const filteredPalettes = useMemo(() => {
    const lower = search.toLowerCase();
    return sortedPalettes.filter((p) => p.id.toLowerCase().includes(lower));
  }, [sortedPalettes, search]);

  const currentIndex = useMemo(() => {
    return sortedPalettes.findIndex(p => p.id === selectedPalette.id);
  }, [sortedPalettes, selectedPalette.id]);

  const cyclePalette = useCallback((direction: 'prev' | 'next') => {
    if (sortedPalettes.length <= 1) return;
    
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % sortedPalettes.length
      : (currentIndex - 1 + sortedPalettes.length) % sortedPalettes.length;
    
    setSelectedPalette(sortedPalettes[newIndex]);
  }, [sortedPalettes, currentIndex, setSelectedPalette]);

  const handleSavePalette = useCallback(
    async (updatedPalette: Palette) => {
      if (editingPalette) {
        updatePalette(editingPalette.id, updatedPalette);
      } else {
        addPalette(updatedPalette);
      }
      setSelectedPalette(updatedPalette);
      setIsEditModalOpen(false);
      setEditingPalette(null);
    },
    [editingPalette, updatePalette, addPalette, setSelectedPalette],
  );

  const handleCloseEditor = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingPalette(null);
  }, []);

  const handleCreatePalette = useCallback(() => {
    const baseId = "New Palette";
    const existingIds = new Set(palettes.map((p) => p.id));
    const newId = generateUniqueId(baseId, existingIds);
    const newPalette: Palette = {
      id: newId,
      colors: [],
      kind: "Custom",
    };
    setEditingPalette(newPalette);
    setIsEditModalOpen(true);
    setDropdownOpen(false);
  }, [palettes]);

  const handleEditPalette = useCallback((palette: Palette) => {
    if (palette.kind === "Default") return;
    setEditingPalette({ ...palette });
    setIsEditModalOpen(true);
    setDropdownOpen(false);
    setMobilePalette(null);
  }, []);

  const selectPalette = (p: Palette) => {
    setSelectedPalette(p);
    setDropdownOpen(false);
  };

  const duplicatePalette = (p: Palette) => {
    const baseId = p.id.replace(/\s*\(copy.*\)$/, "");
    const id = generateUniqueId(
      `${baseId} (copy)`,
      new Set(palettes.map((x) => x.id)),
    );

    const newPalette = { ...p, id, kind: "Custom" as const };
    addPalette(newPalette);
    setSelectedPalette(newPalette);
    setDropdownOpen(false);
    setMobilePalette(null);
  };

  const exportPalette = (p: Palette) => {
    const blob = new Blob(
      [JSON.stringify({ colors: p.colors, source: p.source }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.id.replace(/[<>:"/\\|?*]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDropdownOpen(false);
    setMobilePalette(null);
  };

  const onImport = () => importInput.current?.click();

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!Array.isArray(json.colors)) {
          throw new Error("Invalid palette format: colors array missing.");
        }
        const id = generateUniqueId(
          file.name.replace(/\.json$/, ""),
          new Set(palettes.map((p) => p.id)),
        );
        const newPalette = {
          id,
          colors: json.colors,
          source: json.source,
          kind: "Custom" as const,
        };
        addPalette(newPalette);
        setSelectedPalette(newPalette);
        setDropdownOpen(false);
      } catch (err) {
        console.error("Failed to import palette:", err);
        alert(
          `Failed to import palette: ${err instanceof Error ? err.message : "Unknown error"
          }. Please check the file format.`,
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDeletePalette = useCallback(
    (paletteId: string) => {
      deletePalette(paletteId);
      setMobilePalette(null);
    },
    [deletePalette],
  );

  const handleShowMobileMenu = useCallback(
    (id: string) => {
      setMobilePalette(palettes.find((p) => p.id === id) ?? null);
    },
    [palettes],
  );

  return (
    <div ref={anchorRef} className="relative">
      <PalettePreview
        palette={selectedPalette}
        isOpen={dropdownOpen}
        onToggle={() => setDropdownOpen((o) => !o)}
        onPrevious={() => cyclePalette('prev')}
        onNext={() => cyclePalette('next')}
        onEdit={() => handleEditPalette(selectedPalette)}
        onDuplicate={() => duplicatePalette(selectedPalette)}
        onExport={() => exportPalette(selectedPalette)}
        onDelete={() => handleDeletePalette(selectedPalette.id)}
        canCycle={sortedPalettes.length > 1}
      />

      <PaletteDropdown
        open={dropdownOpen}
        anchorRef={anchorRef}
        search={search}
        onSearch={setSearch}
        palettes={filteredPalettes}
        selectedId={selectedPalette.id}
        onSelect={selectPalette}
        onDuplicate={duplicatePalette}
        onExport={exportPalette}
        onEdit={handleEditPalette}
        onDelete={handleDeletePalette}
        onMobileMenu={handleShowMobileMenu}
        onNewPalette={handleCreatePalette}
        onImport={onImport}
        close={() => setDropdownOpen(false)}
      />

      <input
        ref={importInput}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFile}
      />

      <MobileActionSheet
        palette={mobilePalette}
        onClose={() => setMobilePalette(null)}
        onDuplicate={() => mobilePalette && duplicatePalette(mobilePalette)}
        onExport={() => mobilePalette && exportPalette(mobilePalette)}
        onEdit={() => mobilePalette && handleEditPalette(mobilePalette)}
        onDelete={() => mobilePalette && handleDeletePalette(mobilePalette.id)}
      />

      {isEditModalOpen && editingPalette && (
        <PaletteEditor
          palette={editingPalette}
          onClose={handleCloseEditor}
          onSave={handleSavePalette}
        />
      )}
    </div>
  );
};

export default PaletteManager;
