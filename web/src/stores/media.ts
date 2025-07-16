import { create } from "zustand";

export interface MediaMeta {
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  width: number;
  height: number;
}

interface MediaState {
  file: File | null;
  // TODO: hasAlpha should be moved to MediaMeta. This will require refactoring how we detect alpha
  hasAlpha: boolean;
  meta: MediaMeta | null;

  resizedWidth: number;
  resizedHeight: number;

  setFile: (f: File | null) => void;
  setHasAlpha: (b: boolean) => void;
  setMediaMeta: (m: MediaMeta) => void;
  setResizedDims: (w: number, h: number) => void;

  reset: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  file: null,
  hasAlpha: false,
  meta: null,
  resizedWidth: 0,
  resizedHeight: 0,
  setFile: (file) => set(() => ({ file })),
  setHasAlpha: (hasAlpha) => set(() => ({ hasAlpha })),
  setMediaMeta: (meta) => set(() => ({ meta })),
  setResizedDims: (resizedWidth, resizedHeight) =>
    set(() => ({ resizedWidth, resizedHeight })),
  reset: () =>
    set(() => ({
      file: null,
      hasAlpha: false,
      meta: null,
      resizedWidth: 0,
      resizedHeight: 0,
    })),
}));
