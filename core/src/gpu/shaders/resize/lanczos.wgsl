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
  let ratio  = src_size / dst_size;
  let sratio = max(ratio, vec2<f32>(1.0));

  let dstPx = uv * dst_size;
  let srcPx = dstPx * ratio - vec2<f32>(0.5);

  let rx = i32(ceil(A * sratio.x));
  let ry = i32(ceil(A * sratio.y));

  let baseF = floor(srcPx);
  let maxI  = vec2<i32>(textureDimensions(srcTex, 0)) - vec2<i32>(1, 1);

  var sumC = vec4<f32>(0.0);
  var wSum = 0.0;

  for (var j = -ry; j <= ry; j = j + 1) {
    for (var i = -rx; i <= rx; i = i + 1) {
      let samplePos = baseF + vec2<f32>(f32(i), f32(j));
      let dx        = samplePos.x - srcPx.x;
      let dy        = samplePos.y - srcPx.y;
      let wx        = lanczos_scaled(dx, sratio.x);
      let wy        = lanczos_scaled(dy, sratio.y);
      let w         = wx * wy;
      if (w != 0.0) {
        let ix = clamp(i32(samplePos.x), 0, maxI.x);
        let iy = clamp(i32(samplePos.y), 0, maxI.y);
        let c  = textureLoad(srcTex, vec2<i32>(ix, iy), 0);
        sumC = sumC + c * w;
        wSum = wSum + w;
      }
    }
  }

  return sumC / wSum;
}
