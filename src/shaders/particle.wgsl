@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    // Triángulo básico de prueba en coordenadas normalizadas de pantalla (-1 a 1)
    var pos = array<vec2f, 3>(
        vec2f(0.0, 0.5),
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5)
    );
    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
    // Color morado brillante adaptado a tu paleta
    return vec4f(0.47, 0.35, 1.0, 1.0);
}