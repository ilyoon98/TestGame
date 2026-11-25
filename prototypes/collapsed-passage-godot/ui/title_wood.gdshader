// Rough, grainy wood for the title crate. `axis` is the board's long axis in its own space
// (0 = X, 1 = Y, 2 = Z) so the grain runs along every plank; `seed` keeps boards from matching.
shader_type spatial;

uniform vec4 wood : source_color = vec4(0.48, 0.32, 0.2, 1.0);
uniform int axis = 0;
uniform float seed = 0.0;

varying vec3 local;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void vertex() {
	local = VERTEX;
}

void fragment() {
	float along = axis == 0 ? local.x : (axis == 1 ? local.y : local.z);
	vec2 across = axis == 0 ? local.yz : (axis == 1 ? local.xz : local.xy);
	float cross_line = across.x + across.y + seed;
	float warp = noise(vec2(along * 5.0 + seed * 3.1, cross_line * 24.0)) * 1.6;
	float streak = sin(cross_line * 240.0 + warp * 7.0) * 0.5 + 0.5;
	float fiber = noise(vec2(along * 80.0 + seed * 7.0, cross_line * 700.0));
	float blotch = noise(vec2(along * 9.0 - seed, cross_line * 9.0));
	float tone = mix(0.62, 1.08, streak) * mix(0.8, 1.12, fiber) * mix(0.72, 1.05, blotch);
	ALBEDO = wood.rgb * tone;
	ROUGHNESS = 0.88 + 0.1 * fiber;
	SPECULAR = 0.25;
	NORMAL_MAP = normalize(vec3((fiber - 0.5) * 0.9, (streak - 0.5) * 0.7, 1.0)) * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.8;
}
