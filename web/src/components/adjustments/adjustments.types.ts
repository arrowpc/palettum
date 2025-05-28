export const MAPPING_PALETTIZED = "Palettized";
export const MAPPING_SMOOTHED = "Smoothed";
export type MappingKey = typeof MAPPING_PALETTIZED | typeof MAPPING_SMOOTHED;

export const FORMULA_CIEDE2000 = "CIEDE2000";
export const FORMULA_CIE94 = "CIE94";
export const FORMULA_CIE76 = "CIE76";
export type FormulaKey =
  | typeof FORMULA_CIEDE2000
  | typeof FORMULA_CIE94
  | typeof FORMULA_CIE76;

export const FORMULA_OPTIONS: FormulaKey[] = [
  FORMULA_CIEDE2000,
  FORMULA_CIE94,
  FORMULA_CIE76,
];
export const FORMULA_TOOLTIPS: Record<FormulaKey, string> = {
  [FORMULA_CIEDE2000]: "Most accurate color matching (slower)",
  [FORMULA_CIE94]: "Good balance of accuracy and speed",
  [FORMULA_CIE76]: "Fastest color matching (less accurate)",
};

export const SMOOTHING_STYLE_GAUSSIAN = "Gaussian";
export const SMOOTHING_STYLE_IDW = "Idw";
export const SMOOTHING_STYLE_RQ = "Rq";

export type SmoothingStyleKey =
  | typeof SMOOTHING_STYLE_GAUSSIAN
  | typeof SMOOTHING_STYLE_IDW
  | typeof SMOOTHING_STYLE_RQ;

export const SMOOTHING_STYLE_OPTIONS: SmoothingStyleKey[] = [
  SMOOTHING_STYLE_IDW,
  SMOOTHING_STYLE_GAUSSIAN,
  SMOOTHING_STYLE_RQ,
];

export const SMOOTHING_STYLE_NAMES: Record<SmoothingStyleKey, string> = {
  [SMOOTHING_STYLE_GAUSSIAN]: "Gaussian",
  [SMOOTHING_STYLE_IDW]: "Inverse Distance",
  [SMOOTHING_STYLE_RQ]: "Rational Quadratic",
};

export const SMOOTHING_STYLE_TOOLTIPS: Record<SmoothingStyleKey, string> = {
  [SMOOTHING_STYLE_GAUSSIAN]: "Smooth falloff with bell curve distribution",
  [SMOOTHING_STYLE_IDW]: "Sharper falloff with more defined color transitions",
  [SMOOTHING_STYLE_RQ]: "Flexible falloff with rational quadratic kernel",
};

export const DEFAULT_TRANSPARENCY_THRESHOLD_ENABLED = 128;
export const MAX_THRESHOLD = 255;
export const MIN_THRESHOLD = 1;

export const MIN_SMOOTHING_STRENGTH = 0.01;
export const MAX_SMOOTHING_STRENGTH = 1.0;
export const SMOOTHING_STRENGTH_STEP = 0.01;

export const DITHERING_NONE = "None";
export const DITHERING_FLOYD_STEINBERG = "FloydSteinberg";
export const DITHERING_BLUE_NOISE = "BlueNoise";
export type DitheringKey =
  | typeof DITHERING_NONE
  | typeof DITHERING_FLOYD_STEINBERG
  | typeof DITHERING_BLUE_NOISE;

export const DITHERING_OPTIONS: DitheringKey[] = [
  DITHERING_NONE,
  DITHERING_FLOYD_STEINBERG,
  DITHERING_BLUE_NOISE,
];

export const DITHERING_NAMES: Record<DitheringKey, string> = {
  [DITHERING_NONE]: "None",
  [DITHERING_FLOYD_STEINBERG]: "Floyd-Steinberg",
  [DITHERING_BLUE_NOISE]: "Blue Noise",
};

export const DITHERING_TOOLTIPS: Record<DitheringKey, string> = {
  [DITHERING_NONE]: "No dithering applied. Fastest, may show color banding",
  [DITHERING_FLOYD_STEINBERG]:
    "Best quality error diffusion dithering (slower processing)",
  [DITHERING_BLUE_NOISE]:
    "Good quality ordered dithering using blue noise (faster than Floyd-Steinberg)",
};

export const DEFAULT_DITHERING_STYLE: DitheringKey = DITHERING_NONE;

export const MIN_DITHERING_STRENGTH = 0.01;
export const MAX_DITHERING_STRENGTH = 1.0;
export const DITHERING_STRENGTH_STEP = 0.01;
export const DEFAULT_DITHERING_STRENGTH = 0.5;

export const MIN_QUANT_LEVEL = 0;
export const MAX_QUANT_LEVEL = 5;
export const QUANT_LEVEL_STEP = 1;
export const DEFAULT_QUANT_LEVEL = 2;

export const FILTER_NEAREST = "Nearest";
export const FILTER_TRIANGLE = "Triangle";
export const FILTER_LANCZOS3 = "Lanczos3";

export type FilterKey =
  | typeof FILTER_NEAREST
  | typeof FILTER_TRIANGLE
  | typeof FILTER_LANCZOS3;

export const FILTER_OPTIONS: FilterKey[] = [
  FILTER_NEAREST,
  FILTER_TRIANGLE,
  FILTER_LANCZOS3,
];

export const FILTER_TOOLTIPS: Record<FilterKey, string> = {
  [FILTER_NEAREST]: "Best for resizing pixel-art",
  [FILTER_TRIANGLE]: "Good for fast, general-purpose resizing",
  [FILTER_LANCZOS3]: "Best for high-quality photo resizing",
};

export const DEFAULT_FILTER: FilterKey = FILTER_NEAREST;
