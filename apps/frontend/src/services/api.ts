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

  // Create a text file with the palette data
  const paletteContent = palette
    .map((color) => `(${color.r}, ${color.g}, ${color.b})`)
    .join("\n");
  const paletteFile = new Blob([paletteContent], { type: "text/plain" });
  formData.append("palette", paletteFile, "palette.txt");

  if (width) formData.append("width", width.toString());
  if (height) formData.append("height", height.toString());

  try {
    // Using the proxy path instead of direct URL
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new APIError(
        response.status,
        errorData.error || "Failed to process image",
      );
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(500, "Failed to connect to the server");
  }
}
