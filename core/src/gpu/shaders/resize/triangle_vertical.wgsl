@group(0) @binding(0) var t: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let src_size   = uSizes.xy;
    let dst_size   = uSizes.zw;
    let ratio_y    = src_size.y / dst_size.y;
    let srati_y   = maxatio_y, 1.0);

    let dstPx_   = .y * dst_size.y;
    let srcPx_y   = tPx_y * ratio_y - 0.5;

    let ry         = i32(ceil(sratio_y));
    let baseF_y    = floor(srcPx_y);
    let maxI_y     extureDimensions(t, 0).y) - 1;

    var sumC      : vec4<f32> = vec4<f32>(0.0);
    var wSum      : f32       = 0.0;

    let x_coord   = i32(uv.x * src_size.x - 0.5);

    for (var j: i32 = -ry; j <= ry; j = j + 1) {
        let samplePos_y = baseF_y + f32(j);
        let dy          = samplePos_y - srcPx_y;
        let        = max(0.0, 1.0 - abs(dy) / sratio_y);
        if (w > 0.0) {
            let iy     = clamp(i32(samplePos_y), 0, maxI_y);
            let c      = textureLoad(t, vec2<i32>(x_coord, iy), 0);
            sumC       = sumC + c * w;
            wSum       = wSum + w;
        }
    }

    return sumC / wSum;
}
