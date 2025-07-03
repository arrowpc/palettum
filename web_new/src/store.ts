import { create } from "zustand";
import { type Config, type Palette } from "palettum";
import { LIMITS } from "@/lib/utils";

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
  addPalette: (palette: Palette) => void;
  updatePalette: (originalId: string, updatedPalette: Palette) => void;
  deletePalette: (paletteId: string) => void;
}

interface ConfigState {
  config: Config;
  setConfig: <K extends keyof Config>(key: K, value: Config[K]) => void;
}

export const useConfigStore = create<ConfigState & PaletteState>(
  (set, get) => ({
    config: {
      palette: initialSelectedPalette!,
      mapping: "Smoothed",
      diffFormula: "CIEDE2000",
      smoothFormula: "Idw",
      smoothStrength: 0.5,
      transparencyThreshold: 128,
      ditherAlgorithm: "Bn",
      ditherStrength: 0.5,
      quantLevel: 0,
      filter: "Nearest",
    },
    setConfig: (key, value) =>
      set((state) => ({
        config: { ...state.config, [key]: value },
      })),
    palettes: allInitialPalettes,
    selectedPalette: initialSelectedPalette!,
    paletteSelectionOrder: initialPaletteSelectionOrder,
    setPalettes: (palettes) => {
      set({ palettes });
      savePalettes(palettes);
    },
    setSelectedPalette: (palette) => {
      set((state) => ({
        selectedPalette: palette,
        config: { ...state.config, palette },
      }));
      saveSelectedPaletteId(palette.id);

      const currentOrder = get().paletteSelectionOrder;
      if (currentOrder[0] !== palette.id) {
        const newOrder = [
          palette.id,
          ...currentOrder.filter((id) => id !== palette.id),
        ];
        set({ paletteSelectionOrder: newOrder });
        savePaletteSelectionOrder(newOrder);
      }
    },
    addPalette: (palette) => {
      const palettes = [...get().palettes, palette];
      set({ palettes });
      savePalettes(palettes);
    },
    updatePalette: (originalId, updatedPalette) => {
      set((state) => {
        const newPalettes = [...state.palettes];
        const originalIndex = newPalettes.findIndex((p) => p.id === originalId);

        if (originalIndex !== -1) {
          // If the ID has changed, we remove the old entry.
          if (originalId !== updatedPalette.id) {
            newPalettes.splice(originalIndex, 1);
          }
        }

        const existingIndexForNewId = newPalettes.findIndex(
          (p) => p.id === updatedPalette.id,
        );
        if (existingIndexForNewId !== -1) {
          newPalettes[existingIndexForNewId] = updatedPalette;
        } else {
          // If it's a new ID (from a rename), it might not exist, so push.
          // Or if it was a new palette to begin with.
          // The original logic in handleSavePalette is a bit ambiguous.
          // This logic handles both creating and updating.
          newPalettes.push(updatedPalette);
        }

        savePalettes(newPalettes);

        // If the updated palette is the selected one, update the config
        if (state.selectedPalette.id === originalId) {
          return {
            palettes: newPalettes,
            selectedPalette: updatedPalette,
            config: { ...state.config, palette: updatedPalette },
          };
        }

        return { palettes: newPalettes };
      });
    },
    deletePalette: (paletteId) => {
      const palettes = get().palettes.filter((p) => p.id !== paletteId);
      const order = get().paletteSelectionOrder.filter(
        (id) => id !== paletteId,
      );
      set({ palettes, paletteSelectionOrder: order });
      savePalettes(palettes);
      savePaletteSelectionOrder(order);

      if (get().selectedPalette.id === paletteId) {
        let nextSelected: Palette | undefined;
        if (order.length > 0) {
          nextSelected = palettes.find((p) => p.id === order[0]);
        }

        if (!nextSelected) {
          nextSelected =
            palettes.find((p) => p.kind === "Default") || palettes[0];
        }

        if (nextSelected) {
          set((state) => ({
            selectedPalette: nextSelected,
            config: { ...state.config, palette: nextSelected },
          }));
          saveSelectedPaletteId(nextSelected.id);
        } else {
          const defaultPalettes = loadDefaultPalettes();
          if (defaultPalettes.length > 0) {
            const newSelected = defaultPalettes[0];
            set((state) => ({
              selectedPalette: newSelected,
              config: { ...state.config, palette: newSelected },
            }));
            saveSelectedPaletteId(newSelected.id);
          } else {
            // All palettes are gone, this is a critical state.
            // For now, the UI will break, which is a sign of a problem.
          }
        }
      }
    },
  }),
);
