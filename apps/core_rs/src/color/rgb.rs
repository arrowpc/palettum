use super::lab::Lab;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RGBA {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl RGBA {
    pub fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        RGBA { r, g, b, a }
    }
}

impl Default for RGBA {
    fn default() -> Self {
        RGBA {
            r: 0,
            g: 0,
            b: 0,
            a: 255,
        }
    }
}

impl fmt::Display for RGBA {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "RGBA({}, {}, {}, {})", self.r, self.g, self.b, self.a)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RGB {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl RGB {
    // D65 standard illuminant white point reference values
    const WHITE_X: f32 = 95.047;
    const WHITE_Y: f32 = 100.000;
    const WHITE_Z: f32 = 108.883;

    const EPSILON: f32 = 0.008856;
    const KAPPA: f32 = 903.3;

    pub fn new(r: u8, g: u8, b: u8) -> Self {
        RGB { r, g, b }
    }

    fn pivot_xyz(n: f32) -> f32 {
        if n > Self::EPSILON {
            n.powf(1.0 / 3.0)
        } else {
            (Self::KAPPA * n + 16.0) / 116.0
        }
    }

    pub fn to_lab(&self) -> Lab {
        let mut fr = self.r as f32 / 255.0;
        let mut fg = self.g as f32 / 255.0;
        let mut fb = self.b as f32 / 255.0;

        fr = if fr > 0.04045 {
            ((fr + 0.055) / 1.055).powf(2.4)
        } else {
            fr / 12.92
        };
        fg = if fg > 0.04045 {
            ((fg + 0.055) / 1.055).powf(2.4)
        } else {
            fg / 12.92
        };
        fb = if fb > 0.04045 {
            ((fb + 0.055) / 1.055).powf(2.4)
        } else {
            fb / 12.92
        };

        let x = (fr * 0.4124564 + fg * 0.3575761 + fb * 0.1804375) * 100.0;
        let y = (fr * 0.2126729 + fg * 0.7151522 + fb * 0.0721750) * 100.0;
        let z = (fr * 0.0193339 + fg * 0.1191920 + fb * 0.9503041) * 100.0;

        let mut xr = x / Self::WHITE_X;
        let mut yr = y / Self::WHITE_Y;
        let mut zr = z / Self::WHITE_Z;

        xr = Self::pivot_xyz(xr);
        yr = Self::pivot_xyz(yr);
        zr = Self::pivot_xyz(zr);

        let l_star = (116.0 * yr - 16.0).max(0.0);
        let a_star = 500.0 * (xr - yr);
        let b_star = 200.0 * (yr - zr);

        Lab {
            l: l_star,
            a: a_star,
            b: b_star,
        }
    }
}

impl Default for RGB {
    fn default() -> Self {
        RGB { r: 0, g: 0, b: 0 }
    }
}

impl From<RGBA> for RGB {
    fn from(rgba: RGBA) -> Self {
        RGB {
            r: rgba.a,
            g: rgba.g,
            b: rgba.b,
        }
    }
}

impl fmt::Display for RGB {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "RGB({}, {}, {})", self.r, self.g, self.b)
    }
}
