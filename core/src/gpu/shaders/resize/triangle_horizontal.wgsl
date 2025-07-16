@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size = uSizes.xy;
    let dst_size = uSizes.zw;
    let maxC:  vec2<f32>   = src_size - vec2<f32>(1.0);

    let pos_x:   f32   = uv.x * src_size.x - 0.5;
    let base_x:  f32   = floor(pos_x);
    let f_x:     f32   = pos_x - base_x;

    let w0_x: f32 = (1.0 - f_x);
    let w1_x: f32 =        f_x;

    let p0_x: f32 = clamp(base_x, 0.0, maxC.x);
    let p1_x: f32 = clamp(base_x + 1.0, 0.0, maxC.x);

    let y_coord = i32(uv.y * src_size.y - 0.5);

    let c0: vec4<f32> = textureLoad(t, vec2<i32>(i32(p0_x), y_coord), 0);
    let c1: vec4<f32> = textureLoad(t, vec2<i32>(i32(p1_x), y_coord), 0);

    let sum:      vec4<f32> = c0 * w0_x + c1 * w1_x;
    let weightSum: f32      = w0_x + w1_x;
    return sum / weightSum;
}
