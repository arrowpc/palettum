// Extended FieldDef to support custom formatting
export interface FieldDef<O> {
  /** the key in your options object */
  key: keyof O;
  /** pull the small integer out of opts */
  encode: (opts: O) => number;
  /** write the small integer back into partial opts */
  decode: (value: number, target: Partial<O>) => void;

  /** is this segment MANDATORY? */
  mandatory: boolean;
  /** what to assume if optional and no segment present */
  default: number;

  /**
   * either a static list of allowed values,
   * or a function that given current partial opts
   * returns the allowed values.
   */
  allowed?: number[] | ((opts: Partial<O>) => number[]);

  /** e.g. "color" to group chroma,color,range as one optional block */
  group?: string;

  /** UI label (optional) */
  label?: string;

  /** Custom formatter (overrides default pad2) */
  format?: (value: number, opts: O) => string;
  /** Custom parser for formatted segments */
  parse?: (segment: string, opts: Partial<O>) => number;
  /** Number of digits for padding (overrides pad2 default) */
  digits?: number;
}

export interface CodecDef<O> {
  fourcc: string;
  fields: FieldDef<O>[];
}

function padN(n: number, digits: number): string {
  return n.toString().padStart(digits, "0");
}

function pad2(n: number): string {
  return padN(n, 2);
}

/** Build a tag like "vp09.02.10.10.…" or "av01.0.04M.10.…" */
export function buildTag<O>(def: CodecDef<O>, opts: O): string {
  validateOpts(def, opts);

  // Handle AV1 trailing defaults omission
  let parts = def.fields.map((f) => {
    if (f.format) {
      return f.format(f.encode(opts), opts);
    } else if (f.digits) {
      return padN(f.encode(opts), f.digits);
    } else {
      return pad2(f.encode(opts));
    }
  });

  // For AV1, omit trailing defaults if they match the default pattern
  if (def.fourcc === "av01") {
    const defaultSuffix = ["0", "110", "01", "01", "01", "0"];
    const mandatoryCount = 4; // profile, level+tier, bitDepth, monochrome

    if (parts.length >= mandatoryCount + defaultSuffix.length) {
      const trailingParts = parts.slice(-defaultSuffix.length);
      if (JSON.stringify(trailingParts) === JSON.stringify(defaultSuffix)) {
        parts = parts.slice(0, -defaultSuffix.length);
      }
    }
  }

  return `${def.fourcc}.${parts.join(".")}`;
}

/** Parse a tag back into a fully-populated opts object */
export function parseTag<O>(def: CodecDef<O>, tag: string): O {
  const segs = tag.split(".");
  if (segs[0] !== def.fourcc) {
    throw new Error(`Expected ${def.fourcc}, got ${segs[0]}`);
  }
  const segments = segs.slice(1);
  const out: Partial<O> = {};

  def.fields.forEach((f, i) => {
    if (i < segments.length) {
      if (f.parse) {
        f.decode(f.parse(segments[i], out), out);
      } else {
        f.decode(parseInt(segments[i], 10), out);
      }
    } else if (f.mandatory) {
      throw new Error(`Missing mandatory field: ${String(f.key)}`);
    } else {
      f.decode(f.default, out);
    }
  });

  return validateOpts(def, out as O);
}

/**
 * Validate that opts has all mandatory fields in range,
 * fills in defaults for optional, enforces group rules,
 * and enforces allowed‐values constraints.
 */
export function validateOpts<O>(def: CodecDef<O>, opts: O): O {
  // 1) apply defaults for missing optional
  def.fields.forEach((f) => {
    const v = (opts as any)[f.key];
    if (v == null) {
      if (f.mandatory) {
        throw new Error(`Field ${String(f.key)} is required`);
      }
      (opts as any)[f.key] = f.default;
    }
  });

  // 2) enforce allowed ranges
  def.fields.forEach((f) => {
    const v = (opts as any)[f.key] as number;
    if (f.allowed) {
      const allowed =
        typeof f.allowed === "function" ? f.allowed(opts) : f.allowed;
      if (!allowed.includes(v)) {
        throw new Error(
          `Field ${String(f.key)}=${v} not in allowed set [${allowed.join(
            ",",
          )}]`,
        );
      }
    }
  });

  // 3) enforce mutually‐inclusive optional groups
  const groups = new Map<string, FieldDef<O>[]>();
  def.fields.forEach((f) => {
    if (f.group) {
      groups.set(f.group, (groups.get(f.group) || []).concat(f));
    }
  });
  for (const [g, fields] of groups) {
    const anySet = fields.some((f) => (opts as any)[f.key] !== f.default);
    if (anySet) {
      fields.forEach((f) => {
        if ((opts as any)[f.key] == null) {
          throw new Error(`Group "${g}" requires all fields or none`);
        }
      });
    }
  }

  return opts;
}

/** Options for VP9 codec string */
/** https://www.webmproject.org/vp9/mp4/ */
export interface Vp9Opts {
  profile: 0 | 1 | 2 | 3;
  level: 10 | 11 | 20 | 21 | 30 | 31 | 40 | 41 | 50 | 51 | 52 | 60 | 61 | 62;
  bitDepth: 8 | 10 | 12;
  /** 0=4:2:0 vert, 1=4:2:0 colocated, 2=4:2:2, 3=4:4:4 */
  chromaSubsampling: 0 | 1 | 2 | 3;

  /** Optional color metadata (mutually inclusive group "color") */
  colorPrimaries: number;
  transferCharacteristics: number;
  matrixCoefficients: number;
  videoFullRangeFlag: 0 | 1;
}

export const vp9Def: CodecDef<Vp9Opts> = {
  fourcc: "vp09",
  fields: [
    {
      key: "profile",
      mandatory: true,
      default: 0,
      allowed: [0, 1, 2, 3],
      encode: (o) => o.profile,
      decode: (v, t) => {
        t.profile = v as any;
      },
      label: "Profile",
    },
    {
      key: "level",
      mandatory: true,
      default: 10,
      allowed: [10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 52, 60, 61, 62],
      encode: (o) => o.level,
      decode: (v, t) => {
        t.level = v as any;
      },
      label: "Level ×10",
    },
    {
      key: "bitDepth",
      mandatory: true,
      default: 8,
      allowed: (o) => (o.profile === 2 || o.profile === 3 ? [10, 12] : [8]),
      encode: (o) => o.bitDepth,
      decode: (v, t) => {
        t.bitDepth = v as any;
      },
      label: "Bit Depth",
    },
    {
      key: "chromaSubsampling",
      mandatory: true,
      default: 1,
      allowed: (o) => (o.profile === 1 || o.profile === 3 ? [2, 3] : [0, 1]),
      encode: (o) => o.chromaSubsampling,
      decode: (v, t) => {
        t.chromaSubsampling = v as any;
      },
      label: "Chroma Subsampling",
    },
    // Optional color metadata: must all appear or none
    {
      key: "colorPrimaries",
      mandatory: false,
      default: 1,
      // ISO/IEC 23001-8 codes 0–255
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.colorPrimaries,
      decode: (v, t) => {
        t.colorPrimaries = v;
      },
      group: "color",
      label: "Color Primaries",
    },
    {
      key: "transferCharacteristics",
      mandatory: false,
      default: 1,
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.transferCharacteristics,
      decode: (v, t) => {
        t.transferCharacteristics = v;
      },
      group: "color",
      label: "Transfer Characteristics",
    },
    {
      key: "matrixCoefficients",
      mandatory: false,
      default: 1,
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.matrixCoefficients,
      decode: (v, t) => {
        t.matrixCoefficients = v;
      },
      group: "color",
      label: "Matrix Coefficients",
    },
    {
      key: "videoFullRangeFlag",
      mandatory: false,
      default: 0,
      allowed: [0, 1],
      encode: (o) => o.videoFullRangeFlag,
      decode: (v, t) => {
        t.videoFullRangeFlag = v as any;
      },
      group: "color",
      label: "Full Range",
    },
  ],
};

/** Options for AV1 codec string */
/** https://aomediacodec.github.io/av1-isobmff/#codecsparam */
/** https://aomediacodec.github.io/av1-spec/av1-spec.pdf#page=39 */
export interface Av1Opts {
  profile: 0 | 1 | 2;
  level: number; // AV1 level values 0-31
  tier: 0 | 1; // 0 = Main (M), 1 = High (H)
  bitDepth: 8 | 10 | 12;
  monochrome: 0 | 1;
  subsamplingX: 0 | 1;
  subsamplingY: 0 | 1;
  chromaSamplePosition: 0 | 1 | 2 | 3;

  /** Optional color metadata (mutually inclusive group "color") */
  colorPrimaries: number;
  transferCharacteristics: number;
  matrixCoefficients: number;
  videoFullRangeFlag: 0 | 1;
}

export const av1Def: CodecDef<Av1Opts> = {
  fourcc: "av01",
  fields: [
    {
      key: "profile",
      mandatory: true,
      default: 0,
      allowed: [0, 1, 2],
      digits: 1,
      encode: (o) => o.profile,
      decode: (v, t) => {
        t.profile = v as any;
      },
      label: "Profile",
    },
    {
      key: "level",
      mandatory: true,
      default: 0,
      allowed: Array.from({ length: 32 }, (_, i) => i), // 0-31
      encode: (o) => o.level,
      decode: (v, t) => {
        t.level = v;
      },
      format: (level, opts) => {
        const tierChar = opts.tier === 1 ? "H" : "M";
        return `${padN(level, 2)}${tierChar}`;
      },
      parse: (segment, opts) => {
        const match = segment.match(/^(\d+)([MH])$/);
        if (!match) throw new Error(`Invalid level+tier format: ${segment}`);
        const level = parseInt(match[1], 10);
        opts.tier = match[2] === "H" ? 1 : 0;
        return level;
      },
      label: "Level + Tier",
    },
    {
      key: "tier",
      mandatory: true,
      default: 0,
      allowed: [0, 1],
      encode: (o) => o.tier,
      decode: (v, t) => {
        t.tier = v as any;
      },
      // This field is encoded/decoded as part of level, so we skip it
      format: () => "", // Skip in output
      parse: () => 0, // Already handled in level parsing
    },
    {
      key: "bitDepth",
      mandatory: true,
      default: 8,
      allowed: [8, 10, 12],
      encode: (o) => o.bitDepth,
      decode: (v, t) => {
        t.bitDepth = v as any;
      },
      label: "Bit Depth",
    },
    {
      key: "monochrome",
      mandatory: false,
      default: 0,
      allowed: [0, 1],
      digits: 1,
      encode: (o) => o.monochrome,
      decode: (v, t) => {
        t.monochrome = v as any;
      },
      group: "optional",
      label: "Monochrome",
    },
    {
      key: "subsamplingX",
      mandatory: false,
      default: 1,
      allowed: [0, 1],
      encode: (o) =>
        o.subsamplingX * 100 +
        o.subsamplingY * 10 +
        (o.subsamplingX && o.subsamplingY ? o.chromaSamplePosition : 0),
      decode: (v, t) => {
        t.subsamplingX = Math.floor(v / 100) as 0 | 1;
        t.subsamplingY = Math.floor((v % 100) / 10) as 0 | 1;
        t.chromaSamplePosition = (v % 10) as 0 | 1 | 2 | 3;
      },
      digits: 3,
      group: "optional",
      label: "Chroma Subsampling",
    },
    {
      key: "subsamplingY",
      mandatory: false,
      default: 1,
      allowed: [0, 1],
      encode: () => 0, // Handled by subsamplingX
      decode: () => {}, // Handled by subsamplingX
      format: () => "", // Skip in output
      parse: () => 0,
    },
    {
      key: "chromaSamplePosition",
      mandatory: false,
      default: 0,
      allowed: [0, 1, 2, 3],
      encode: () => 0, // Handled by subsamplingX
      decode: () => {}, // Handled by subsamplingX
      format: () => "", // Skip in output
      parse: () => 0,
    },
    {
      key: "colorPrimaries",
      mandatory: false,
      default: 1,
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.colorPrimaries,
      decode: (v, t) => {
        t.colorPrimaries = v;
      },
      group: "optional",
      label: "Color Primaries",
    },
    {
      key: "transferCharacteristics",
      mandatory: false,
      default: 1,
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.transferCharacteristics,
      decode: (v, t) => {
        t.transferCharacteristics = v;
      },
      group: "optional",
      label: "Transfer Characteristics",
    },
    {
      key: "matrixCoefficients",
      mandatory: false,
      default: 1,
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.matrixCoefficients,
      decode: (v, t) => {
        t.matrixCoefficients = v;
      },
      group: "optional",
      label: "Matrix Coefficients",
    },
    {
      key: "videoFullRangeFlag",
      mandatory: false,
      default: 0,
      allowed: [0, 1],
      digits: 1,
      encode: (o) => o.videoFullRangeFlag,
      decode: (v, t) => {
        t.videoFullRangeFlag = v as any;
      },
      group: "optional",
      label: "Full Range",
    },
  ],
};
