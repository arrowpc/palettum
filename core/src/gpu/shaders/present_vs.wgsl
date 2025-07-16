struct Push {
    scale  : vec2<f32>,
    offset : vec2<f32>,
};
@group(1) @binding(0) var<uniform> pc : Push;

struct Out {
    @builtin(position) pos : vec4<f32>,
    @location(0)       uv  : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) i : u32) -> Out {
    var xy = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0),
    );

    let base = xy[i];
    let clip = base * pc.scale + pc.offset;
    var uv   = (base * 0.5) + vec2<f32>(0.5);
    uv.y = 1.0 - uv.y;

    var o : Out;
    o.pos = vec4<f32>(clip, 0.0, 1.0);
    o.uv  = uv;
    return o;
}
