use crate::{color::Lab, config::Config, math::FastMath};
use image::Rgb;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(
    feature = "wasm",
    derive(Tsify, Serialize, Deserialize),
    tsify(type_prefix = "Palettized")
)]
#[cfg_attr(feature = "cli", derive(clap::ValueEnum, strum_macros::Display))]
pub enum Formula {
    CIE76,
    CIE94,
    #[default]
    CIEDE2000,
}

pub(crate) fn closest_rgb(reference: &Lab, colors: &[Lab], config: &Config) -> Rgb<u8> {
    let index = delta_e_batch(config.palettized_formula, reference, colors)
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(index, _)| index)
        .unwrap();

    config.palette.colors[index]
}

fn calculate_delta_e(method: Formula, color1: &Lab, color2: &Lab) -> f32 {
    match method {
        Formula::CIEDE2000 => calculate_ciede2000(color1, color2),
        Formula::CIE94 => calculate_cie94(color1, color2),
        Formula::CIE76 => calculate_cie76(color1, color2),
    }
}

pub(crate) fn delta_e_batch(method: Formula, reference: &Lab, colors: &[Lab]) -> Vec<f32> {
    colors
        .iter()
        .map(|palette_color| calculate_delta_e(method, reference, palette_color))
        .collect()
}

pub fn calculate_ciede2000(reference: &Lab, color: &Lab) -> f32 {
    const PI: f32 = std::f32::consts::PI;
    const POW25_7: f32 = 6103515625.0;

    // Extract color components
    let ref_l = reference.l;
    let ref_a = reference.a;
    let ref_b = reference.b;
    let comp_l = color.l;
    let comp_a = color.a;
    let comp_b = color.b;

    let l_bar_prime = (ref_l + comp_l) * 0.5;

    let c1 = (ref_a * ref_a + ref_b * ref_b).sqrt();
    let c2 = (comp_a * comp_a + comp_b * comp_b).sqrt();

    let c_bar = (c1 + c2) * 0.5;

    let c_bar_7 = c_bar.pow7_fast();

    let frac = c_bar_7 / (c_bar_7 + POW25_7);
    let sqrt_frac = frac.sqrt();
    let g_plus_one = 1.5 - sqrt_frac * 0.5;

    let a1_prime = ref_a * g_plus_one;
    let a2_prime = comp_a * g_plus_one;

    let c1_prime = (a1_prime * a1_prime + ref_b * ref_b).sqrt();
    let c2_prime = (a2_prime * a2_prime + comp_b * comp_b).sqrt();

    let deg_factor = 180.0 / PI;
    let two_pi = 2.0 * PI;

    let angle_h1 = ref_b.atan2_fast(a1_prime);
    let h1_prime = (angle_h1 + two_pi) * deg_factor;

    let angle_h2 = comp_b.atan2_fast(a2_prime);
    let h2_prime = (angle_h2 + two_pi) * deg_factor;

    let delta_l_prime = comp_l - ref_l;
    let delta_c_prime = c2_prime - c1_prime;

    let delta_h = h2_prime - h1_prime;

    let abs_delta = delta_h.abs();

    let adjust_needed = abs_delta > 180.0;

    let sign = if h2_prime <= h1_prime { 1.0 } else { -1.0 };

    let offset_2 = sign * 360.0;

    let offset_2 = if adjust_needed { offset_2 } else { 0.0 };

    let delta_h_prime = delta_h + offset_2;

    let scale = PI / 360.0;
    let angle = delta_h_prime * scale;

    let sin_angle = angle.sin_fast();

    let prod_c1c2 = c1_prime * c2_prime;
    let sqrt_c1c2 = prod_c1c2.sqrt();
    let delta_h_prime_big = 2.0 * sqrt_c1c2 * sin_angle;

    let c_bar_prime = (c1_prime + c2_prime) * 0.5;

    let diff = l_bar_prime - 50.0;
    let diff_sq = diff * diff;

    let numerator = diff_sq * 0.015;
    let denom_val = 20.0 + diff_sq;
    let sqrt_denominator = denom_val.sqrt();
    let fraction = numerator / sqrt_denominator;
    let s_l = 1.0 + fraction;

    let s_c = 1.0 + c_bar_prime * 0.045;

    let sum = h1_prime + h2_prime;
    let diff = h1_prime - h2_prime;
    let abs_diff = diff.abs();

    let cond1 = abs_diff <= 180.0;

    let cond2 = sum < 360.0;

    let offset_for_not_cond1 = if cond2 { 360.0 } else { -360.0 };
    let hbar_offset = if cond1 { 0.0 } else { offset_for_not_cond1 };

    let h_bar_prime = (sum + hbar_offset) * 0.5;

    let rad_factor = PI / 180.0;
    let rad1 = (h_bar_prime - 30.0) * rad_factor;
    let rad2 = (h_bar_prime * 2.0) * rad_factor;
    let rad3 = (h_bar_prime * 3.0 + 6.0) * rad_factor;
    let rad4 = (h_bar_prime * 4.0 - 63.0) * rad_factor;

    let cos1 = rad1.cos_fast();
    let cos2 = rad2.cos_fast();
    let cos3 = rad3.cos_fast();
    let cos4 = rad4.cos_fast();

    let mut t = 1.0;
    t -= 0.17 * cos1;
    t += 0.24 * cos2;
    t += 0.32 * cos3;
    t -= 0.20 * cos4;

    let s_h = 1.0 + c_bar_prime * t * 0.015;

    let c_bar_prime7 = c_bar_prime.pow7_fast();
    let denom_rt = c_bar_prime7 + POW25_7;
    let rt_sqrt = (c_bar_prime7 / denom_rt).sqrt();

    let h_diff = h_bar_prime - 275.0;
    let h_scaled = h_diff * (1.0 / 25.0);
    let h_squared = h_scaled * h_scaled;
    let neg_h_squared = -h_squared;
    let exp_result = neg_h_squared.exp_fast();

    let angle = exp_result * 60.0 * (PI / 180.0);
    let sin_result = angle.sin_fast();

    let r_t = rt_sqrt * sin_result * -2.0;

    let lightness = delta_l_prime / s_l;
    let chroma = delta_c_prime / s_c;
    let hue = delta_h_prime_big / s_h;

    let lightness_sq = lightness * lightness;
    let chroma_sq = chroma * chroma;
    let hue_sq = hue * hue;

    let rt_term = r_t * chroma * hue;

    let sum = lightness_sq + chroma_sq + hue_sq + rt_term;

    sum.sqrt()
}

fn calculate_cie94(color1: &Lab, color2: &Lab) -> f32 {
    // These constants are actually adjustable variables in the main formula
    // https://en.wikipedia.org/wiki/Color_difference#CIE94
    let k1: f32 = 0.045;
    let k2: f32 = 0.015;
    let kl: f32 = 1.0;

    let delta_l: f32 = color1.l - color2.l;

    let c1: f32 = (color1.a * color1.a + color1.b * color1.b).sqrt();
    let c2: f32 = (color2.a * color2.a + color2.b * color2.b).sqrt();

    let delta_c: f32 = c1 - c2;

    let delta_a: f32 = color1.a - color2.a;
    let delta_b: f32 = color1.b - color2.b;

    let delta_h_sq: f32 = delta_a * delta_a + delta_b * delta_b - delta_c * delta_c;
    let delta_h: f32 = if delta_h_sq > 0.0 {
        delta_h_sq.sqrt()
    } else {
        0.0
    };

    let s_l: f32 = 1.0;
    let s_c: f32 = 1.0 + k1 * c1;
    let s_h: f32 = 1.0 + k2 * c1;

    let term_l: f32 = delta_l / (kl * s_l);
    let term_c: f32 = delta_c / s_c;
    let term_h: f32 = delta_h / s_h;

    (term_l * term_l + term_c * term_c + term_h * term_h).sqrt()
}

fn calculate_cie76(color1: &Lab, color2: &Lab) -> f32 {
    let dl = color1.l - color2.l;
    let da = color1.a - color2.a;
    let db = color1.b - color2.b;
    (dl * dl + da * da + db * db).sqrt()
}
