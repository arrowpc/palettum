/// <reference lib="webworker" />
import {
  palettify,
  init_gpu_processor,
  load_media,
  clear_media,
} from "palettum";
import type { Config } from "palettum";

type WorkerRequest =
  | { id: number; type: "load"; bytes: Uint8Array }
  | { id: number; type: "palettify"; config: Config }
  | { id: number; type: "clear" }
  | { id: number; type: "init" };

interface WorkerSuccessResponse {
  id: number;
  status: "success";
  result?: Uint8Array;
}

interface WorkerErrorResponse {
  id: number;
  status: "error";
  error: string;
}

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
  const { id, type } = e.data;
  try {
    await ensureReady();

    if (type === "init") {
      console.log("Worker: Received 'init' message. GPU should be ready.");
      (self as DedicatedWorkerGlobalScope).postMessage({
        id,
        status: "success",
      } as WorkerSuccessResponse);
    } else if (type === "load") {
      console.log("Worker: Received 'load' message.");
      load_media(e.data.bytes);
      console.log("Worker: 'load_media' WASM call appears successful from JS.");
      (self as DedicatedWorkerGlobalScope).postMessage({
        id,
        status: "success",
      } as WorkerSuccessResponse);
    } else if (type === "palettify") {
      const result = await palettify(e.data.config);
      (self as DedicatedWorkerGlobalScope).postMessage(
        {
          id,
          status: "success",
          result,
        } as WorkerSuccessResponse,
        [result.buffer],
      );
    } else if (type === "clear") {
      clear_media();
      (self as DedicatedWorkerGlobalScope).postMessage({
        id,
        status: "success",
      } as WorkerSuccessResponse);
    } else {
      throw new Error("Unknown worker request type");
    }
  } catch (error: any) {
    console.error("Worker error:", error);

    const response: WorkerErrorResponse = {
      id: (e.data as any).id,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };

    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
};
