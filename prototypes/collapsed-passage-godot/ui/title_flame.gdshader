// Candle flame on a camera-facing quad. `lean` bends the tip sideways (in flame heights),
// `stretch` scales its height and `intensity` fades it out when the gust snuffs it.
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

uniform float lean = 0.0;
uniform float stretch = 1.0;
uniform float agitation = 0.0;
uniform float intensity = 1.0;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

void fragment() {
	float height = max(stretch, 0.001);
	float rise = (1.0 - UV.y) / height;
	float wobble = sin(TIME * 7.0 + rise * 6.0) * 0.025 * rise
		+ agitation * 0.05 * rise * sin(TIME * 23.0 + rise * 9.0);
	float center = 0.5 + clamp(lean, -1.2, 1.2) * 0.26 * rise * rise + wobble;
	float body = clamp(1.0 - rise, 0.0, 1.0);
	float half_width = 0.11 * pow(sin(3.14159 * pow(body, 1.8)), 0.6) * mix(0.55, 1.0, clamp(stretch, 0.0, 1.0));
	float spread = abs(UV.x - center) / max(half_width, 0.0001);
	float inside = step(0.0, rise) * step(rise, 1.0);
	float outer = smoothstep(1.0, 0.7, spread) * inside;
	float middle = smoothstep(0.72, 0.38, spread) * smoothstep(0.88, 0.5, rise) * inside;
	float core = smoothstep(0.42, 0.08, spread) * smoothstep(0.5, 0.12, rise) * inside;
	float root = smoothstep(0.7, 0.1, spread) * smoothstep(0.14, 0.02, rise) * inside;
	vec3 color = vec3(1.0, 0.38, 0.07) * outer + vec3(1.0, 0.62, 0.2) * middle
		+ vec3(1.0, 0.92, 0.75) * core + vec3(0.2, 0.35, 1.0) * root * 0.6;
	ALBEDO = color * intensity;
	ALPHA = clamp(outer, 0.0, 1.0) * intensity;
}
