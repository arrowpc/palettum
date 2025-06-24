struct VsOut {
    @builtin(position) pos : vec4<f32>,
    @location(0)       uv  : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) idx : u32) -> VsOut {
    // 2 triangles covering the screen
    var xy = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0),
    );

    let clip = xy[idx];
    let uv   = (clip * 0.5) + vec2<f32>(0.5);

    var out : VsOut;
    out.pos = vec4<f32>(clip, 0.0, 1.0);
    out.uv  = uv;
    return out;
}
