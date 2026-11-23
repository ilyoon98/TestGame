extends Control

const PURSUER := preload("res://art/ui/pursuit/chasing-prisoner.png")
const RUNNER := preload("res://art/ui/pursuit/fleeing-nun.png")
const MARKER_SIZE := Vector2(36, 36)
var _distance := 0
var _urgent := false


func _ready() -> void:
	custom_minimum_size = Vector2(140, 38)
	mouse_filter = Control.MOUSE_FILTER_PASS
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS


func update_distance(distance: int, urgent: bool) -> void:
	_distance = distance
	_urgent = urgent
	tooltip_text = "기도를 받았던 사형수가 뒤쫓는 중\n도망 여유 %d" % distance
	accessibility_name = tooltip_text
	queue_redraw()


func _draw() -> void:
	var top := (size.y - MARKER_SIZE.y) * 0.5
	var lane_y := top + MARKER_SIZE.y * 0.78
	var runner_x := size.x - MARKER_SIZE.x
	var room := maxf(0.0, runner_x - MARKER_SIZE.x - 4.0)
	var progress := clampf(1.0 - _distance * 0.085, 0.05, 1.0)
	var lane_ink := Color("#a96857") if _urgent else Color("#826c59")
	draw_dashed_line(Vector2(6, lane_y), Vector2(size.x - 6, lane_y), lane_ink, 1.0, 4.0, true)
	draw_texture_rect(PURSUER, Rect2(Vector2(room * progress, top), MARKER_SIZE), false,
		Color("#ffb7a6") if _urgent else Color.WHITE)
	draw_texture_rect(RUNNER, Rect2(Vector2(runner_x, top), MARKER_SIZE), false)
