import {
  type LibAV as LibAVInstance,
  default as LibAV,
} from "@libav.js/variant-webcodecs";

import type * as LibAVWebCodecsBridge from "libavjs-webcodecs-bridge";

export type LibAVCtx = {
  libav: LibAVInstance;
  bridge: typeof LibAVWebCodecsBridge;
};

let libavCtx: LibAVCtx | null = null;
let initPromise: Promise<LibAVCtx> | null = null;

/**
 * Initializes and returns a singleton instance of the LibAV context.
 * Ensures that the WASM module is only loaded once.
 */
export async function initLibAV(): Promise<LibAVCtx> {
  if (libavCtx) return libavCtx;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [LibAVWebCodecs, LibAVWebCodecsBridge] = await Promise.all([
      import("libavjs-webcodecs-polyfill"),
      import("libavjs-webcodecs-bridge"),
    ]);

    await LibAVWebCodecs.load({
      polyfill: true,
      LibAV,
      libavOptions: { yesthreads: true, base: "/_libav" },
    });
    const libav = await LibAV.LibAV({ base: "/_libav" });
    const bridge = LibAVWebCodecsBridge;
    libavCtx = { libav, bridge };
    return libavCtx;
  })();

  return initPromise;
}
