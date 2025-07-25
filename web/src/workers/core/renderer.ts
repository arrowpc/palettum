let renderer: any | null = null;
import { getWasmPath } from "@/wasm-detect";

/**
 * Lazily loads and returns the singleton renderer instance
 */
export async function getRenderer() {
  if (renderer) return renderer;
  const wasmPath = await getWasmPath();
  const { Renderer } = await import(wasmPath);
  renderer = await new Renderer();
  return renderer;
}

/**
 * Disposes of the renderer instance
 */
export function disposeRenderer() {
  renderer?.dispose();
  renderer = null;
}
