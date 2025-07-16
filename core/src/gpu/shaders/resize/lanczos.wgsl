@group(0) @binding(0) var t: texture_2d<f32>;

const PI:  f32 = 3.14159265358979323846;
const A:   f32 = 3.0;

// sinc(x) = sin(pi*x)/(pi*x), with sinc(0)=1
fn sinc(x: f32) -> f32 {
    if (abs(x) < 1e-5) {
        return 1.0;
    }
    let pix = PI * x;
    return sin(pix) / pix;
}

// Lanczos kernel L(x) = sinc(x)*sinc(x/A) for |x|<A, else 0
fn lanczos(x: f32) -> f32 {
    if (abs(x) < A) {
        return sinc(x) * sinc(x / A);
    }
    return 0.0;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dimsU: vec2<u32> = textureDimensions(t, 0);
    let dims:  vec2<f32> = vec2<f32>(dimsU);
    let maxC:  vec2<f32> = dims - vec2<f32>(1.0);

    let pos:  vec2<f32> = uv * dims - vec2<f32>(0.5);
    let base: vec2<f32> = floor(pos);

    var sum:       vec4<f32> = vec4<f32>(0.0);
    var weightSum: f32       = 0.0;

    for (var j: i32 = -2; j <= 3; j = j + 1) {
        for (var i: i32 = -2; i <= 3; i = i + 1) {
            let neighbor: vec2<f32> = base +
                vec2<f32>(f32(i), f32(j));
            let dx: f32 = pos.x - neighbor.x;
            let dy: f32 = pos.y - neighbor.y;
            let w:  f32 = lanczos(dx) * lanczos(dy);

            if (w != 0.0) {
                let clamped: vec2<f32> = clamp(neighbor,
                                             vec2<f32>(0.0),
                                             maxC);
                let coord: vec2<i32>   = vec2<i32>(clamped);
                let c: vec4<f32>       = textureLoad(t, coord, 0);
                sum       = sum + c * w;
                weightSum = weightSum + w;
            }
        }
    }

    return sum / weightSum;
}
