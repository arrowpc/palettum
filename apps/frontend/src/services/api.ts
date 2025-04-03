import { ENV } from "@/config/env";
import type { Color } from "@/lib/palettes/types";

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export interface ProcessImageOptions {
  image: File;
  colors: Color[];
  width?: number | null;
  height?: number | null;
  transparentThreshold?: number;
  mapping?: string;
  quantLevel?: number;
  formula?: string;
  weighting_kernel?: string;
  anisotropic_labScales?: string;
  anisotropic_shapeParameter?: number;
  anisotropic_powerParameter?: number;
}

export async function processImage(
  options: ProcessImageOptions,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("image", options.image);

  const paletteContent = options.colors
    .map((color) => `(${color.r}, ${color.g}, ${color.b})`)
    .join("\n");
  const paletteFile = new Blob([paletteContent], { type: "text/plain" });
  formData.append("palette", paletteFile, "palette.txt");

  if (options.width) formData.append("width", options.width.toString());
  if (options.height) formData.append("height", options.height.toString());
  if (options.transparentThreshold !== undefined) {
    formData.append(
      "transparent_threshold",
      options.transparentThreshold.toString(),
    );
  }
  if (options.mapping) formData.append("mapping", options.mapping);
  if (options.quantLevel !== undefined) {
    formData.append("quant_level", options.quantLevel.toString());
  }
  if (options.formula) formData.append("formula", options.formula);

  if (options.weighting_kernel) {
    formData.append("weighting_kernel", options.weighting_kernel);
  }
  if (options.anisotropic_labScales) {
    formData.append("anisotropic_labScales", options.anisotropic_labScales);
  }
  if (options.anisotropic_shapeParameter !== undefined) {
    formData.append(
      "anisotropic_shapeParameter",
      options.anisotropic_shapeParameter.toString(),
    );
  }
  if (options.anisotropic_powerParameter !== undefined) {
    formData.append(
      "anisotropic_powerParameter",
      options.anisotropic_powerParameter.toString(),
    );
  }

  try {
    console.log("Sending FormData:", Object.fromEntries(formData.entries())); 
    const apiUrl = ENV.API_URL;
    const response = await fetch(`${apiUrl}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `API Error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        } else {
          errorMessage = response.statusText || "Failed to process image";
        }
      } catch (e) {
        errorMessage = response.statusText || "Failed to process image";
        console.error("Failed to parse error response:", e);
      }
      throw new APIError(response.status, errorMessage);
    }

    const contentType = response.headers.get("content-type");
    if (
      contentType?.startsWith("image/png") ||
      contentType?.startsWith("image/gif")
    ) {
      return await response.blob();
    } else {
      const textResponse = await response.text();
      console.error("Unexpected API response content type:", contentType);
      console.error("Response body:", textResponse);
      throw new APIError(
        500,
        "Received unexpected response format from server.",
      );
    }
  } catch (error) {
    console.error("Error in processImage:", error);
    if (error instanceof APIError) throw error;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to connect to the server or unknown error occurred";
    throw new APIError(500, message);
  }
}

