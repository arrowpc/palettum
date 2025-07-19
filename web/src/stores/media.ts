import { create } from "zustand";

export type MediaType = "Gif" | "Image" | "Video";

export interface MediaMeta {
  type: MediaType;
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  duration: number;
  width: number;
  height: number;
}

interface MediaState {
  file: File | null;
  // TODO: hasAlpha should be moved to MediaMeta. This will require refactoring how we detect alpha
  hasAlpha: boolean;
  meta: MediaMeta | null;
  isLoading: boolean;

  resizedWidth: number;
  resizedHeight: number;

  setFile: (f: File | null) => void;
  setHasAlpha: (b: boolean) => void;
  setMediaMeta: (m: MediaMeta) => void;
  setResizedDims: (w: number, h: number) => void;
  setIsLoading: (b: boolean) => void;

  reset: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  file: null,
  hasAlpha: false,
  meta: null,
  isLoading: false,
  resizedWidth: 0,
  resizedHeight: 0,
  setFile: (file) => set(() => ({ file, isLoading: true })),
  setHasAlpha: (hasAlpha) => set(() => ({ hasAlpha })),
  setMediaMeta: (meta) => set(() => ({ meta })),
  setResizedDims: (resizedWidth, resizedHeight) =>
    set(() => ({ resizedWidth, resizedHeight })),
  setIsLoading: (isLoading) => set(() => ({ isLoading })),
  reset: () =>
    set(() => ({
      file: null,
      hasAlpha: false,
      meta: null,
      isLoading: false,
      resizedWidth: 0,
      resizedHeight: 0,
    })),
}));
