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

/**
 * Build a tag like "vp09.02.10.10.…" or "av01.0.04M.10" or "avc1.42E01E".
 */
export function buildTag<O>(def: CodecDef<O>, opts: O): string {
  validateOpts(def, opts);

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

  // Filter out empty parts from fields that are packed into another field
  const finalParts = parts.filter((p) => p !== "");

  return `${def.fourcc}.${finalParts.join(".")}`;
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

/** Options for AVC (H.264) codec string */
/** https://tools.ietf.org/html/rfc6381#section-3.3 */
/** https://github.com/cisco/openh264/blob/0c9a557a9a6f1d267c4d372221669a8ae69ccda0/codec/api/wels/codec_app_def.h#L277  */
export interface AvcOpts {
  /** profile_idc: e.g., 66 (Baseline), 77 (Main), 100 (High) */
  profile: number;
  /** 8-bit constraints byte (constraint_set0_flag to constraint_set5_flag) */
  constraints: number;
  /** level_idc: e.g., 30 (Level 3.0), 41 (Level 4.1) */
  level: number;
}

export const avcDef: CodecDef<AvcOpts> = {
  fourcc: "avc1",
  fields: [
    {
      key: "profile",
      mandatory: true,
      default: 66, // Baseline
      allowed: [66, 77, 88, 100, 110, 122, 144, 244, 83, 86],
      encode: (o) => o.profile,
      decode: (v, t) => {
        t.profile = v;
      },
      label: "Profile",
      format: (_v, opts) => {
        // This field formats all three properties into the 6-char hex string
        const p = opts.profile;
        const c = opts.constraints ?? 0;
        const l = opts.level;
        const profileHex = p.toString(16).padStart(2, "0").toUpperCase();
        const constraintsHex = c.toString(16).padStart(2, "0").toUpperCase();
        const levelHex = l.toString(16).padStart(2, "0").toUpperCase();
        return `${profileHex}${constraintsHex}${levelHex}`;
      },
      parse: (segment, target) => {
        // This field parses the 6-char hex string into all three properties
        if (segment.length !== 6) {
          throw new Error(
            `Invalid avcoti segment: ${segment}. Must be 6 hex characters.`,
          );
        }
        target.profile = parseInt(segment.substring(0, 2), 16);
        target.constraints = parseInt(segment.substring(2, 4), 16);
        target.level = parseInt(segment.substring(4, 6), 16);
        return target.profile;
      },
    },
    {
      key: "constraints",
      mandatory: false, // Mandatory, but marked false to work with parser
      default: 0,
      allowed: () => Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.constraints,
      decode: (v, t) => {
        // Only set from default if not already parsed by the profile field
        if (t.constraints === undefined) {
          t.constraints = v;
        }
      },
      label: "Constraints",
      format: () => "", // Handled by profile field
      parse: () => 0, // Handled by profile field
    },
    {
      key: "level",
      mandatory: false, // Mandatory, but marked false to work with parser
      default: 30, // Level 3.0
      allowed: [
        10, 9, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52,
      ],
      encode: (o) => o.level,
      decode: (v, t) => {
        // Only set from default if not already parsed by the profile field
        if (t.level === undefined) {
          t.level = v;
        }
      },
      label: "Level",
      format: () => "", // Handled by profile field
      parse: () => 0, // Handled by profile field
    },
  ],
};

/** Options for HEVC (H.265) codec string */
/** https://www.w3.org/TR/webcodecs-hevc-codec-registration/ */
/** https://www.rfc-editor.org/rfc/rfc7798#section-7.1 */
export interface HevcOpts {
  /** general_profile_space: 0-3. Encoded as '', 'A', 'B', 'C'. */
  profileSpace: 0 | 1 | 2 | 3;
  /** general_profile_idc: 0-31. */
  profileId: number;
  /** general_profile_compatibility_flags: 32-bit hex value. */
  profileCompatibility: number;
  /** general_tier_flag: 0 for Main (L), 1 for High (H). */
  tier: 0 | 1;
  /** general_level_idc: e.g., 93 for level 3.1. */
  levelIdc: number;
  /** 48-bit constraint flags (interop-constraints), as a 12-char hex string. */
  constraints: number;
}

export const hevcDef: CodecDef<HevcOpts> = {
  fourcc: "hvc1",
  fields: [
    {
      key: "profileId",
      mandatory: true,
      default: 1, // Main Profile
      allowed: Array.from({ length: 32 }, (_, i) => i),
      encode: (o) => o.profileId,
      decode: (v, t) => {
        t.profileId = v;
      },
      label: "Profile",
      format: (profileId, opts) => {
        const spaceMap = ["", "A", "B", "C"];
        const space = spaceMap[opts.profileSpace] || "";
        return `${space}${profileId}`;
      },
      parse: (segment, target) => {
        const spaceMatch = segment.match(/^([A-C])(\d+)$/);
        if (spaceMatch) {
          const spaceMap: { [key: string]: 1 | 2 | 3 } = {
            A: 1,
            B: 2,
            C: 3,
          };
          target.profileSpace = spaceMap[spaceMatch[1]];
          return parseInt(spaceMatch[2], 10);
        }
        target.profileSpace = 0;
        return parseInt(segment, 10);
      },
    },
    {
      key: "profileSpace",
      mandatory: true,
      default: 0,
      allowed: [0, 1, 2, 3],
      encode: (o) => o.profileSpace,
      decode: (v, t) => {
        if (t.profileSpace === undefined) t.profileSpace = v as any;
      },
      format: () => "", // Handled by profileId
      parse: () => 0, // Handled by profileId
    },
    {
      key: "profileCompatibility",
      mandatory: true,
      default: 2, // Bit 1 set for Main Profile (profileId=1)
      encode: (o) => o.profileCompatibility,
      decode: (v, t) => {
        t.profileCompatibility = v;
      },
      label: "Profile Compatibility",
      format: (v) => v.toString(16).toUpperCase().padStart(8, "0"),
      parse: (s) => parseInt(s, 16),
    },
    {
      key: "levelIdc",
      mandatory: true,
      default: 93, // Level 3.1
      allowed: Array.from({ length: 256 }, (_, i) => i),
      encode: (o) => o.levelIdc,
      decode: (v, t) => {
        t.levelIdc = v;
      },
      label: "Level",
      format: (levelIdc, opts) => {
        const tierChar = opts.tier === 1 ? "H" : "L";
        return `${tierChar}${levelIdc}`;
      },
      parse: (segment, target) => {
        const tierMatch = segment.match(/^([LH])(\d+)$/);
        if (!tierMatch)
          throw new Error(`Invalid level/tier segment: ${segment}`);
        target.tier = tierMatch[1] === "H" ? 1 : 0;
        return parseInt(tierMatch[2], 10);
      },
    },
    {
      key: "tier",
      mandatory: true,
      default: 0, // Main tier
      allowed: [0, 1],
      encode: (o) => o.tier,
      decode: (v, t) => {
        if (t.tier === undefined) t.tier = v as any;
      },
      format: () => "", // Handled by levelIdc
      parse: () => 0, // Handled by levelIdc
    },
    {
      key: "constraints",
      mandatory: true,
      // Default from RFC 7798 for interop-constraints: B00000000000
      default: 1970324836974592, // 0xB00000000000
      encode: (o) => o.constraints,
      decode: (v, t) => {
        t.constraints = v;
      },
      label: "Constraints",
      format: (v) => v.toString(16).toUpperCase().padStart(12, "0"),
      parse: (s) => parseInt(s, 16),
    },
  ],
};
