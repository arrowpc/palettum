@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size = uSizes.xy;
    let dst_size = uSizes.zw;
    let maxC:  vec2<f32>   = src_size - vec2<f32>(1.0);

    let pos:   vec2<f32>   = uv * src_size - vec2<f32>(0.5);
    let base:  vec2<f32>   = floor(pos);
    let f:     vec2<f32>   = pos - base;

    let w00: f32 = (1.0 - f.x) * (1.0 - f.y);
    let w10: f32 =        f.x  * (1.0 - f.y);
    let w01: f32 = (1.0 - f.x) *        f.y;
    let w11: f32 =        f.x  *        f.y;

    let p00: vec2<f32> = clamp(base,                       vec2<f32>(0.0), maxC);
    let p10: vec2<f32> = clamp(base + vec2<f32>(1.0, 0.0), vec2<f32>(0.0), maxC);
    let p01: vec2<f32> = clamp(base + vec2<f32>(0.0, 1.0), vec2<f32>(0.0), maxC);
    let p11: vec2<f32> = clamp(base + vec2<f32>(1.0, 1.0), vec2<f32>(0.0), maxC);

    let c00: vec4<f32> = textureLoad(t, vec2<i32>(p00), 0);
    let c10: vec4<f32> = textureLoad(t, vec2<i32>(p10), 0);
    let c01: vec4<f32> = textureLoad(t, vec2<i32>(p01), 0);
    let c11: vec4<f32> = textureLoad(t, vec2<i32>(p11), 0);

    let sum:      vec4<f32> = c00 * w00 + c10 * w10 + c01 * w01 + c11 * w11;
    let weightSum: f32      = w00 + w10 + w01 + w11;
    return sum / weightSum;
}
