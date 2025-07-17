@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size   = uSizes.xy;
    let dst_size   = uSizes.zw;
    let ratio_x    = src_size.x / dst_size.x;
    let sratio_x   = max(ratio_x, 1.0);

    let dstPx_x    = uv.x * dst_size.x;
    let srcPx_x    = dstPx_x * ratio_x - 0.5;

    let rx         = i32(ceil(sratio_x));
    let baseF_x    = floor(srcPx_x);
    let maxI_x     = i32(textureDimensions(t, 0).x) - 1;

    var sumC      : vec4<f32> = vec4<f32>(0.0);
    var wSum      : f32       = 0.0;

    let y_coord = i32(uv.y * src_size.y);
    let y_max_idx = i32(src_size.y) - 1;
    let clamped_y_coord = clamp(y_coord, 0, y_max_idx);

    for (var i: i32 = -rx; i <= rx; i = i + 1) {
        let samplePos_x = baseF_x + f32(i);
        let dx          = samplePos_x - srcPx_x;
        let w           = max(0.0, 1.0 - abs(dx) / sratio_x);
        if (w > 0.0) {
            let ix     = clamp(i32(samplePos_x), 0, maxI_x);
            let c      = textureLoad(t, vec2<i32>(ix, clamped_y_coord), 0);
            sumC       = sumC + c * w;
            wSum       = wSum + w;
        }
    }

    return sumC / wSum;
}
