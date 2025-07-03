import { useState, useRef, useMemo, useCallback, type ChangeEvent } from "react";
import PalettePreview from "./palette-preview";
import PaletteDropdown from "./palette-dropdown";
import MobileActionSheet from "./mobile-action-sheet";
import PaletteEditor from "@/components/palette/palette-editor";
import { useConfigStore } from "@/store";
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
  } = useConfigStore();

  /* ---------- UI state ---------- */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // REMOVED: hoveredStartIndices and setHoveredStart as it's now internal to PaletteListItem
  const [mobilePalette, setMobilePalette] = useState<Palette | null>(null);

  // State for PaletteEditor modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<Palette | null>(null);

  /* ---------- refs ---------- */
  const anchorRef = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  /* ---------- memo ---------- */
  const list = useMemo(() => {
    const lower = search.toLowerCase();
    const filtered = palettes.filter((p) => p.id.toLowerCase().includes(lower));

    return filtered.sort((a, b) => {
      const indexA = paletteSelectionOrder.indexOf(a.id);
      const indexB = paletteSelectionOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      if (a.kind !== b.kind) return a.kind === "Default" ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [palettes, search, paletteSelectionOrder]);

  /* ---------- Handlers for PaletteEditor ---------- */
  const handleSavePalette = useCallback(
    // FIX 3: Make it async to match PaletteEditor's onSave prop type
    async (updatedPalette: Palette) => {
      // If editing an existing palette (editingPalette was set when modal opened)
      if (editingPalette) {
        updatePalette(editingPalette.id, updatedPalette);
      } else {
        // It's a brand new palette
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
    setDropdownOpen(false); // Close dropdown if opened via 'New Palette' button
  }, [palettes]);

  const handleEditPalette = useCallback((palette: Palette) => {
    if (palette.kind === "Default") return; // Should be handled by disabled prop in UI
    setEditingPalette({ ...palette }); // Pass a copy to avoid direct mutation
    setIsEditModalOpen(true);
    setDropdownOpen(false); // Close dropdown if opened via 'Edit' button
    setMobilePalette(null); // Close mobile menu if opened via 'Edit' button
  }, []);

  /* ---------- General Handlers ---------- */
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

    addPalette({ ...p, id, kind: "Custom" });
    setSelectedPalette({ ...p, id });
    setDropdownOpen(false); // Close dropdown after duplication
    setMobilePalette(null); // Close mobile menu after duplication
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
    setDropdownOpen(false); // Close dropdown after export
    setMobilePalette(null); // Close mobile menu after export
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
        addPalette({
          id,
          colors: json.colors,
          source: json.source,
          kind: "Custom",
        });
        setDropdownOpen(false); // Close dropdown after import
      } catch (err) {
        console.error("Failed to import palette:", err);
        alert(
          `Failed to import palette: ${err instanceof Error ? err.message : "Unknown error"
          }. Please check the file format.`,
        );
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Clear file input
  };

  const handleDeletePalette = useCallback(
    (paletteId: string) => {
      deletePalette(paletteId);
      setMobilePalette(null); // Close mobile menu after deletion
    },
    [deletePalette],
  );

  const handleShowMobileMenu = useCallback(
    (id: string) => {
      setMobilePalette(palettes.find((p) => p.id === id) ?? null);
    },
    [palettes],
  );

  /* ---------- render ---------- */
  return (
    <div ref={anchorRef} className="relative">
      <PalettePreview
        palette={selectedPalette}
        isOpen={dropdownOpen}
        onToggle={() => setDropdownOpen((o) => !o)}
      />

      <PaletteDropdown
        open={dropdownOpen}
        anchorRef={anchorRef as React.RefObject<HTMLDivElement>}
        search={search}
        onSearch={setSearch}
        palettes={list}
        hoveredId={hoveredId}
        selectedId={selectedPalette.id}
        onSelect={selectPalette}
        onDuplicate={duplicatePalette}
        onExport={exportPalette}
        onEdit={handleEditPalette}
        onDelete={handleDeletePalette}
        onMobileMenu={handleShowMobileMenu}
        onHoverOn={(id) => setHoveredId(id)}
        onHoverOff={() => setHoveredId(null)}
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
          onSave={handleSavePalette} // This now returns Promise<void>
        />
      )}
    </div>
  );
};

export default PaletteManager;
