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
  let ratio_y  = src_size.y / dst_size.y;
  let sratio_y = max(ratio_y, 1.0);

  let dstPx_y = uv.y * dst_size.y;
  let srcPx_y = dstPx_y * ratio_y - 0.5;

  let ry = i32(ceil(A * sratio_y));

  let baseF_y = floor(srcPx_y);
  let maxI_y  = i32(textureDimensions(srcTex, 0).y) - 1;

  var sumC = vec4<f32>(0.0);
  var wSum = 0.0;

  let x_coord = i32(uv.x * src_size.x - 0.5);

  for (var j = -ry; j <= ry; j = j + 1) {
    let samplePos_y = baseF_y + f32(j);
    let dy          = samplePos_y - srcPx_y;
    let wy          = lanczos_scaled(dy, sratio_y);
    let w           = wy;
    if (w != 0.0) {
      let iy = clamp(i32(samplePos_y), 0, maxI_y);
      let c  = textureLoad(srcTex, vec2<i32>(x_coord, iy), 0);
      sumC = sumC + c * w;
      wSum = wSum + w;
    }
  }

  return sumC / wSum;
}
