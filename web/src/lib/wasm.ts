import { simd } from "wasm-feature-detect";

let wasm: any | null = null;

async function loadWasm() {
  if (wasm) {
    return wasm;
  }

  const simdSupported = await simd();
  if (simdSupported) {
    try {
      console.log("WASM SIMD supported");
      wasm = await import("../wasm/pkg");
      return wasm;
    } catch (e) {
      console.warn("WASM SIMD check passed, but failed to load module:", e);
    }
  }

  console.log("WASM SIMD not supported, falling back to non-SIMD");
  wasm = await import("../wasm/pkg-nosimd");
  return wasm;
}

export default loadWasm();
