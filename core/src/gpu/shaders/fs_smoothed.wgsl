struct Lab {
    l: f32,
    a: f32,
    b: f32,
    padding: f32,
};

struct Config {
    transparency_threshold: u32,
    diff_formula: u32,
    smooth_formula: u32,
    palette_size: u32,
palette: array<vec4<u32>, 64>,
    smooth_strength: f32,
    dither_algorithm: u32,
    dither_strength: f32,
    image_width: u32,
    image_height: u32,
};

struct FragmentInput {
    @location(0) tex_coord: vec2<f32>,
};

@group(0) @binding(0) var t_input: texture_2d<f32>;
@group(0) @binding(1) var s_input: sampler;
@group(0) @binding(2) var<uniform> config: Config;

@fragment
fn fs_smoothed(in: FragmentInput) -> @location(0) vec4<f32> {
    // Compute pixel coordinates
    let x = u32(clamp(in.tex_coord.x, 0.0, 1.0) * f32(config.image_width));
    let y = u32(clamp(in.tex_coord.y, 0.0, 1.0) * f32(config.image_height));
    if x >= config.image_width || y >= config.image_height {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }
    let index = y * config.image_width + x;

    // Sample input texture and pack to u32
    let pixel = textureSample(t_input, s_input, in.tex_coord);
    let packed_pixel_rgba = pack_rgba8(pixel);
    let alpha_u8 = (packed_pixel_rgba >> 24u) & 0xFFu;

    let pixel_lab = rgba_to_lab(packed_pixel_rgba);

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

    // Output as normalized color, preserve original alpha
    return vec4<f32>(rgb_srgb_normalized, pixel.a);
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

fn delta_e(lab1: Lab, lab2: Lab, formula: u32) -> f32 {
    if formula == 0u { // CIE76
        return cie76(lab1, lab2);
    } else if formula == 1u { // CIE94
        return cie94(lab1, lab2);
    } else {
        return ciede2000(lab1, lab2);
    }
}

fn cie76(lab1: Lab, lab2: Lab) -> f32 {
    let dl: f32 = lab1.l - lab2.l;
    let da: f32 = lab1.a - lab2.a;
    let db: f32 = lab1.b - lab2.b;
    return sqrt(dl * dl + da * da + db * db);
}

fn cie94(lab1: Lab, lab2: Lab) -> f32 {
    let kL: f32 = 1.0;
    let k1: f32 = 0.045;
    let k2: f32 = 0.015;

    let delta_l: f32 = lab1.l - lab2.l;

    let c1: f32 = sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
    let c2: f32 = sqrt(lab2.a * lab2.a + lab2.b * lab2.b);

    let delta_c: f32 = c1 - c2;

    let delta_a: f32 = lab1.a - lab2.a;
    let delta_b: f32 = lab1.b - lab2.b;

    let delta_h_sq: f32 = delta_a * delta_a + delta_b * delta_b - delta_c * delta_c;
    let delta_h: f32 = select(0.0, sqrt(delta_h_sq), delta_h_sq > 0.0);

    let sL: f32 = 1.0;
    let sC: f32 = 1.0 + k1 * c1;
    let sH: f32 = 1.0 + k2 * c1;

    let term_L: f32 = delta_l / (kL * sL);
    let term_C: f32 = delta_c / sC;
    let term_H: f32 = delta_h / sH;

    return sqrt(term_L * term_L + term_C * term_C + term_H * term_H);
}

// Constants for CIEDE2000
const PI_MATH: f32 = 3.141592653589793;
const POW25_7: f32 = 6103515625.0; // 25^7

fn ciede2000(lab1_in: Lab, lab2_in: Lab) -> f32 {
    let ref_l: f32 = lab1_in.l;
    let ref_a: f32 = lab1_in.a;
    let ref_b: f32 = lab1_in.b;
    let comp_l: f32 = lab2_in.l;
    let comp_a: f32 = lab2_in.a;
    let comp_b: f32 = lab2_in.b;

    let l_bar_prime: f32 = (ref_l + comp_l) * 0.5;

    let c1_std: f32 = sqrt(ref_a * ref_a + ref_b * ref_b);
    let c2_std: f32 = sqrt(comp_a * comp_a + comp_b * comp_b);

    let c_bar_std: f32 = (c1_std + c2_std) * 0.5;

    let c_bar_std_pow7: f32 = pow(c_bar_std, 7.0);
    let G_val_term: f32 = c_bar_std_pow7 / (c_bar_std_pow7 + POW25_7);
    let G_val: f32 = 0.5 * (1.0 - sqrt(G_val_term));

    let a1_prime: f32 = ref_a * (1.0 + G_val);
    let a2_prime: f32 = comp_a * (1.0 + G_val);

    let c1_prime: f32 = sqrt(a1_prime * a1_prime + ref_b * ref_b);
    let c2_prime: f32 = sqrt(a2_prime * a2_prime + comp_b * comp_b);

    var h1_prime_deg: f32 = 0.0;
    if c1_prime != 0.0 {
        h1_prime_deg = atan2(ref_b, a1_prime) * (180.0 / PI_MATH);
        if h1_prime_deg < 0.0 {
            h1_prime_deg = h1_prime_deg + 360.0;
        }
    }

    var h2_prime_deg: f32 = 0.0;
    if c2_prime != 0.0 {
        h2_prime_deg = atan2(comp_b, a2_prime) * (180.0 / PI_MATH);
        if h2_prime_deg < 0.0 {
            h2_prime_deg = h2_prime_deg + 360.0;
        }
    }

    let delta_l_prime: f32 = comp_l - ref_l;
    let delta_c_prime: f32 = c2_prime - c1_prime;

    var actual_delta_h_prime_degrees: f32;
    if c1_prime == 0.0 || c2_prime == 0.0 {
        actual_delta_h_prime_degrees = 0.0;
    } else {
        let h_diff: f32 = h2_prime_deg - h1_prime_deg;
        let abs_h_diff: f32 = abs(h_diff);
        if abs_h_diff <= 180.0 {
            actual_delta_h_prime_degrees = h_diff;
        } else {
            let sign_val = select(-1.0, 1.0, h2_prime_deg <= h1_prime_deg);
            actual_delta_h_prime_degrees = h_diff + sign_val * 360.0;
        }
    }

    let delta_H_prime_big: f32 = 2.0 * sqrt(c1_prime * c2_prime) * sin((actual_delta_h_prime_degrees * PI_MATH / 180.0) / 2.0);

    let l_bar_prime_minus_50: f32 = l_bar_prime - 50.0;
    let l_bar_prime_minus_50_sq: f32 = l_bar_prime_minus_50 * l_bar_prime_minus_50;
    let s_l: f32 = 1.0 + (0.015 * l_bar_prime_minus_50_sq) / sqrt(20.0 + l_bar_prime_minus_50_sq);

    let c_bar_prime: f32 = (c1_prime + c2_prime) * 0.5;
    let s_c: f32 = 1.0 + 0.045 * c_bar_prime;

    var H_bar_prime_deg: f32;
    if c1_prime == 0.0 || c2_prime == 0.0 {
        H_bar_prime_deg = h1_prime_deg + h2_prime_deg;
    } else {
        let sum_h_primes_deg = h1_prime_deg + h2_prime_deg;
        let abs_diff_h_primes_deg = abs(h1_prime_deg - h2_prime_deg);

        if abs_diff_h_primes_deg <= 180.0 {
            H_bar_prime_deg = sum_h_primes_deg / 2.0;
        } else {
            let offset_hbar = select(-360.0, 360.0, sum_h_primes_deg < 360.0);
            H_bar_prime_deg = (sum_h_primes_deg + offset_hbar) / 2.0;
        }
    }

    var t_val: f32 = 1.0;
    t_val = t_val - 0.17 * cos((H_bar_prime_deg - 30.0) * PI_MATH / 180.0);
    t_val = t_val + 0.24 * cos((2.0 * H_bar_prime_deg) * PI_MATH / 180.0);
    t_val = t_val + 0.32 * cos((3.0 * H_bar_prime_deg + 6.0) * PI_MATH / 180.0);
    t_val = t_val - 0.20 * cos((4.0 * H_bar_prime_deg - 63.0) * PI_MATH / 180.0);

    let s_h: f32 = 1.0 + 0.015 * c_bar_prime * t_val;

    let c_bar_prime_pow7: f32 = pow(c_bar_prime, 7.0);
    let R_C_term_sqrt: f32 = sqrt(c_bar_prime_pow7 / (c_bar_prime_pow7 + POW25_7));

    let h_bar_prime_deg_norm_exp: f32 = (H_bar_prime_deg - 275.0) / 25.0;
    let exp_term_for_rot: f32 = exp(-(h_bar_prime_deg_norm_exp * h_bar_prime_deg_norm_exp));

    let angle_for_sin_rot: f32 = exp_term_for_rot * (60.0 * PI_MATH / 180.0);
    let sin_angle_rot: f32 = sin(angle_for_sin_rot);

    let r_t: f32 = -2.0 * R_C_term_sqrt * sin_angle_rot;

    let term_L: f32 = delta_l_prime / s_l; // kL=1
    let term_C: f32 = delta_c_prime / s_c; // kC=1
    let term_H: f32 = delta_H_prime_big / s_h; // kH=1

    let lightness_sq: f32 = term_L * term_L;
    let chroma_sq: f32 = term_C * term_C;
    let hue_sq: f32 = term_H * term_H;

    let rt_term: f32 = r_t * term_C * term_H;
    let sum_terms: f32 = lightness_sq + chroma_sq + hue_sq + rt_term;

    return sqrt(sum_terms);
}



const WHITE_X: f32 = 95.047;
const WHITE_Y: f32 = 100.000;
const WHITE_Z: f32 = 108.883;
const EPSILON: f32 = 0.008856;
const KAPPA: f32 = 903.3;

fn lab_to_rgb(lab: Lab) -> vec3<f32> {
    let y = (lab.l + 16.0) / 116.0;
    let x = lab.a / 500.0 + y;
    let z = y - lab.b / 200.0;

    let x3 = x * x * x;
    let z3 = z * z * z;

    var xyz_x = WHITE_X * (select((x - 16.0 / 116.0) / 7.787, x3, x3 > EPSILON));
    var xyz_y = WHITE_Y * (select(lab.l / KAPPA, pow((lab.l + 16.0) / 116.0, 3.0), lab.l > (KAPPA * EPSILON)));
    var xyz_z = WHITE_Z * (select((z - 16.0 / 116.0) / 7.787, z3, z3 > EPSILON));

    xyz_x = xyz_x / 100.0;
    xyz_y = xyz_y / 100.0;
    xyz_z = xyz_z / 100.0;

    var r = xyz_x * 3.2404542 - xyz_y * 1.5371385 - xyz_z * 0.4985314;
    var g = xyz_x * -0.969266 + xyz_y * 1.8760108 + xyz_z * 0.0415560;
    var b = xyz_x * 0.0556434 - xyz_y * 0.2040259 + xyz_z * 1.0572252;

    r = select(12.92 * r, 1.055 * pow(r, 1.0 / 2.4) - 0.055, r > 0.0031308);
    g = select(12.92 * g, 1.055 * pow(g, 1.0 / 2.4) - 0.055, g > 0.0031308);
    b = select(12.92 * b, 1.055 * pow(b, 1.0 / 2.4) - 0.055, b > 0.0031308);

    let rf = round(clamp(r, 0.0, 1.0) * 255.0);
    let gf = round(clamp(g, 0.0, 1.0) * 255.0);
    let bf = round(clamp(b, 0.0, 1.0) * 255.0);

    return vec3<f32>(rf / 255.0, gf / 255.0, bf / 255.0);
}

fn pivot_xyz(n: f32) -> f32 {
    if n > EPSILON {
        return pow(n, 1.0 / 3.0);
    } else {
        return (KAPPA * n + 16.0) / 116.0;
    }
}

fn rgba_to_lab(rgba: u32) -> Lab {
    let r_u8: f32 = f32(rgba & 0xFFu);
    let g_u8: f32 = f32((rgba >> 8u) & 0xFFu);
    let b_u8: f32 = f32((rgba >> 16u) & 0xFFu);

    let r_lin: f32 = pow(r_u8 / 255.0, 2.2);
    let g_lin: f32 = pow(g_u8 / 255.0, 2.2);
    let b_lin: f32 = pow(b_u8 / 255.0, 2.2);

    let x_xyz: f32 = (r_lin * 0.4124564 + g_lin * 0.3575761 + b_lin * 0.1804375) * 100.0;
    let y_xyz: f32 = (r_lin * 0.2126729 + g_lin * 0.7151522 + b_lin * 0.0721750) * 100.0;
    let z_xyz: f32 = (r_lin * 0.0193339 + g_lin * 0.1191920 + b_lin * 0.9503041) * 100.0;

    let xr: f32 = x_xyz / WHITE_X;
    let yr: f32 = y_xyz / WHITE_Y;
    let zr: f32 = z_xyz / WHITE_Z;

    let fx: f32 = pivot_xyz(xr);
    let fy: f32 = pivot_xyz(yr);
    let fz: f32 = pivot_xyz(zr);

    let l_star: f32 = max(0.0, 116.0 * fy - 16.0);
    let a_star: f32 = 500.0 * (fx - fy);
    let b_star: f32 = 200.0 * (fy - fz);

    return Lab(l_star, a_star, b_star, 0.0);
}

fn pack_rgba8(rgba: vec4<f32>) -> u32 {
    let r = u32(round(clamp(rgba.r, 0.0, 1.0) * 255.0));
    let g = u32(round(clamp(rgba.g, 0.0, 1.0) * 255.0));
    let b = u32(round(clamp(rgba.b, 0.0, 1.0) * 255.0));
    let a = u32(round(clamp(rgba.a, 0.0, 1.0) * 255.0));
    return r | (g << 8u) | (b << 16u) | (a << 24u);
}

fn color_at(index: u32) -> u32 {
    let vec_idx = index / 4u;
    let component_idx = index % 4u;
    return config.palette[vec_idx][component_idx];
}
