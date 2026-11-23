extends Control

const STAIR := preload("res://art/locations/pursuer-capture.webp")
const PURSUER := preload("res://art/arena/prison-pursuer.webp")
var elapsed := 0.0


func _ready() -> void:
	custom_minimum_size.y = 320
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	accessibility_name = "수녀의 등불이 꺼지고 사형수의 그림자가 다가온다."


func _process(delta: float) -> void:
	if not is_visible_in_tree():
		return
	elapsed = minf(3.0, elapsed + delta)
	queue_redraw()
	if elapsed >= 3.0:
		set_process(false)


func _draw() -> void:
	var frame_size := STAIR.get_size() * minf(size.x / STAIR.get_width(), size.y / STAIR.get_height())
	var frame := Rect2((size - frame_size) / 2.0, frame_size)
	draw_texture_rect(STAIR, frame, false)
	var approach := ease(clampf(elapsed / 2.5, 0, 1), 0.55)
	var figure_size := Vector2(0.26, 0.71) * frame_size * lerpf(0.53, 1.0, approach)
	var foot := frame.position + frame_size * Vector2(lerpf(0.27, 0.42, approach), lerpf(0.72, 0.88, approach))
	draw_texture_rect(PURSUER, Rect2(foot - Vector2(figure_size.x / 2.0, figure_size.y), figure_size),
		false, Color(0.53, 0.51, 0.58, lerpf(0.07, 0.94, approach)))
	var dim := smoothstep(0.35, 3.0, elapsed)
	draw_rect(frame, Color(0.03, 0.03, 0.05, dim * 0.56))
	var light := 1.0 - smoothstep(0.95, 2.95, elapsed)
	var wick := frame.position + frame_size * Vector2(0.643, 0.764)
	for i in range(4, 0, -1):
		draw_circle(wick, frame_size.y * 0.026 * i, Color("#ffb45c", light * (0.08 if i > 1 else 0.20)))
	draw_circle(wick, 3.5, Color("#ffe5a2", light))
