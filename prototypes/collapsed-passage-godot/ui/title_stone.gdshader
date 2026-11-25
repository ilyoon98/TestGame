// Stone tile floor for the title. Offset rows of uneven stones stand `depth` metres above
// recessed mortar joints, with rounded edges that catch the candle light. The floor fades
// out a short way from the crate so only the stones around the candle show.
shader_type spatial;
// No shadow receiving: the displaced triangles would shadow themselves in diagonal streaks.
render_mode depth_draw_opaque, shadows_disabled;

uniform vec4 stone : source_color = vec4(0.42, 0.38, 0.37, 1.0);
uniform vec4 mortar : source_color = vec4(0.05, 0.045, 0.045, 1.0);
uniform float tile = 0.3;
uniform float reach = 1.15;
// Set from the candle's brightness so the floor vanishes completely when it goes out.
uniform float visibility = 1.0;
// How far the stones stand above the joints, and how wide their rounded edge is.
uniform float depth = 0.022;
uniform float bevel = 0.035;

varying vec3 world;

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

// 0 at the bottom of a joint, 1 on a stone's flat top. `cell` identifies the stone.
float stone_face(vec2 xz, out vec2 cell) {
	vec2 size = vec2(tile * 1.4, tile);
	vec2 p = xz / size;
	p.x += mod(floor(p.y), 2.0) * 0.5;
	cell = floor(p);
	vec2 f = fract(p);
	vec2 edge = min(f, 1.0 - f) * size;
	float ragged = (noise(xz * 40.0 + cell) - 0.5) * 0.008;
	// Round each side separately and multiply, so corners curve instead of creasing.
	vec2 rise = clamp((edge + ragged - 0.006) / bevel, 0.0, 1.0);
	return sin(rise.x * 1.5707963) * sin(rise.y * 1.5707963);
}

float relief(vec2 xz) {
	vec2 cell;
	float face = stone_face(xz, cell);
	float lean = (hash(cell + 7.0) - 0.5) * 0.005;
	float bumps = (noise(xz * 14.0 + cell * 5.0) - 0.5) * 0.005 + (noise(xz * 70.0) - 0.5) * 0.0015;
	return face * (depth + lean + bumps);
}

void vertex() {
	world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += relief(world.xz);
}

void fragment() {
	vec2 cell;
	float face = stone_face(world.xz, cell);
	float step_size = 0.002;
	float here = relief(world.xz);
	float slope_x = (relief(world.xz + vec2(step_size, 0.0)) - here) / step_size;
	float slope_z = (relief(world.xz + vec2(0.0, step_size)) - here) / step_size;
	NORMAL = normalize((VIEW_MATRIX * vec4(normalize(vec3(-slope_x, 1.0, -slope_z)), 0.0)).xyz);

	float chips = noise(world.xz * 18.0 + cell * 3.0);
	float speck = noise(world.xz * 120.0);
	vec3 rock = stone.rgb * (0.7 + 0.4 * hash(cell)) * (0.78 + 0.35 * chips) * (0.9 + 0.2 * speck);
	// Joints and the foot of each stone sit in shadow.
	float cavity = mix(0.18, 1.0, smoothstep(0.0, 0.75, face));
	ALBEDO = mix(mortar.rgb, rock, smoothstep(0.0, 0.3, face)) * cavity;
	ROUGHNESS = mix(1.0, 0.85, face);
	SPECULAR = 0.3;
	float fade = 1.0 - smoothstep(reach * 0.3, reach, length(world.xz));
	ALPHA = fade * visibility;
}
