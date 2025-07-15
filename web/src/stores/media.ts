import { create } from "zustand";

interface MediaState {
  file: File | null;
  hasAlpha: boolean;
  setFile: (file: File | null) => void;
  setHasAlpha: (hasAlpha: boolean) => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  file: null,
  hasAlpha: false,
  setFile: (file) => set({ file }),
  setHasAlpha: (hasAlpha) => set({ hasAlpha }),
}));
