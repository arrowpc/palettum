/// <reference lib="webworker" />
import { palettify, init_gpu_processor } from "palettum";
import type { Config } from "palettum";

interface WorkerRequest {
  id: number;
  imageBytes: Uint8Array;
  config: Config;
}

interface WorkerSuccessResponse {
  id: number;
  status: "success";
  result: Uint8Array;
}

interface WorkerErrorResponse {
  id: number;
  status: "error";
  error: string;
}

// Initialize WASM and GPU processor before handling any messages
let ready: Promise<void> | null = null;

function ensureReady() {
  if (!ready) {
    ready = (async () => {
      await init_gpu_processor();
      console.log("Worker: GPU processor initialized");
    })();
  }
  return ready;
}

self.onmessage = async function(e: MessageEvent<WorkerRequest>) {
  try {
    await ensureReady();

    const { imageBytes, config, id } = e.data;

    console.log("Worker: Processing image, size:", imageBytes.length);

    const result = await palettify(imageBytes, config);

    console.log("Worker: Processing complete, result size:", result.length);

    const response: WorkerSuccessResponse = {
      id,
      status: "success",
      result,
    };

    (self as DedicatedWorkerGlobalScope).postMessage(response, [result.buffer]);
  } catch (error: any) {
    console.error("Worker error:", error);

    const response: WorkerErrorResponse = {
      id: e.data.id,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };

    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
};
