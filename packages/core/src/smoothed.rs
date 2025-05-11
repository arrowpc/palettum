use image::Rgb;

use crate::color::Lab;
use crate::config::Config;

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum Formula {
    Idw,
    Gaussian,
}

fn compute_weight(distance: f32, config: &Config) -> f32 {
    const ANISOTROPIC_DIST_EPSILON: f32 = 1e-9;
    let strength = &config.smoothing_strength;

    match config.smoothed_formula {
        Formula::Gaussian => {
            let shape = (0.18 * strength + 0.01).max(ANISOTROPIC_DIST_EPSILON);

            let exponent = -(shape * distance).powi(2);
            exponent.max(-700.0).exp()
        }
        Formula::Idw => {
            let power = 6.0 * strength + 1.0;
            1.0 / (distance.powf(power) + ANISOTROPIC_DIST_EPSILON)
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

    for (i, palette_lab_color) in colors.iter().enumerate() {
        let dl = reference.l - palette_lab_color.l;
        let da = reference.a - palette_lab_color.a;
        let db = reference.b - palette_lab_color.b;
        let anisotropic_dist_sq = (scale_l * dl * dl).max(0.0)
            + (scale_a * da * da).max(0.0)
            + (scale_b * db * db).max(0.0);
        let anisotropic_dist = anisotropic_dist_sq.sqrt();
        let weight = compute_weight(anisotropic_dist, config);

        if weight > WEIGHT_THRESHOLD {
            total_weight += weight;
            if let Some(p_lab) = colors.get(i) {
                sum_l += weight * p_lab.l;
                sum_a += weight * p_lab.a;
                sum_b += weight * p_lab.b;
            }
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
