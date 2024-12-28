import type { Color, Palette } from "./types";
import { LIMITS } from "./constants";

export function rgbToHex({ r, g, b }: Color): string {
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

export function hexToRgb(hex: string): Color | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function normalizeColor(color: Color): Color {
  return {
    r: Math.min(255, Math.max(0, Math.round(color.r))),
    g: Math.min(255, Math.max(0, Math.round(color.g))),
    b: Math.min(255, Math.max(0, Math.round(color.b))),
  };
}

export function isSameColor(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export function validatePalette(palette: Palette): string[] {
  const errors: string[] = [];

  if (!palette.name.trim()) {
    errors.push("Palette name is required");
  }

  if (palette.colors.length < LIMITS.MIN_COLORS) {
    errors.push(`Palette must have at least ${LIMITS.MIN_COLORS} color`);
  }

  if (palette.colors.length > LIMITS.MAX_COLORS) {
    errors.push(`Palette cannot have more than ${LIMITS.MAX_COLORS} colors`);
  }

  return errors;
}
