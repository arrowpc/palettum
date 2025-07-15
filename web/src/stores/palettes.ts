import { create } from "zustand";
import { mutative } from "zustand-mutative";
import { type Palette } from "palettum";
import { LIMITS } from "@/lib/utils";
import { useConfigStore } from "./config";

const paletteModules = import.meta.glob<{ default: Palette }>(
  "palettes/*.json",
  { eager: true },
);

const generateUniqueId = (baseId: string, existingIds: Set<string>): string => {
  let id = baseId;
  let counter = 1;
  const maxBaseIdLength =
    LIMITS.MAX_ID_LENGTH - (counter > 1 ? String(counter).length + 1 : 0);
  const truncatedBaseId = baseId.slice(0, maxBaseIdLength);
  id = truncatedBaseId;

  while (existingIds.has(id)) {
    id = `${truncatedBaseId}-${counter}`;
    counter++;
    if (id.length > LIMITS.MAX_ID_LENGTH) {
      console.warn(`Generated ID ${id} exceeds max length.`);
      id = id.slice(0, LIMITS.MAX_ID_LENGTH);
    }
  }
  return id;
};

export const loadDefaultPalettes = (): Palette[] => {
  const loadedPalettes: Palette[] = [];
  const existingIds = new Set<string>();

  for (const path in paletteModules) {
    const module = paletteModules[path];
    const paletteData = module.default;

    const filename = path.split("/").pop()?.replace(".json", "");

    if (!filename) {
      console.warn(`Could not extract filename from path: ${path}`);
      continue;
    }

    if (!paletteData) {
      console.warn(`No default export found or data is invalid in: ${path}`);
      continue;
    }

    const baseId = filename.slice(0, LIMITS.MAX_ID_LENGTH - 10);
    const id = generateUniqueId(baseId, existingIds);
    existingIds.add(id);

    const palette: Palette = {
      id,
      colors: paletteData.colors,
      source: paletteData.source,
      kind: "Default",
    };

    loadedPalettes.push(palette);
  }

  return loadedPalettes;
};

const LOCAL_STORAGE_KEY = "userPalettes";
const SELECTED_PALETTE_KEY = "selectedPaletteId";
const PALETTE_SELECTION_ORDER_KEY = "paletteSelectionOrder";

function savePalettes(palettes: Palette[]) {
  const userPalettes = palettes.filter((p) => p.kind === "Custom");
  const paletteMap: Record<string, Omit<Palette, "id" | "kind">> = {};
  userPalettes.forEach(({ id, ...rest }) => {
    paletteMap[id] = rest;
  });
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(paletteMap));
  } catch (error) {
    console.error("Failed to save palettes to localStorage:", error);
  }
}

function savePaletteSelectionOrder(order: string[]) {
  try {
    localStorage.setItem(PALETTE_SELECTION_ORDER_KEY, JSON.stringify(order));
  } catch (error) {
    console.error("Failed to save palette selection order:", error);
  }
}

function loadPaletteSelectionOrder(): string[] {
  try {
    const saved = localStorage.getItem(PALETTE_SELECTION_ORDER_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Failed to load palette selection order:", error);
    return [];
  }
}

function saveSelectedPaletteId(id: string) {
  try {
    localStorage.setItem(SELECTED_PALETTE_KEY, id);
  } catch (error) {
    console.error("Failed to save selected palette ID:", error);
  }
}

function loadSelectedPaletteId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PALETTE_KEY);
  } catch (error) {
    console.error("Failed to load selected palette ID:", error);
    return null;
  }
}

const loadSavedPalettes = (): Palette[] => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return [];
    const paletteMap: Record<string, Omit<Palette, "id" | "kind">> = JSON.parse(
      saved,
    );
    return Object.entries(paletteMap).map(([id, data]) => ({
      id,
      kind: "Custom",
      ...data,
    }));
  } catch (error) {
    console.error("Failed to load saved palettes:", error);
    return [];
  }
};

const initialDefaultPalettes = loadDefaultPalettes();
const initialSavedPalettes = loadSavedPalettes();
const allInitialPalettes = [...initialDefaultPalettes, ...initialSavedPalettes];
const initialPaletteSelectionOrder = loadPaletteSelectionOrder();

let initialSelectedPalette: Palette | undefined;

if (allInitialPalettes.length > 0) {
  if (initialPaletteSelectionOrder.length > 0) {
    for (const id of initialPaletteSelectionOrder) {
      initialSelectedPalette = allInitialPalettes.find((p) => p.id === id);
      if (initialSelectedPalette) break;
    }
  }

  if (!initialSelectedPalette) {
    const savedId = loadSelectedPaletteId(); // Legacy support
    if (savedId) {
      initialSelectedPalette = allInitialPalettes.find((p) => p.id === savedId);
    }
  }

  if (!initialSelectedPalette) {
    initialSelectedPalette = allInitialPalettes[0];
  }
} else {
  console.error(
    "CRITICAL: No palettes loaded (default or saved). Using a placeholder.",
  );
  initialSelectedPalette = {
    id: "placeholder-palette",
    colors: [],
    kind: "Default",
    source: undefined,
  } as Palette;
}

interface PaletteState {
  palettes: Palette[];
  selectedPalette: Palette;
  paletteSelectionOrder: string[];
  setPalettes: (palettes: Palette[]) => void;
  setSelectedPalette: (palette: Palette) => void;
  cycleSelectedPalette: (palette: Palette) => void;
  addPalette: (palette: Palette) => void;
  updatePalette: (originalId: string, updatedPalette: Palette) => void;
  deletePalette: (paletteId: string) => void;
}

export const usePaletteStore = create<PaletteState>()(
  mutative((set, get) => ({
    palettes: allInitialPalettes,
    selectedPalette: initialSelectedPalette!,
    paletteSelectionOrder: initialPaletteSelectionOrder,
    setPalettes: (palettes) => {
      set((state) => {
        state.palettes = palettes;
      });
      savePalettes(palettes);
    },
    setSelectedPalette: (palette) => {
      set((state) => {
        state.selectedPalette = palette;
      });
      saveSelectedPaletteId(palette.id);
      useConfigStore.getState().setSelectedPalette({ ...palette });

      const currentOrder = get().paletteSelectionOrder;
      if (currentOrder[0] !== palette.id) {
        const newOrder = [
          palette.id,
          ...currentOrder.filter((id) => id !== palette.id),
        ];
        set((state) => {
          state.paletteSelectionOrder = newOrder;
        });
        savePaletteSelectionOrder(newOrder);
      }
    },
    cycleSelectedPalette: (palette) => {
      set((state) => {
        state.selectedPalette = palette;
      });
      saveSelectedPaletteId(palette.id);
      useConfigStore.getState().setSelectedPalette({ ...palette });
    },
    addPalette: (palette) => {
      set((state) => {
        state.palettes.push(palette);
      });
      savePalettes(get().palettes);
    },
    updatePalette: (originalId, updatedPalette) => {
      set((state) => {
        const originalIndex = state.palettes.findIndex(
          (p) => p.id === originalId,
        );

        if (originalIndex !== -1) {
          // If the ID has changed, we remove the old entry.
          if (originalId !== updatedPalette.id) {
            state.palettes.splice(originalIndex, 1);
          }
        }

        const existingIndexForNewId = state.palettes.findIndex(
          (p) => p.id === updatedPalette.id,
        );
        if (existingIndexForNewId !== -1) {
          state.palettes[existingIndexForNewId] = updatedPalette;
        } else {
          // If it's a new ID (from a rename), it might not exist, so push.
          // Or if it was a new palette to begin with.
          // The original logic in handleSavePalette is a bit ambiguous.
          // This logic handles both creating and updating.
          state.palettes.push(updatedPalette);
        }

        savePalettes(state.palettes);

        // If the updated palette is the selected one, update the config
        if (state.selectedPalette.id === originalId) {
          useConfigStore.getState().setSelectedPalette({ ...updatedPalette });
          state.selectedPalette = updatedPalette;
        }
      });
    },
    deletePalette: (paletteId) => {
      set((state) => {
        state.palettes = state.palettes.filter((p) => p.id !== paletteId);
        state.paletteSelectionOrder = state.paletteSelectionOrder.filter(
          (id) => id !== paletteId,
        );
        savePalettes(state.palettes);
        savePaletteSelectionOrder(state.paletteSelectionOrder);

        if (state.selectedPalette.id === paletteId) {
          const currentOrder = state.paletteSelectionOrder;
          let nextSelected: Palette | undefined;

          if (currentOrder.length > 0) {
            const deletedIndex = currentOrder.indexOf(paletteId);
            if (deletedIndex !== -1) {
              // Find the next available palette in the order
              for (let i = 1; i < currentOrder.length; i++) {
                const nextIndex = (deletedIndex + i) % currentOrder.length;
                const nextPaletteId = currentOrder[nextIndex];
                nextSelected = state.palettes.find(
                  (p) => p.id === nextPaletteId,
                );
                if (nextSelected) break;
              }
            }
          }

          // Fallback if no palette from the order is available
          if (!nextSelected) {
            nextSelected =
              state.palettes.find((p) => p.kind === "Default") ||
              state.palettes[0];
          }

          if (nextSelected) {
            state.selectedPalette = nextSelected;
            saveSelectedPaletteId(nextSelected.id);
            useConfigStore.getState().setSelectedPalette({ ...nextSelected });
          } else {
            // This case should ideally not be reached if there are default palettes
            const defaultPalettes = loadDefaultPalettes();
            if (defaultPalettes.length > 0) {
              const newSelected = defaultPalettes[0];
              state.selectedPalette = newSelected;
              saveSelectedPaletteId(newSelected.id);
              useConfigStore.getState().setSelectedPalette({ ...newSelected });
            } else {
              // Critical state: no palettes left
              console.error("No palettes available to select.");
            }
          }
        }
      });
    },
  })),
);

// Initialize config store with the initial selected palette
useConfigStore.getState().setSelectedPalette(initialSelectedPalette!);
