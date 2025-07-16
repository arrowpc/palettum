@group(0) @binding(0) var t: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let texSize = vec2<f32>(textureDimensions(t, 0));
    let texelPos = uv * texSize - 0.5;
    let nearest = vec2<i32>(round(texelPos));
    return textureLoad(t, nearest, 0);
}
