struct Uniforms {
  modelViewProjectionMatrix: mat4x4<f32>,
}

@binding(0) @group(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) normal: vec3<f32>,
}

@vertex
fn main_vertex_shader(
    @location(0) position: vec4<f32>,
    @location(1) color: vec3<f32>,
    @location(2) normal: vec3<f32>
) -> VertexOutput {
    var output: VertexOutput;
    output.Position = uniforms.modelViewProjectionMatrix * position;
    output.normal = (uniforms.modelViewProjectionMatrix * vec4(normal, 0.0)).xyz;
    output.color = color;
    return output;
}

let lightDir = vec3<f32>(0.707, 0.707, 0.707);
let ambientColor = vec3<f32>(0.1, 0.1, 0.1);

@fragment
fn main_fragment_shader(
    @location(0) normal: vec3<f32>,
    @location(1) color: vec3<f32>
) -> @location(0) vec4<f32> {
    // Simulate directional light in camera space from normalized(1,1,1)
    let diff = max(0.0, dot(normal, lightDir));
    return vec4(color * diff + ambientColor, 1.0);
}
