import { simd } from "wasm-feature-detect";

let cachedPath: string | null = null;

export async function getWasmPath(): Promise<string> {
  if (cachedPath) return cachedPath;
  const simdSupported = await simd();
  cachedPath = simdSupported ? "/src/wasm/pkg/" : "/src/wasm/pkg-nosimd/";
  console.log(
    simdSupported ? "WASM SIMD supported" : "WASM SIMD not supported",
  );
  return cachedPath;
}
