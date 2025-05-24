use image::{Rgb, Rgba};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Lab {
    pub l: f32,
    pub a: f32,
    pub b: f32,
}

pub trait ConvertToLab {
    fn to_lab(&self) -> Lab;
}

// --- Constants for XYZ/Lab Conversion ---
const WHITE_X: f32 = 95.047;
const WHITE_Y: f32 = 100.000;
const WHITE_Z: f32 = 108.883;
const EPSILON: f32 = 0.008856;
const KAPPA: f32 = 903.3;

impl Lab {
    pub fn to_rgb(self) -> Rgb<u8> {
        let y = (self.l + 16.0) / 116.0;
        let x = self.a / 500.0 + y;
        let z = y - self.b / 200.0;

        let x3 = x * x * x;
        let z3 = z * z * z;

        let mut xyz_x = WHITE_X
            * if x3 > EPSILON {
                x3
            } else {
                (x - 16.0 / 116.0) / 7.787
            };
        let mut xyz_y = WHITE_Y
            * if self.l > (KAPPA * EPSILON) {
                ((self.l + 16.0) / 116.0).powf(3.0)
            } else {
                self.l / KAPPA
            };
        let mut xyz_z = WHITE_Z
            * if z3 > EPSILON {
                z3
            } else {
                (z - 16.0 / 116.0) / 7.787
            };

        xyz_x /= 100.0;
        xyz_y /= 100.0;
        xyz_z /= 100.0;

        let mut r = xyz_x * 3.2404542 - xyz_y * 1.5371385 - xyz_z * 0.4985314;
        let mut g = xyz_x * -0.969266 + xyz_y * 1.8760108 + xyz_z * 0.0415560;
        let mut b = xyz_x * 0.0556434 - xyz_y * 0.2040259 + xyz_z * 1.0572252;

        r = if r > 0.0031308 {
            1.055 * r.powf(1.0 / 2.4) - 0.055
        } else {
            12.92 * r
        };
        g = if g > 0.0031308 {
            1.055 * g.powf(1.0 / 2.4) - 0.055
        } else {
            12.92 * g
        };
        b = if b > 0.0031308 {
            1.055 * b.powf(1.0 / 2.4) - 0.055
        } else {
            12.92 * b
        };

        r = r.clamp(0.0, 1.0) * 255.0;
        g = g.clamp(0.0, 1.0) * 255.0;
        b = b.clamp(0.0, 1.0) * 255.0;

        Rgb([r.round() as u8, g.round() as u8, b.round() as u8])
    }
}

#[inline]
fn pivot_xyz(n: f32) -> f32 {
    if n > EPSILON {
        n.cbrt()
    } else {
        (KAPPA * n + 16.0) / 116.0
    }
}

impl ConvertToLab for Rgb<u8> {
    fn to_lab(&self) -> Lab {
        Rgba([self.0[0], self.0[1], self.0[2], 255]).to_lab()
    }
}

impl ConvertToLab for Rgba<u8> {
    fn to_lab(&self) -> Lab {
        let r_u8 = self.0[0];
        let g_u8 = self.0[1];
        let b_u8 = self.0[2];

        // Basic sRGB to Linear RGB (gamma ~2.2)
        let r_lin = (r_u8 as f32 / 255.0).powf(2.2);
        let g_lin = (g_u8 as f32 / 255.0).powf(2.2);
        let b_lin = (b_u8 as f32 / 255.0).powf(2.2);

        // Linear RGB to XYZ (D65 illuminant)
        let x = (r_lin * 0.4124564 + g_lin * 0.3575761 + b_lin * 0.1804375) * 100.0;
        let y = (r_lin * 0.2126729 + g_lin * 0.7151522 + b_lin * 0.0721750) * 100.0;
        let z = (r_lin * 0.0193339 + g_lin * 0.119_192 + b_lin * 0.9503041) * 100.0;

        // XYZ to Lab
        let xr = x / WHITE_X;
        let yr = y / WHITE_Y;
        let zr = z / WHITE_Z;

        let fx = pivot_xyz(xr);
        let fy = pivot_xyz(yr);
        let fz = pivot_xyz(zr);

        let l_star = (116.0 * fy - 16.0).max(0.0);
        let a_star = 500.0 * (fx - fy);
        let b_star = 200.0 * (fy - fz);

        Lab {
            l: l_star,
            a: a_star,
            b: b_star,
        }
    }
}

// --- Helper module for Vec<Rgb<u8>> serialization ---
#[cfg(feature = "wasm")]
pub mod rgb_vec_serde {
    use image::Rgb as imageRgb;
    use serde::{ser::SerializeSeq, Deserialize, Deserializer, Serialize, Serializer};
    use tsify::Tsify;

    #[cfg_attr(feature = "wasm", derive(Tsify, Serialize, Deserialize))]
    #[cfg_attr(feature = "wasm", tsify(from_wasm_abi, into_wasm_abi))]
    #[cfg_attr(feature = "wasm", serde(rename_all = "camelCase"))]
    pub struct Rgb {
        pub r: u8,
        pub g: u8,
        pub b: u8,
    }

    pub fn serialize<S>(vec: &Vec<imageRgb<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(Some(vec.len()))?;
        for rgb in vec {
            let helper = Rgb {
                r: rgb.0[0],
                g: rgb.0[1],
                b: rgb.0[2],
            };
            seq.serialize_element(&helper)?;
        }
        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<imageRgb<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let helpers = Vec::<Rgb>::deserialize(deserializer)?;
        let result = helpers
            .into_iter()
            .map(|helper| imageRgb([helper.r, helper.g, helper.b]))
            .collect();
        Ok(result)
    }
}
