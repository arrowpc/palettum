import type { Color, Palette } from "./types";
import { LIMITS, DEFAULTS } from "./constants";
import {
  rgbToHex,
  hexToRgb,
  normalizeColor,
  isSameColor,
  validatePalette,
} from "./utils";

export type { Color, Palette };

export { LIMITS, DEFAULTS };

export { rgbToHex, hexToRgb, normalizeColor, isSameColor, validatePalette };

import { gruvbox } from "./palettes/gruvbox";
import { rplace_22 } from "./palettes/rplace_22";
import { catppuccin_latte } from "./palettes/catppuccin-latte";
import { catppuccin_frappe } from "./palettes/catppuccin-frappe";
import { catppuccin_macchiato } from "./palettes/catppuccin-macchiato";
import { catppuccin_mocha } from "./palettes/catppuccin-mocha";
import { dracula } from "./palettes/dracula";
import { nord } from "./palettes/nord";

export const defaultPalettes = [
  gruvbox,
  rplace_22,
  catppuccin_mocha,
  catppuccin_latte,
  catppuccin_frappe,
  catppuccin_macchiato,
  dracula,
  nord,
] as const;

export {
  gruvbox,
  rplace_22,
  catppuccin_mocha,
  catppuccin_latte,
  catppuccin_frappe,
  catppuccin_macchiato,
  dracula,
  nord,
};
