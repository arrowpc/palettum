@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size = uSizes.xy;
    let dst_size = uSizes.zw;

    let src_y = uv.y * src_size.y;

    let nearest_x = i32(uv.x * src_size.x - 0.5);
    let nearest_y = i32(round(src_y - 0.5));

    return textureLoad(t, vec2<i32>(nearest_x, nearest_y), 0);
}
