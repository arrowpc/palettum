#include "common.wgsl"

@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var tex  : texture_2d<f32>;
@group(0) @binding(2) var<uniform> config: Config;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let pixel = textureSample(tex, samp, uv);
    let pixel_lab = linear_rgb_to_lab(pixel.rgb);

    let weight_threshold = 1e-9;
    var total_weight = 0.0;
    var sum_l = 0.0;
    var sum_a = 0.0;
    var sum_b = 0.0;

    for (var i = 0u; i < config.palette_size; i = i + 1u) {
        let packed_palette_rgba = color_at(i);
        let palette_lab = rgba_to_lab(packed_palette_rgba);
        let distance = delta_e(pixel_lab, palette_lab, config.diff_formula);
        let weight = compute_weight(distance, config.smooth_formula, config.smooth_strength);

        if weight > weight_threshold {
            total_weight = total_weight + weight;
            sum_l = sum_l + weight * palette_lab.l;
            sum_a = sum_a + weight * palette_lab.a;
            sum_b = sum_b + weight * palette_lab.b;
        }
    }

    var avg_lab: Lab;
    let calculation_epsilon = 1e-9;
    if total_weight <= calculation_epsilon {
        avg_lab = pixel_lab;
    } else {
        avg_lab = Lab(
            clamp(sum_l / total_weight, 0.0, 100.0),
            clamp(sum_a / total_weight, -128.0, 127.0),
            clamp(sum_b / total_weight, -128.0, 127.0),
            0.0
        );
    }

    let rgb_srgb_normalized = lab_to_rgb(avg_lab);

    let final_rgb_linear = vec3<f32>(srgb_to_linear(rgb_srgb_normalized.r), srgb_to_linear(rgb_srgb_normalized.g), srgb_to_linear(rgb_srgb_normalized.b));

    return vec4<f32>(final_rgb_linear, pixel.a);
}

fn compute_weight(distance: f32, formula: u32, strength: f32) -> f32 {
    let epsilon = 1e-9;
    let normalized_strength = (strength - 0.1) / 0.9;

    if formula == 0u {
        // IDW
        let power_min = 5.0;
        let power_max = 1.0;
        let power = power_min * (1.0 - normalized_strength) + power_max * normalized_strength;
        return 1.0 / (pow(distance, power) + epsilon);
    } else if formula == 1u {
        // Gaussian
        let sigma_min = 10.0;
        let sigma_max = 50.0;
        let sigma = sigma_min * (1.0 - normalized_strength) + sigma_max * normalized_strength;

        if sigma < epsilon {
            return select(0.0, 1.0, distance < epsilon);
        }
        let sigma_sq_inv = 1.0 / (2.0 * sigma * sigma);
        let exponent = -distance * distance * sigma_sq_inv;
        return exp(max(exponent, -700.0));
    } else {
        // Rational Quadratic
        let alpha = 1.0;
        let length_scale_min = 1.0;
        let length_scale_max = 30.0;
        let length_scale = length_scale_min * (1.0 - normalized_strength) + length_scale_max * normalized_strength;

        if length_scale <= epsilon {
            return select(0.0, 1.0, distance < epsilon);
        }

        let denom_inv = 1.0 / (2.0 * alpha * length_scale * length_scale + epsilon);
        let term = distance * distance * denom_inv;
        return pow(1.0 + term, -alpha);
    }
}
