import { create } from "zustand";
import { mutative } from "zustand-mutative";
import { type Palette } from "palettum";
import { toast } from "sonner";
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
      let deletedPaletteCopy: Palette | undefined;

      set((state) => {
        const originalIndex = state.palettes.findIndex(
          (p) => p.id === paletteId,
        );

        if (originalIndex === -1) {
          return; // Palette not found, nothing to delete
        }

        const dp = state.palettes[originalIndex];
        // Create a deep clone to get a plain object, not a proxy
        // Otherwise we get a revoked proxy error on undo
        deletedPaletteCopy = JSON.parse(JSON.stringify(dp));

        state.palettes.splice(originalIndex, 1);
        state.paletteSelectionOrder = state.paletteSelectionOrder.filter(
          (id) => id !== paletteId,
        );
        savePalettes(state.palettes);
        savePaletteSelectionOrder(state.paletteSelectionOrder);

        if (state.selectedPalette.id === paletteId) {
          const currentOrder = state.paletteSelectionOrder;
          let nextSelected: Palette | undefined;

          if (currentOrder.length > 0) {
            for (let i = 0; i < currentOrder.length; i++) {
              const nextPaletteId = currentOrder[i];
              nextSelected = state.palettes.find((p) => p.id === nextPaletteId);
              if (nextSelected) break;
            }
          }

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
            if (state.palettes.length === 0) {
              console.error("No palettes available after deletion.");
              toast.error("No palettes available to select.");
              state.selectedPalette = {
                id: "placeholder-palette",
                colors: [],
                kind: "Default",
                source: undefined,
              } as Palette;
              saveSelectedPaletteId(state.selectedPalette.id);
              useConfigStore
                .getState()
                .setSelectedPalette({ ...state.selectedPalette });
            }
          }
        }
      });

      if (deletedPaletteCopy) {
        toast.success(`Palette '${deletedPaletteCopy.id}' deleted.`, {
          action: {
            label: "Undo",
            onClick: () => {
              set((state) => {
                state.palettes.push(deletedPaletteCopy!);
                state.paletteSelectionOrder.unshift(deletedPaletteCopy!.id);

                state.selectedPalette = deletedPaletteCopy!;
                saveSelectedPaletteId(deletedPaletteCopy!.id);
                useConfigStore
                  .getState()
                  .setSelectedPalette({ ...deletedPaletteCopy! });

                savePalettes(state.palettes);
                savePaletteSelectionOrder(state.paletteSelectionOrder);
                toast.info(`Palette '${deletedPaletteCopy!.id}' restored.`);
              });
            },
          },
          duration: 5000,
        });
      }
    },
  })),
);

useConfigStore.getState().setSelectedPalette(initialSelectedPalette!);
