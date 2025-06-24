struct FragmentInput {
    @location(0) tex_coord: vec2<f32>,
};

@group(0) @binding(0) var t_input: texture_2d<f32>;
@group(0) @binding(1) var s_input: sampler;

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4<f32> {
    return textureSample(t_input, s_input, in.tex_coord);
}
