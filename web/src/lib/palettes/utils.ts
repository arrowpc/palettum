import { LIMITS } from "./constants";
import { type Palette, type Rgb } from "palettum";

// Use Rgb instead of Color
export function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.max(0, Math.min(255, Math.round(x)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function hexToRgb(hex: string): Rgb | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function normalizeColor(color: Rgb): Rgb {
  return {
    r: Math.min(255, Math.max(0, Math.round(color.r))),
    g: Math.min(255, Math.max(0, Math.round(color.g))),
    b: Math.min(255, Math.max(0, Math.round(color.b))),
  };
}

export function isSameColor(a: Rgb, b: Rgb): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export function validatePalette(palette: Palette): string[] {
  const errors: string[] = [];

  if (!palette.id || !palette.id.trim()) {
    errors.push("Palette id is required");
  }

  const colorCount = palette.colors?.length ?? 0;

  if (colorCount < LIMITS.MIN_COLORS) {
    errors.push(
      `Palette must have at least ${LIMITS.MIN_COLORS} color${LIMITS.MIN_COLORS > 1 ? "s" : ""}`,
    );
  }

  if (colorCount > LIMITS.MAX_COLORS) {
    errors.push(`Palette cannot have more than ${LIMITS.MAX_COLORS} colors`);
  }

  return errors;
}
