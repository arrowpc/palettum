import { create } from "zustand";
import { mutative } from "zustand-mutative";

interface MediaState {
  file: File | null;
  hasAlpha: boolean;
  setFile: (file: File | null) => void;
  setHasAlpha: (hasAlpha: boolean) => void;
}

export const useMediaStore = create<MediaState>()(
  mutative((set) => ({
    file: null,
    hasAlpha: false,
    setFile: (file) =>
      set((state) => {
        state.file = file;
      }),
    setHasAlpha: (hasAlpha) =>
      set((state) => {
        state.hasAlpha = hasAlpha;
      }),
  }))
);
