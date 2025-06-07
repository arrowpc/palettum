export const LIMITS = {
  MIN_COLORS: 1,
  MAX_COLORS: 255,
  MAX_ID_LENGTH: 50,
  // TODO: Delineate between max draw dimension and max encode dimension
  MAX_DIMENSION: 2048,
  MAX_FILE_SIZE: 200 * 1024 * 1024,
} as const;

export const DEFAULTS = {
  COLOR: { r: 0, g: 0, b: 0 },
} as const;
