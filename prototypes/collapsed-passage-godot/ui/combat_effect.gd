extends Control

const DAMAGE := Color("#ffaf83")
const GUARD := Color("#aeeaff")
const HEAL := Color("#a6f4c6")
const LIGHT := Color("#fff3ca")
const SEAL := Color("#dda4fa")

var _mode := ""
var _progress := 0.0
var _duration := 0.0
var _origin := Vector2.ZERO
var _destination := Vector2.ZERO
var _targets: Array[Vector2] = []
var _event: Dictionary = {}
var _facing := 1.0
var _emote: Texture2D
var _emote_position := Vector2.ZERO


func windup(origin: Vector2, facing: float, duration: float) -> void:
	_origin = origin
	_facing = facing
	_begin("windup", duration)


func flight(id: String, origin: Vector2, destination: Vector2, duration: float) -> void:
	_origin = origin
	_destination = destination
	_begin(id, duration)


func impact(event: Dictionary, targets: Array[Vector2], facing: float, duration: float) -> void:
	_event = event
	_targets = targets
	_facing = facing
	_begin("impact", duration)


func clear() -> void:
	_mode = ""
	_event = {}
	_targets.clear()
	_emote = null
	queue_redraw()


func _begin(mode: String, duration: float) -> void:
	_mode = mode
	_progress = 0.0
	_duration = duration
	queue_redraw()


func advance(delta: float) -> void:
	if not _mode.is_empty():
		_progress = minf(1.0, _progress + delta / _duration)
		queue_redraw()


func _draw() -> void:
	match _mode:
		"windup":
			var color := Color(LIGHT, (1.0 - _progress) * 0.75)
			var offset := Vector2(_facing * (12 + 7 * _progress), 0)
			var start := _origin + offset + Vector2(0, -20)
			var end := _origin + offset + Vector2(23 * _facing, 15)
			draw_line(start, end, color, 3.0, true)
		"arrow", "seal", "healing":
			_draw_flight()
		"impact":
			_draw_impact()
	if _emote:
		var size_px := Vector2(57, 43)
		var offset := _emote_position + Vector2(-62, -20)
		offset.x = clampf(offset.x, 7, maxf(7, size.x - size_px.x - 7))
		offset.y = clampf(offset.y, 7, maxf(7, size.y - size_px.y - 7))
		var frame := Rect2(offset, size_px)
		draw_rect(frame.grow(2), Color("#251f19"))
		draw_texture_rect(_emote, frame, false)
		draw_rect(frame.grow(2), LIGHT.darkened(0.27), false, 1.0)


func show_emote(art: Texture2D, position: Vector2) -> void:
	_emote = art
	_emote_position = position
	queue_redraw()


func _draw_flight() -> void:
	var is_arrow := _mode == "arrow"
	var is_heal := _mode == "healing"
	var travel := _destination - _origin
	var rise := minf(22.0 if is_arrow else 43.0, absf(travel.x) * (0.045 if is_arrow else 0.12))
	if is_heal:
		rise = clampf(absf(travel.x) * 0.15, 20.0, 62.0)
	var point := _origin.lerp(_destination, _progress) - Vector2(0, 4.0 * rise * _progress * (1.0 - _progress))
	var direction := (travel - Vector2(0, 4.0 * rise * (1.0 - 2.0 * _progress))).normalized()
	var color := LIGHT if is_arrow else HEAL if is_heal else SEAL
	draw_line(point - direction * 36, point, Color(color, 0.46), 3.0, true)
	if is_arrow:
		var wing := direction.orthogonal() * 4.0
		draw_colored_polygon(PackedVector2Array([point, point - direction * 11 + wing, point - direction * 11 - wing]), color)
	elif is_heal:
		for i in range(3):
			var t := maxf(0, _progress - i * 0.09)
			var center := _origin.lerp(_destination, t) - Vector2(0, 4.0 * rise * t * (1.0 - t))
			draw_circle(center, 7.0 - i, Color(HEAL, 0.25), true, -1.0, true)
			draw_circle(center, 3.5 - i * 0.6, Color(HEAL, 0.95 - i * 0.22), true, -1.0, true)
	else:
		draw_circle(point, 9.0, Color(color, 0.35), true, -1.0, true)
		draw_circle(point, 4.0, color, true, -1.0, true)


func _draw_impact() -> void:
	var dealt: int = _event.get("dealt", 0)
	var blocked: int = _event.get("blocked", 0)
	var removed: int = _event.get("removed", 0)
	var added: int = _event.get("added", 0)
	var recovered: int = _event.get("recovered", 0)
	var gate: bool = _event.get("gateBlock", false)
	var force: bool = _event.get("defeated", false) or _event.get("critical", 0) > 0
	var fade := 1.0 - smoothstep(0.6, 1.0, _progress)
	var flash := (1.0 - _progress) * fade
	for target: Vector2 in _targets:
		var text_position := target + Vector2(0, -14.0 * _progress)
		if dealt > 0:
			_draw_burst(target, DAMAGE, flash, 1.4 if force else 1.0)
			_badge(text_position, "−%d" % dealt, DAMAGE, 25 if force else 21, fade)
			text_position.y += 30.0
		if gate:
			_draw_burst(target, LIGHT, flash, 0.75)
			_badge(text_position, "철문", LIGHT, 16, fade)
		elif blocked > 0 or removed > 0 or added > 0:
			_draw_shield(target, flash)
			var labels: PackedStringArray = []
			if blocked > 0:
				labels.append("막음 %d" % blocked)
			if removed > 0:
				labels.append("가드 −%d" % removed)
			if added > 0:
				labels.append("가드 +%d" % added)
			_badge(text_position, " · ".join(labels), GUARD, 16, fade)
		if recovered > 0:
			_draw_burst(target, HEAL, flash, 0.8)
			_badge(text_position, "+%d" % recovered, HEAL, 18, fade)


func _draw_burst(point: Vector2, color: Color, flash: float, scale_factor: float) -> void:
	draw_circle(point, 15 * scale_factor, Color(color, flash * 0.29), true, -1.0, true)
	for i in 8:
		var direction := Vector2.from_angle(i * TAU / 8 + 0.3)
		var reach := (21.0 + (i % 3) * 4.0 + _progress * 16.0) * scale_factor
		draw_line(point + direction * (7.0 + _progress * 12.0), point + direction * reach,
			Color(color, flash), 2.5, true)


func _draw_shield(point: Vector2, flash: float) -> void:
	var shape := PackedVector2Array([point + Vector2(-15, -14), point + Vector2(0, -20),
		point + Vector2(15, -14), point + Vector2(12, 5), point + Vector2(0, 16),
		point + Vector2(-12, 5), point + Vector2(-15, -14)])
	draw_colored_polygon(shape.slice(0, -1), Color("#4daccd", flash * 0.32))
	draw_polyline(shape, Color(GUARD, flash), 2.5, true)


func _badge(point: Vector2, value: String, color: Color, font_size: int, opacity: float) -> void:
	var font := get_theme_default_font()
	var metrics := font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
	var box := Rect2(Vector2(0, point.y - metrics.y / 2.0 - 3.0), metrics + Vector2(14, 6))
	var offset := point.x + 29.0 if _facing > 0.0 else point.x - box.size.x - 29.0
	box.position.x = clampf(offset, 4.0, maxf(4.0, size.x - box.size.x - 4.0))
	box.position.y = clampf(box.position.y, 4.0, maxf(4.0, size.y - box.size.y - 4.0))
	draw_rect(box, Color("#201b19", opacity * 0.92))
	draw_rect(box, Color(color, opacity * 0.86), false, 1.0, true)
	draw_string(font, box.position + Vector2(7, 3 + font.get_ascent(font_size)), value,
		HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(color, opacity))
