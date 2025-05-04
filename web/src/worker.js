import { palettify } from "palettum";

self.onmessage = function(e) {
  try {
    const { imageBytes, config, id } = e.data;

    console.log("Worker: Processing image, size:", imageBytes.length);

    const result = palettify(imageBytes, config);

    console.log("Worker: Processing complete, result size:", result.length);

    self.postMessage(
      {
        id: id,
        status: "success",
        result: result,
      },
      [result.buffer],
    );
  } catch (error) {
    console.error("Worker error:", error);

    self.postMessage({
      id: e.data.id,
      status: "error",
      error: error.toString(),
    });
  }
};
