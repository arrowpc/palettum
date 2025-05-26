use image::Rgb;

use crate::color::Lab;
use crate::config::Config;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use tsify::Tsify;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(
    feature = "wasm",
    derive(Tsify, Serialize, Deserialize),
    tsify(type_prefix = "Smoothed")
)]
#[cfg_attr(feature = "cli", derive(clap::ValueEnum, strum_macros::Display))]
pub enum Formula {
    #[default]
    /// Inverse distance weighting
    Idw,
    Gaussian,
    /// Rational quadratic
    Rq,
}

fn compute_weight(distance: f32, config: &Config) -> f32 {
    const ANISOTROPIC_DIST_EPSILON: f32 = 1e-9;
    const NORMALIZED_STRENGTH_FACTOR: f32 = 1.0_f32 / 0.9_f32;

    let normalized_strength = (config.smoothing_strength - 0.1_f32) * NORMALIZED_STRENGTH_FACTOR;

    match config.smoothed_formula {
        Formula::Gaussian => {
            const SIGMA_AT_MIN_STRENGTH: f32 = 10_f32;
            const SIGMA_AT_MAX_STRENGTH: f32 = 50_f32;

            let sigma = SIGMA_AT_MIN_STRENGTH.mul_add(
                1.0_f32 - normalized_strength,
                SIGMA_AT_MAX_STRENGTH * normalized_strength,
            );

            if sigma < ANISOTROPIC_DIST_EPSILON {
                return if distance < ANISOTROPIC_DIST_EPSILON {
                    1.0_f32
                } else {
                    0.0_f32
                };
            }
            let sigma_sq_inv = 1.0_f32 / (2.0_f32 * sigma * sigma);
            let exponent = -distance * distance * sigma_sq_inv;
            exponent.max(-700.0_f32).exp()
        }
        Formula::Idw => {
            const POWER_AT_MIN_STRENGTH: f32 = 5_f32;
            const POWER_AT_MAX_STRENGTH: f32 = 1_f32;

            let power = POWER_AT_MIN_STRENGTH.mul_add(
                1.0_f32 - normalized_strength,
                POWER_AT_MAX_STRENGTH * normalized_strength,
            );
            1.0_f32 / (distance.powf(power) + ANISOTROPIC_DIST_EPSILON)
        }
        Formula::Rq => {
            const ALPHA_RQ: f32 = 1.0_f32;
            const LENGTH_SCALE_AT_MIN_STRENGTH: f32 = 1.0_f32;
            const LENGTH_SCALE_AT_MAX_STRENGTH: f32 = 30.0_f32;

            let length_scale = LENGTH_SCALE_AT_MIN_STRENGTH.mul_add(
                1.0_f32 - normalized_strength,
                LENGTH_SCALE_AT_MAX_STRENGTH * normalized_strength,
            );

            if length_scale <= ANISOTROPIC_DIST_EPSILON {
                return if distance < ANISOTROPIC_DIST_EPSILON {
                    1.0_f32
                } else {
                    0.0_f32
                };
            }

            let denominator_val_inv = 1.0_f32
                / (2.0_f32 * ALPHA_RQ * length_scale * length_scale + ANISOTROPIC_DIST_EPSILON);
            let term = distance * distance * denominator_val_inv;
            (1.0_f32 + term).powf(-ALPHA_RQ)
        }
    }
}

pub(crate) fn closest_rgb(reference: &Lab, colors: &[Lab], config: &Config) -> Rgb<u8> {
    const WEIGHT_THRESHOLD: f32 = 1e-9;
    let mut total_weight: f32 = 0.0;
    let mut sum_l: f32 = 0.0;
    let mut sum_a: f32 = 0.0;
    let mut sum_b: f32 = 0.0;
    let [scale_l, scale_a, scale_b] = config.lab_scales;

    for palette_lab_color in colors {
        let dl = reference.l - palette_lab_color.l;
        let da = reference.a - palette_lab_color.a;
        let db = reference.b - palette_lab_color.b;
        let anisotropic_dist_sq = (scale_l * dl * dl) + (scale_a * da * da) + (scale_b * db * db);
        let anisotropic_dist = anisotropic_dist_sq.sqrt();
        let weight = compute_weight(anisotropic_dist, config);

        if weight > WEIGHT_THRESHOLD {
            total_weight += weight;
            sum_l += weight * palette_lab_color.l;
            sum_a += weight * palette_lab_color.a;
            sum_b += weight * palette_lab_color.b;
        }
    }

    let l_avg = (sum_l / total_weight).clamp(0.0, 100.0);
    let a_avg = (sum_a / total_weight).clamp(-128.0, 127.0);
    let b_avg = (sum_b / total_weight).clamp(-128.0, 127.0);
    Lab {
        l: l_avg,
        a: a_avg,
        b: b_avg,
    }
    .to_rgb()
}
