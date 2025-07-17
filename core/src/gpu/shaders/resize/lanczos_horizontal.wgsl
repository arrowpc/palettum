@group(0) @binding(0) var srcTex:    texture_2d<f32>;
@group(1) @binding(0) var<uniform> uSizes: vec4<f32>;

const PI : f32 = 3.141592653589793;
const A  : f32 = 3.0;
const EPS: f32 = 1e-5;

fn sinc(x: f32) -> f32 {
  if (abs(x) < EPS) { return 1.0; }
  let px = PI * x;
  return sin(px) / px;
}

fn lanczos_scaled(x: f32, s: f32) -> f32 {
  let xs = x / s;
  if (abs(xs) < A) {
    return (sinc(xs) * sinc(xs / A)) / s;
  }
  return 0.0;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let src_size = uSizes.xy;
  let dst_size = uSizes.zw;
  let ratio_x  = src_size.x / dst_size.x;
  let sratio_x = max(ratio_x, 1.0);

  let dstPx_x = uv.x * dst_size.x;
  let srcPx_x = dstPx_x * ratio_x - 0.5;

  let rx = i32(ceil(A * sratio_x));

  let baseF_x = floor(srcPx_x);
  let maxI_x  = i32(textureDimensions(srcTex, 0).x) - 1;

  var sumC = vec4<f32>(0.0);
  var wSum = 0.0;

  let y_coord = i32(uv.y * src_size.y);
  let clamped_y_coord = clamp(y_coord, 0, i32(src_size.y) - 1);

  for (var i = -rx; i <= rx; i = i + 1) {
    let samplePos_x = baseF_x + f32(i);
    let dx          = samplePos_x - srcPx_x;
    let wx          = lanczos_scaled(dx, sratio_x);
    let w           = wx;
    if (w != 0.0) {
      let ix = clamp(i32(samplePos_x), 0, maxI_x);
      let c  = textureLoad(srcTex, vec2<i32>(ix, clamped_y_coord), 0);
      sumC = sumC + c * w;
      wSum = wSum + w;
    }
  }

  return sumC / wSum;
}
