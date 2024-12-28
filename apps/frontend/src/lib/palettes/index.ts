import type { Color, Palette } from "./types";
import { LIMITS, DEFAULTS } from "./constants";
import {
  rgbToHex,
  hexToRgb,
  normalizeColor,
  isSameColor,
  validatePalette,
} from "./utils";
import { catppuccin } from "./palettes/catppuccin-mocha";
import { dracula } from "./palettes/dracula";
import { nord } from "./palettes/nord";
import { gruvbox } from "./palettes/gruvbox";

export type { Color, Palette };

export { LIMITS, DEFAULTS };

export { rgbToHex, hexToRgb, normalizeColor, isSameColor, validatePalette };

export const defaultPalettes = [catppuccin, dracula, gruvbox, nord] as const;

export { catppuccin, dracula, gruvbox, nord };
