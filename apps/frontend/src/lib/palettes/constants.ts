export const LIMITS = {
  MIN_COLORS: 1,
  MAX_COLORS: 255,
  MAX_NAME_LENGTH: 50,
  MAX_DIMENSION: 3840,
  MAX_FILE_SIZE: 25 * 1024 * 1024,
} as const;

export const DEFAULTS = {
  COLOR: { r: 0, g: 0, b: 0 },
} as const;
