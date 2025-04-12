use crate::color::Lab;
use crate::config::DeltaEMethod;

// --- CIEDE2000 Constants ---
const KL: f32 = 1.0;
const KC: f32 = 1.0;
const KH: f32 = 1.0;
const POW25_7: f32 = 6103515625.0; // 25^7

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
