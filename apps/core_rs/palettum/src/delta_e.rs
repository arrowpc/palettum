use crate::color::Lab;
use crate::config::DeltaEMethod;
use std::simd::f32x32;

const LANES: usize = 32;

// --- CIEDE2000 Constants ---
const KL: f32 = 1.0;
const KC: f32 = 1.0;
const KH: f32 = 1.0;
const POW25_7: f32 = 6103515625.0; // 25^7

mod simd_math {
    use std::f32;
    use std::f32::consts::PI;
    use std::simd::cmp::SimdPartialEq;
    use std::simd::cmp::SimdPartialOrd;
    use std::simd::num::SimdFloat;
    use std::simd::{f32x32, i32x32, u32x32, StdFloat};

    pub fn sin(x: f32x32) -> f32x32 {
        let inv_6 = f32x32::splat(0.16666667);
        let x2 = x * x;
        x * (f32x32::splat(1.0) - (x2 * inv_6))
    }

    pub fn cos(x: f32x32) -> f32x32 {
        let tp = f32x32::splat(1.0 / (2.0 * PI));
        let quarter = f32x32::splat(0.25);
        let sixteen = f32x32::splat(16.0);
        let half = f32x32::splat(0.5);

        let x = x * tp;
        let x_plus_quarter = x + quarter;
        let floor_val = x_plus_quarter.floor();
        let x = x - (quarter + floor_val);
        let abs_x = x.abs();
        let abs_x_minus_half = abs_x - half;
        let factor = sixteen * abs_x_minus_half;

        x * factor
    }

    pub fn exp(x: f32x32) -> f32x32 {
        use std::simd::num::SimdInt;
        const A_VAL: f32 = 12102203.0;
        const B_VAL: i32 = 1065054451;

        let a = f32x32::splat(A_VAL);
        let b = i32x32::splat(B_VAL);

        let mul_ax = a * x;

        let converted_int = unsafe { mul_ax.to_int_unchecked::<i32>() };

        let t_int = converted_int + b;

        f32x32::from_bits(t_int.cast::<u32>())
    }
    pub fn atan(x: f32x32) -> f32x32 {
        let pi_4 = f32x32::splat(PI / 4.0);
        let c1 = f32x32::splat(0.2447);
        let c2 = f32x32::splat(0.0663);
        let one = f32x32::splat(1.0);

        let abs_x = x.abs();
        let term1 = pi_4 * x;
        let term2 = abs_x - one;
        let term3 = c1 + c2 * abs_x;
        term1 - x * (term2 * term3)
    }

    pub fn atan2(y: f32x32, x: f32x32) -> f32x32 {
        let pi = f32x32::splat(PI);
        let pi_2 = f32x32::splat(PI / 2.0);
        let epsilon = f32x32::splat(1e-6);
        let zero = f32x32::splat(0.0);

        let abs_mask = u32x32::splat(0x7FFFFFFF);
        let sign_mask = u32x32::splat(0x80000000);

        let y_bits = y.to_bits();
        let x_bits = x.to_bits();
        let abs_y_bits = y_bits & abs_mask;
        let abs_x_bits = x_bits & abs_mask;
        let abs_y = f32x32::from_bits(abs_y_bits);
        let abs_x = f32x32::from_bits(abs_x_bits);

        let x_near_zero = abs_x.simd_lt(epsilon);
        let y_near_zero = abs_y.simd_lt(epsilon);

        let both_near_zero = x_near_zero & y_near_zero;
        let x_zero_mask = x_near_zero & !y_near_zero;

        let swap_mask = abs_y.simd_gt(abs_x);
        let num = swap_mask.select(x, y);
        let mut den = swap_mask.select(y, x);

        den = x_near_zero.select(den + epsilon, den);

        let den_is_zero = den.simd_eq(zero);
        den = den_is_zero.select(f32x32::splat(1.0), den);

        let atan_input = num / den;
        let mut result = atan(atan_input);

        let atan_input_bits = atan_input.to_bits();
        let pi_2_sign_bits = atan_input_bits & sign_mask;
        let pi_2_adj = f32x32::from_bits(pi_2.to_bits() | pi_2_sign_bits);
        let swap_result = pi_2_adj - result;
        result = swap_mask.select(swap_result, result);

        let y_sign_bits = y_bits & sign_mask;
        let y_is_neg = (y_sign_bits).simd_ne(u32x32::splat(0));
        let x_zero_result = y_is_neg.select(-pi_2, pi_2);
        result = x_zero_mask.select(x_zero_result, result);

        let x_neg_mask = x.simd_lt(zero);
        let pi_adj = f32x32::from_bits(pi.to_bits() ^ y_sign_bits);
        let quad_adj = x_neg_mask.select(pi_adj, zero);
        result += quad_adj;

        result = both_near_zero.select(zero, result);

        result
    }

    pub fn pow7(x: f32x32) -> f32x32 {
        let x2 = x * x;
        let x32 = x2 * x2;
        x * x2 * x32 // x^1 * x^2 * x^4 = x^7
    }
}

pub fn calculate_ciede2000_simd(reference: &Lab, colors: &[Lab], results: &mut [f32]) {
    use std::f32::consts::PI;
    use std::simd::cmp::SimdPartialOrd;
    use std::simd::num::SimdFloat;
    use std::simd::StdFloat;
    let chunks = colors.len().div_ceil(LANES);

    for chunk_idx in 0..chunks {
        let offset = chunk_idx * LANES;
        let items_in_chunk = std::cmp::min(LANES, colors.len() - offset);

        let mut l2_a = [0.0f32; LANES];
        let mut a2_a = [0.0f32; LANES];
        let mut b2_a = [0.0f32; LANES];

        for i in 0..LANES {
            let idx = offset + i;
            if i < items_in_chunk {
                l2_a[i] = colors[idx].l;
                a2_a[i] = colors[idx].a;
                b2_a[i] = colors[idx].b;
            } else {
                let last_idx = offset + items_in_chunk - 1;
                l2_a[i] = colors[last_idx].l;
                a2_a[i] = colors[last_idx].a;
                b2_a[i] = colors[last_idx].b;
            }
        }

        let ref_l = f32x32::splat(reference.l);
        let ref_a = f32x32::splat(reference.a);
        let ref_b = f32x32::splat(reference.b);
        let comp_l = f32x32::from_array(l2_a);
        let comp_a = f32x32::from_array(a2_a);
        let comp_b = f32x32::from_array(b2_a);

        let l_bar_prime = (ref_l + comp_l) * f32x32::splat(0.5);

        let c1 = (ref_a * ref_a + ref_b * ref_b).sqrt();
        let c2 = (comp_a * comp_a + comp_b * comp_b).sqrt();

        let c_bar = (c1 + c2) * f32x32::splat(0.5);

        let c_bar_7 = simd_math::pow7(c_bar);

        let pow25_7 = f32x32::splat(POW25_7);
        let frac = c_bar_7 / (c_bar_7 + pow25_7);
        let sqrt_frac = frac.sqrt();
        let g_plus_one = f32x32::splat(1.5) - sqrt_frac * f32x32::splat(0.5);

        let a1_prime = ref_a * g_plus_one;
        let a2_prime = comp_a * g_plus_one;

        let c1_prime = (a1_prime * a1_prime + ref_b * ref_b).sqrt();
        let c2_prime = (a2_prime * a2_prime + comp_b * comp_b).sqrt();

        let deg_factor = f32x32::splat(180.0 / PI);
        let two_pi = f32x32::splat(2.0 * PI);

        let angle_h1 = simd_math::atan2(ref_b, a1_prime);
        let h1_prime = (angle_h1 + two_pi) * deg_factor;

        let angle_h2 = simd_math::atan2(comp_b, a2_prime);
        let h2_prime = (angle_h2 + two_pi) * deg_factor;

        let delta_l_prime = comp_l - ref_l;
        let delta_c_prime = c2_prime - c1_prime;

        let delta_h = h2_prime - h1_prime;

        let abs_delta = delta_h.abs();

        let adjust_needed = abs_delta.simd_gt(f32x32::splat(180.0));

        let sign_mask = h2_prime.simd_le(h1_prime);
        let sign = sign_mask.select(f32x32::splat(1.0), f32x32::splat(-1.0));

        let offset_2 = sign * f32x32::splat(360.0);

        let offset_2 = adjust_needed.select(offset_2, f32x32::splat(0.0));

        let delta_h_prime = delta_h + offset_2;

        let scale = f32x32::splat(PI / 360.0);
        let angle = delta_h_prime * scale;

        let sin_angle = simd_math::sin(angle);

        let prod_c1c2 = c1_prime * c2_prime;
        let sqrt_c1c2 = prod_c1c2.sqrt();
        let delta_h_prime_big = f32x32::splat(2.0) * sqrt_c1c2 * sin_angle;

        let c_bar_prime = (c1_prime + c2_prime) * f32x32::splat(0.5);

        let diff = l_bar_prime - f32x32::splat(50.0);
        let diff_sq = diff * diff;

        let numerator = diff_sq * f32x32::splat(0.015);
        let denom_val = f32x32::splat(20.0) + diff_sq;
        let sqrt_denominator = denom_val.sqrt();
        let fraction = numerator / sqrt_denominator;
        let s_l = f32x32::splat(1.0) + fraction;

        let s_c = f32x32::splat(1.0) + c_bar_prime * f32x32::splat(0.045);

        let sum = h1_prime + h2_prime;
        let diff = h1_prime - h2_prime;
        let abs_diff = diff.abs();

        let cond1 = abs_diff.simd_le(f32x32::splat(180.0));

        let cond2 = sum.simd_lt(f32x32::splat(360.0));

        let offset_for_not_cond1 = cond2.select(f32x32::splat(360.0), f32x32::splat(-360.0));
        let hbar_offset = cond1.select(f32x32::splat(0.0), offset_for_not_cond1);

        let h_bar_prime = (sum + hbar_offset) * f32x32::splat(0.5);

        let rad_factor = f32x32::splat(PI / 180.0);
        let rad1 = (h_bar_prime - f32x32::splat(30.0)) * rad_factor;
        let rad2 = (h_bar_prime * f32x32::splat(2.0)) * rad_factor;
        let rad3 = (h_bar_prime * f32x32::splat(3.0) + f32x32::splat(6.0)) * rad_factor;
        let rad4 = (h_bar_prime * f32x32::splat(4.0) - f32x32::splat(63.0)) * rad_factor;

        let cos1 = simd_math::cos(rad1);
        let cos2 = simd_math::cos(rad2);
        let cos3 = simd_math::cos(rad3);
        let cos4 = simd_math::cos(rad4);

        let t = f32x32::splat(1.0);
        let t = t - f32x32::splat(0.17) * cos1;
        let t = t + f32x32::splat(0.24) * cos2;
        let t = t + f32x32::splat(0.32) * cos3;
        let t = t - f32x32::splat(0.20) * cos4;

        let s_h = f32x32::splat(1.0) + c_bar_prime * t * f32x32::splat(0.015);

        let c_bar_prime7 = simd_math::pow7(c_bar_prime);
        let denom_rt = c_bar_prime7 + f32x32::splat(POW25_7);
        let rt_sqrt = (c_bar_prime7 / denom_rt).sqrt();

        let h_diff = h_bar_prime - f32x32::splat(275.0);
        let h_scaled = h_diff * f32x32::splat(1.0 / 25.0);
        let h_squared = h_scaled * h_scaled;
        let neg_h_squared = -h_squared;
        let exp_result = simd_math::exp(neg_h_squared);

        let angle = exp_result * f32x32::splat(60.0) * f32x32::splat(PI / 180.0);
        let sin_result = simd_math::sin(angle);

        let r_t = rt_sqrt * sin_result * f32x32::splat(-2.0);

        let lightness = delta_l_prime / s_l;
        let chroma = delta_c_prime / s_c;
        let hue = delta_h_prime_big / s_h;

        let lightness_sq = lightness * lightness;
        let chroma_sq = chroma * chroma;
        let hue_sq = hue * hue;

        let rt_term = r_t * chroma * hue;

        let sum = lightness_sq + chroma_sq + hue_sq + rt_term;

        let result = sum.sqrt();

        let result_array = result.to_array();
        results[offset..(items_in_chunk + offset)].copy_from_slice(&result_array[..items_in_chunk]);
    }
}

pub(crate) fn delta_e_batch(
    method: DeltaEMethod,
    target_lab: &Lab,
    lab_palette: &[Lab],
) -> Vec<f32> {
    if lab_palette.is_empty() {
        return Vec::new();
    }

    match method {
        DeltaEMethod::CIEDE2000 => {
            let mut results = vec![0.0; lab_palette.len()];
            calculate_ciede2000_simd(target_lab, lab_palette, &mut results);
            results
        }
        _ => {
            // Other methods (using scalar implementation for now)
            lab_palette
                .iter()
                .map(|palette_color| calculate_delta_e(method, target_lab, palette_color))
                .collect()
        }
    }
}

// pub(crate) fn delta_e_batch(method: DeltaEMethod, target_lab: &Lab, lab_palette: &[Lab]) -> Vec<f32> {
//     lab_palette
//         .iter()
//         .map(|palette_color| calculate_delta_e(method, target_lab, palette_color))
//         .collect()
// }

pub(crate) fn calculate_delta_e(method: DeltaEMethod, color1: &Lab, color2: &Lab) -> f32 {
    match method {
        DeltaEMethod::CIEDE2000 => calculate_ciede2000(color1, color2),
        DeltaEMethod::CIE94 => calculate_cie94(color1, color2),
        DeltaEMethod::CIE76 => calculate_cie76(color1, color2),
    }
}

fn calculate_ciede2000(color1: &Lab, color2: &Lab) -> f32 {
    let l1 = color1.l;
    let a1 = color1.a;
    let b1 = color1.b;
    let l2 = color2.l;
    let a2 = color2.a;
    let b2 = color2.b;

    let c1 = (a1.powi(2) + b1.powi(2)).sqrt();
    let c2 = (a2.powi(2) + b2.powi(2)).sqrt();

    let c_bar = (c1 + c2) * 0.5;
    let c_bar7 = c_bar.powi(7);

    let g = 0.5 * (1.0 - (c_bar7 / (c_bar7 + POW25_7)).sqrt());

    let a1_prime = a1 * (1.0 + g);
    let a2_prime = a2 * (1.0 + g);

    let c1_prime = (a1_prime.powi(2) + b1.powi(2)).sqrt();
    let c2_prime = (a2_prime.powi(2) + b2.powi(2)).sqrt();

    let h1_prime_rad = b1.atan2(a1_prime);
    let mut h1_prime = h1_prime_rad.to_degrees();
    if h1_prime < 0.0 {
        h1_prime += 360.0;
    }

    let h2_prime_rad = b2.atan2(a2_prime);
    let mut h2_prime = h2_prime_rad.to_degrees();
    if h2_prime < 0.0 {
        h2_prime += 360.0;
    }

    let delta_l_prime = l2 - l1;
    let delta_c_prime = c2_prime - c1_prime;

    let delta_h_prime_lower = {
        if c1_prime == 0.0 || c2_prime == 0.0 {
            0.0
        } else {
            let diff = h2_prime - h1_prime;
            if diff.abs() <= 180.0 {
                diff
            } else if diff > 180.0 {
                diff - 360.0
            } else {
                diff + 360.0
            }
        }
    };

    let delta_h_prime_upper =
        2.0 * (c1_prime * c2_prime).sqrt() * (delta_h_prime_lower.to_radians() * 0.5).sin();

    let l_bar_prime = (l1 + l2) * 0.5;
    let c_bar_prime = (c1_prime + c2_prime) * 0.5;

    let h_bar_prime = {
        if c1_prime == 0.0 || c2_prime == 0.0 {
            h1_prime + h2_prime
        } else {
            let diff = (h1_prime - h2_prime).abs();
            let sum = h1_prime + h2_prime;
            if diff <= 180.0 {
                sum * 0.5
            } else if sum < 360.0 {
                (sum + 360.0) * 0.5
            } else {
                (sum - 360.0) * 0.5
            }
        }
    };

    let t = 1.0 - 0.17 * (h_bar_prime - 30.0).to_radians().cos()
        + 0.24 * (2.0 * h_bar_prime).to_radians().cos()
        + 0.32 * (3.0 * h_bar_prime + 6.0).to_radians().cos()
        - 0.20 * (4.0 * h_bar_prime - 63.0).to_radians().cos();

    let delta_theta = (30.0 * (-((h_bar_prime - 275.0) / 25.0).powi(2))).exp();
    let c_bar_prime7 = c_bar_prime.powi(7);

    let rc = 2.0 * (c_bar_prime7 / (c_bar_prime7 + POW25_7)).sqrt();
    let rt = -rc * (delta_theta.to_radians() * 2.0).sin();

    let l_bar_prime_minus_50_sq = (l_bar_prime - 50.0).powi(2);
    let sl = 1.0 + (0.015 * l_bar_prime_minus_50_sq) / (20.0 + l_bar_prime_minus_50_sq).sqrt();
    let sc = 1.0 + 0.045 * c_bar_prime;
    let sh = 1.0 + 0.015 * c_bar_prime * t;

    let term1 = delta_l_prime / (KL * sl);
    let term2 = delta_c_prime / (KC * sc);
    let term3 = delta_h_prime_upper / (KH * sh);

    (term1.powi(2) + term2.powi(2) + term3.powi(2) + rt * term2 * term3).sqrt()
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
