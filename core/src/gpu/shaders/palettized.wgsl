#include "common.wgsl"

@group(0) @binding(0) var<storage, read> input_rgba: array<u32>;
@group(0) @binding(1) var<uniform> config: Config;
@group(0) @binding(2) var<storage, read_write> output_rgba: array<u32>;

@group(1) @binding(0) var blue_noise_tex: texture_2d<f32>;
@group(1) @binding(1) var blue_noise_sampler: sampler;

const WORKGROUP_SIZE_X: u32 = 16u;
const WORKGROUP_SIZE_Y: u32 = 16u;
const FS_TOTAL_INVOCATIONS: u32 = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y;

@compute @workgroup_size(16, 16, 1)
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_index) local_idx: u32
) {
    let width = config.image_width;
    let height = config.image_height;

    if config.dither_algorithm == 1u { // Floyd-Steinberg Dithering
        let num_pixels = width * height;

        for (var i = local_idx; i < num_pixels; i = i + FS_TOTAL_INVOCATIONS) {
            output_rgba[i] = input_rgba[i];
        }
        workgroupBarrier();

        let fs_loop_width = max(FS_TOTAL_INVOCATIONS * 3u, width);
        let fs_i_max = ((height + FS_TOTAL_INVOCATIONS - 1u) / FS_TOTAL_INVOCATIONS) * fs_loop_width + (FS_TOTAL_INVOCATIONS - 1u) * 3u;

        for (var i_fs = 0u; i_fs < fs_i_max; i_fs = i_fs + 1u) {
            storageBarrier();

            let wi_signed = i32(i_fs) - i32(local_idx) * 3;
            if wi_signed >= 0 {
                let wi = u32(wi_signed);
                let y = (wi / fs_loop_width) * FS_TOTAL_INVOCATIONS + local_idx;
                let x = wi % fs_loop_width;

                if x < width && y < height {
                    let idx = y * width + x;
                    let packed_pixel = output_rgba[idx];
                    let alpha = (packed_pixel >> 24u) & 0xFFu;

                    if alpha < config.transparency_threshold {
                        output_rgba[idx] = 0u;
                    } else {
                        var pixel_f32 = unpack_rgba_f32(packed_pixel);
                        let pixel_lab = rgba_to_lab(packed_pixel);
                        var min_dist = 1e20;
                        var best_index = 0u;
                        for (var j = 0u; j < config.palette_size; j = j + 1u) {
                            let pal_lab = rgba_to_lab(color_at(j));
                            let d = delta_e(pixel_lab, pal_lab, config.diff_formula);
                            if d < min_dist {
                                min_dist = d;
                                best_index = j;
                            }
                        }
                        let quantized = color_at(best_index);
                        output_rgba[idx] = quantized;

                        var quant_f32 = unpack_rgba_f32(quantized);
                        let error = pixel_f32.rgb - quant_f32.rgb;
                        let offsets = array<vec2<i32>,4>(
                            vec2<i32>(1, 0),  // right
                            vec2<i32>(-1, 1), // bottom-left
                            vec2<i32>(0, 1),  // bottom 
                            vec2<i32>(1, 1)   // bottom-right
                        );
                        let factors = array<f32,4>(7.0 / 16.0, 3.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0);

                        for (var k = 0u; k < 4u; k = k + 1u) {
                            let nx = i32(x) + offsets[k].x;
                            let ny = i32(y) + offsets[k].y;
                            if nx >= 0 && nx < i32(width) && ny >= 0 && ny < i32(height) {
                                let nidx = u32(ny) * width + u32(nx);
                                var neighbor = unpack_rgba_f32(output_rgba[nidx]);
                                neighbor.r = neighbor.r + error.r * factors[k] * config.dither_strength;
                                neighbor.g = neighbor.g + error.g * factors[k] * config.dither_strength;
                                neighbor.b = neighbor.b + error.b * factors[k] * config.dither_strength;
                                output_rgba[nidx] = pack_rgba_u32(neighbor);
                            }
                        }
                    }
                }
            }
        }
    } else if config.dither_algorithm == 2u { // Blue-Noise Dithering
        let x = global_id.x;
        let y = global_id.y;
        if x >= width || y >= height { return; }

        let idx = y * width + x;
        let packed = input_rgba[idx];
        let alpha = (packed >> 24u) & 0xFFu;
        if alpha < config.transparency_threshold {
            output_rgba[idx] = 0u;
            return;
        }

        let blue_noise_size = vec2<i32>(64, 64);
        let noise_coord = vec2<i32>(i32(x) % blue_noise_size.x, i32(y) % blue_noise_size.y);
        let noise_val_norm = textureLoad(blue_noise_tex, noise_coord, 0).r;
        let noise = (noise_val_norm - 0.5) * config.dither_strength * 255.0;

        var r = f32((packed >> 0u) & 0xFFu);
        var g = f32((packed >> 8u) & 0xFFu);
        var b = f32((packed >> 16u) & 0xFFu);
        r = clamp(r + noise, 0.0, 255.0);
        g = clamp(g + noise, 0.0, 255.0);
        b = clamp(b + noise, 0.0, 255.0);

        let tmp_px = ((u32(r) & 0xFFu)) | ((u32(g) & 0xFFu) << 8u) | ((u32(b) & 0xFFu) << 16u) | (0xFFu << 24u);

        let pixel_lab = rgba_to_lab(tmp_px);
        var min_dist = 1e20;
        var best_i = 0u;
        for (var i = 0u; i < config.palette_size; i = i + 1u) {
            let pal_lab = rgba_to_lab(color_at(i));
            let d = delta_e(pixel_lab, pal_lab, config.diff_formula);
            if d < min_dist {
                min_dist = d;
                best_i = i;
            }
        }

        var q = color_at(best_i);
        q = (q & 0x00FFFFFFu) | (0xFFu << 24u);
        output_rgba[idx] = q;
    } else { // No dithering
        let x = global_id.x;
        let y = global_id.y;
        if x >= width || y >= height { return; }

        let idx = y * width + x;
        let packed_pixel = input_rgba[idx];
        let alpha = (packed_pixel >> 24u) & 0xFFu;
        if alpha < config.transparency_threshold {
            output_rgba[idx] = 0u;
            return;
        }

        let pixel_lab = rgba_to_lab(packed_pixel);
        var min_distance = 1e20;
        var best_index = 0u;
        for (var i = 0u; i < config.palette_size; i = i + 1u) {
            let palette_lab = rgba_to_lab(color_at(i));
            let distance = delta_e(pixel_lab, palette_lab, config.diff_formula);
            if distance < min_distance {
                min_distance = distance;
                best_index = i;
            }
        }
        output_rgba[idx] = color_at(best_index);
    }
}


