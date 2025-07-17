@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size = uSizes.xy;
    let dst_size = uSizes.zw;

    let x_coord = i32(uv.x * src_size.x);
    let x_max_idx = i32(src_size.x) - 1;
    let clamped_x = clamp(x_coord, 0, x_max_idx);

    let nearest_y = i32(round(uv.y * src_size.y - 0.5));
    let y_max_idx = i32(src_size.y) - 1;
    let clamped_y = clamp(nearest_y, 0, y_max_idx);

    return textureLoad(t, vec2<i32>(clamped_x, clamped_y), 0);
}
