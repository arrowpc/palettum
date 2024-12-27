import { ENV } from "../config/env";

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
}

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export async function processImage(
  image: File,
  palette: PaletteColor[],
  width?: number,
  height?: number,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("image", image);

  const paletteContent = palette
    .map((color) => `(${color.r}, ${color.g}, ${color.b})`)
    .join("\n");
  const paletteFile = new Blob([paletteContent], { type: "text/plain" });
  formData.append("palette", paletteFile, "palette.txt");

  if (width) formData.append("width", width.toString());
  if (height) formData.append("height", height.toString());

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "X-API-Key": ENV.API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error;
      } catch {
        errorMessage = "Failed to process image";
      }
      throw new APIError(response.status, errorMessage);
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(
      500,
      error instanceof Error
        ? error.message
        : "Failed to connect to the server",
    );
  }
}
