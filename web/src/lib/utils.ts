import { Rgb } from "palettum";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getContrastColor(color: Rgb | string, alpha = 1): string {
  let r: number, g: number, b: number;

  if (typeof color === "string") {
    const hex = color.replace("#", "");
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    ({ r, g, b } = color);
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6
    ? `rgba(0,0,0,${alpha})`
    : `rgba(255,255,255,${alpha})`;
}

export function getContrastTextColor(color: Rgb | string): "black" | "white" {
  let r: number, g: number, b: number;

  if (typeof color === "string") {
    const hex = color.replace("#", "");
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    ({ r, g, b } = color);
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "black" : "white";
}

export function getOppositeTextColor(color: Rgb | string): "black" | "white" {
  return getContrastTextColor(color) === "black" ? "white" : "black";
}
