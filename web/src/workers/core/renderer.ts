import wasm from "@/lib/wasm";

let renderer: any | null = null;

/**
 * Lazily loads and returns the singleton renderer instance
 */
export async function getRenderer() {
  if (renderer) return renderer;
  const { Renderer } = await wasm;
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
