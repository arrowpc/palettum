import { palettify } from "palettum";
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

self.onmessage = function (e: MessageEvent<WorkerRequest>) {
  try {
    const { imageBytes, config, id } = e.data;

    console.log("Worker: Processing image, size:", imageBytes.length);

    const result = palettify(imageBytes, config);

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
