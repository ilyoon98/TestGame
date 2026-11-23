extends Control

const PURSUER := preload("res://art/route/pursuer.svg")
const RUNNER := preload("res://art/route/runner.svg")
var _distance := 0
var _urgent := false


func _ready() -> void:
	custom_minimum_size = Vector2(118, 30)
	mouse_filter = Control.MOUSE_FILTER_PASS


func update_distance(distance: int, urgent: bool) -> void:
	_distance = distance
	_urgent = urgent
	tooltip_text = "기도를 받았던 사형수가 뒤쫓는 중 · 도망 여유 %d" % distance
	accessibility_name = tooltip_text
	queue_redraw()


func _draw() -> void:
	var height := size.y / 2.0
	var width := maxf(0.0, size.x - 24.0)
	draw_dashed_line(Vector2(12, height), Vector2(12 + width, height), Color("#826c59"), 1.0, 4.0, true)
	var progress := maxf(0.05, 0.88 - maxf(0.0, _distance) * 0.05)
	var point := Vector2(width * progress, height - 10.0)
	draw_texture_rect(PURSUER, Rect2(point, Vector2(20, 20)), false, Color("#ff8e72") if _urgent else Color("#e4b48b"))
	draw_texture_rect(RUNNER, Rect2(Vector2(size.x - 20, height - 10), Vector2(20, 20)), false, Color("#9bd8be"))
