export const LIMITS = {
  MIN_COLORS: 1,
  MAX_COLORS: 255,
  MAX_ID_LENGTH: 50,
  MAX_DIMENSION: 7680,
  MAX_FILE_SIZE: 200 * 1024 * 1024,
} as const;

export const DEFAULTS = {
  COLOR: { r: 0, g: 0, b: 0 },
} as const;
