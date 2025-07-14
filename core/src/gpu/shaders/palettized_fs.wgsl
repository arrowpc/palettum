#include "common.wgsl"

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> config: Config;

@group(2) @binding(0) var blue_noise_tex: texture_2d<f32>;
@group(2) @binding(1) var blue_noise_sampler: sampler;

@fragment
fn fs_main(
    @builtin(position) frag_coord: vec4<f32>,
    @location(0) uv: vec2<f32>,
) -> @location(0) vec4<f32> {
    let pixel_srgb = textureSample(tex, samp, uv);
    var pixel_to_process_linear = pixel_srgb.rgb;

    // Dithering: 1u is FS (not possible in fragment shader), 2u is Blue-Noise
    if (config.dither_algorithm == 2u) { // Bn (Blue-Noise)
        let blue_noise_size = vec2<f32>(64.0, 64.0);
        let noise_uv = (frag_coord.xy % blue_noise_size) / blue_noise_size;
        let noise_val_norm = textureSample(blue_noise_tex, blue_noise_sampler, noise_uv).r;
        let noise = (noise_val_norm - 0.5) * config.dither_strength * 255.0;

        let pixel_srgb_255 = pow(pixel_to_process_linear, vec3<f32>(1.0 / 2.2)) * 255.0;
        let dithered_srgb_255 = clamp(pixel_srgb_255 + noise, vec3<f32>(0.0), vec3<f32>(255.0));
        pixel_to_process_linear = pow(dithered_srgb_255 / 255.0, vec3<f32>(2.2));
    }

    let pixel_srgb_u8 =
        vec3<u32>(round(pow(pixel_to_process_linear, vec3<f32>(1.0 / 2.2)) * 255.0));
    let packed_pixel_srgb = (pixel_srgb_u8.r & 0xFFu)
        | ((pixel_srgb_u8.g & 0xFFu) << 8u)
        | ((pixel_srgb_u8.b & 0xFFu) << 16u)
        | (0xFFu << 24u);

    let pixel_lab = rgba_to_lab(packed_pixel_srgb);

    var min_dist = 1e20;
    var best_index = 0u;
    for (var i = 0u; i < config.palette_size; i = i + 1u) {
        let pal_lab = rgba_to_lab(color_at(i));
        let d = delta_e(pixel_lab, pal_lab, config.diff_formula);
        if d < min_dist {
            min_dist = d;
            best_index = i;
        }
    }

    let quantized_packed_srgb = color_at(best_index);

    let r_final_srgb = f32((quantized_packed_srgb >> 0u) & 0xFFu) / 255.0;
    let g_final_srgb = f32((quantized_packed_srgb >> 8u) & 0xFFu) / 255.0;
    let b_final_srgb = f32((quantized_packed_srgb >> 16u) & 0xFFu) / 255.0;

    let final_rgb_linear = vec3<f32>(
        srgb_to_linear(r_final_srgb),
        srgb_to_linear(g_final_srgb),
        srgb_to_linear(b_final_srgb),
    );

    if pixel_srgb.a * 255.0 < f32(config.transparency_threshold) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    return vec4<f32>(final_rgb_linear, pixel_srgb.a);
}
