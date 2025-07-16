@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size = uSizes.xy;
    let dst_size = uSizes.zw;
    let maxC:  vec2<f32>   = src_size - vec2<f32>(1.0);

    let pos_y:   f32   = uv.y * src_size.y - 0.5;
    let base_y:  f32   = floor(pos_y);
    let f_y:     f32   = pos_y - base_y;

    let w0_y: f32 = (1.0 - f_y);
    let w1_y: f32 =        f_y;

    let p0_y: f32 = clamp(base_y, 0.0, maxC.y);
    let p1_y: f32 = clamp(base_y + 1.0, 0.0, maxC.y);

    let x_coord = i32(uv.x * src_size.x - 0.5);

    let c0: vec4<f32> = textureLoad(t, vec2<i32>(x_coord, i32(p0_y)), 0);
    let c1: vec4<f32> = textureLoad(t, vec2<i32>(x_coord, i32(p1_y)), 0);

    let sum:      vec4<f32> = c0 * w0_y + c1 * w1_y;
    let weightSum: f32      = w0_y + w1_y;
    return sum / weightSum;
}
