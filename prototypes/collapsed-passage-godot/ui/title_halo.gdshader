// Soft warm glow around the candle, drawn additively on a camera-facing quad.
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec4 tint : source_color = vec4(1.0, 0.55, 0.22, 1.0);
uniform float intensity = 0.5;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

void fragment() {
	float falloff = 1.0 - clamp(length(UV - vec2(0.5)) * 2.0, 0.0, 1.0);
	float glow = falloff * falloff * falloff;
	ALBEDO = tint.rgb * glow * intensity;
	ALPHA = glow * intensity;
}
