@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size = uSizes.xy;
    let dst_size = uSizes.zw;
    let texelPos = uv * src_size - 0.5;
    let nearest = vec2<i32>(round(texelPos));
    return textureLoad(t, nearest, 0);
}
