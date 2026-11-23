extends Control

const Run := preload("res://combat/threshold_run.gd")
const CELL := 13.0
const STEP := 17.0
const LINE := Color("#563b30")
const INLAY := Color("#975528")

var _filled: Array[bool] = []


func setup(allowed: Array) -> void:
	custom_minimum_size = Vector2(72, 18)
	size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	mouse_filter = Control.MOUSE_FILTER_PASS
	var names := PackedStringArray()
	# Formation indices start at the front. The strip is read from the rear.
	for rank in range(2, -1, -1):
		var enabled := allowed.has(rank) or allowed.has(float(rank))
		_filled.append(enabled)
		if enabled:
			names.append(Run.RANKS[rank])
	tooltip_text = ("발동 위치  " + ", ".join(names) if not names.is_empty() else "발동 가능 위치 없음")
	tooltip_text += "\n오른쪽이 전위"
	accessibility_name = tooltip_text
	resized.connect(queue_redraw)


func _draw() -> void:
	var origin := Vector2(1, floorf((size.y - CELL) / 2.0))
	for index in _filled.size():
		var cell := Rect2(origin + Vector2(index * STEP, 0), Vector2(CELL, CELL))
		if _filled[index]:
			draw_rect(cell, INLAY)
		draw_rect(cell, LINE, false, 1.4)
	var arrow := origin + Vector2(52, CELL / 2.0)
	draw_line(arrow, arrow + Vector2(15, 0), LINE, 1.8, true)
	draw_polyline(PackedVector2Array([arrow + Vector2(10, -4), arrow + Vector2(15, 0),
		arrow + Vector2(10, 4)]), LINE, 1.8, true)
