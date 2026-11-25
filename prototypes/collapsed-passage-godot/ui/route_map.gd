extends Control

signal room_chosen(id: String)
signal travel_finished(id: String)

const FieldUI := preload("res://ui/field_ui.gd")
const TYPES := {
	"battle": ["전투", FieldUI.ALLY],
	"rest": ["휴식", Color("#91cbdc")],
	"boss": ["보스", FieldUI.DANGER],
	"exit": ["출구", FieldUI.BRASS],
	"shop": ["상점", Color("#e5b970")],
	"elite": ["강적", Color("#eeb4ac")],
	"mystery": ["사건", Color("#bea6d2")],
	"ascend": ["위층", FieldUI.BRASS],
}
const ROWS := 3.0
const INSET := 7
const MEDALLION := "res://art/route/medallions/%s.webp"
const NEXT_RING := Color("#82b39f")
var _rooms: Dictionary
var _walked: Dictionary = {}
var _buttons: Dictionary = {}
var _cells: Dictionary = {}
var _icons: Dictionary = {}
var _current := ""
var _reachable: Array = []
var _done: Dictionary = {}
var _travel_from := ""
var _travel_to := ""
var _traveler: TextureRect


func setup(rooms: Dictionary, trail: Array, reachable: Array, preview := false, next_label := "다음 방") -> void:
	_rooms = rooms
	for i in range(1, trail.size()):
		_walked[trail[i - 1] + "→" + trail[i]] = true
	_current = trail.back()
	_reachable = reachable
	for id: String in trail:
		_done[id] = true
	var columns := 1.0
	for room: Dictionary in rooms.values():
		columns = maxf(columns, room.col)
	custom_minimum_size = Vector2(0, 252)
	resized.connect(queue_redraw)
	for id: String in rooms:
		var room: Dictionary = rooms[id]
		var current: bool = id == trail.back()
		var next := reachable.has(id)
		var state := "현재 위치" if current else next_label if next and preview else "완료" if trail.has(id) else ""
		var cell: Control = _room_button(id, room) if next and not preview else _room_tile(id, room, state, next)
		if preview:
			cell.name = "Preview_" + id
		_cells[id] = cell
		add_child(cell)
		cell.anchor_left = (room.col - 0.88) / columns
		cell.anchor_right = (room.col - 0.12) / columns
		cell.anchor_top = (room.row - 1) / ROWS
		cell.anchor_bottom = room.row / ROWS
		cell.offset_left = INSET
		cell.offset_right = -INSET
		cell.offset_top = INSET
		cell.offset_bottom = -INSET
		cell.resized.connect(queue_redraw)


func first_move() -> Button:
	var moves := move_buttons()
	return null if moves.is_empty() else moves[0]


func move_buttons() -> Array[Button]:
	var ids := _buttons.keys()
	ids.sort_custom(func(a: String, b: String):
		var left: Dictionary = _rooms[a]
		var right: Dictionary = _rooms[b]
		return left.row < right.row if left.col == right.col else left.col < right.col)
	var ordered: Array[Button] = []
	for id: String in ids:
		ordered.append(_buttons[id])
	return ordered


func animate_travel(origin: String, destination: String) -> void:
	_travel_from = origin
	_travel_to = destination
	for button: Button in _buttons.values():
		button.disabled = true
	_traveler = TextureRect.new()
	_traveler.texture = load("res://art/route/runner.svg")
	_traveler.modulate = Color("#d7f6df")
	_traveler.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_traveler)
	_set_travel_progress(0.0)
	var tween := create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_method(_set_travel_progress, 0.0, 1.0, 0.48)
	tween.finished.connect(func(): travel_finished.emit(destination))


func _set_travel_progress(progress: float) -> void:
	var from: Vector2 = _disc(_travel_from)[0]
	var to: Vector2 = _disc(_travel_to)[0]
	_traveler.position = from.lerp(to, progress) - _traveler.size / 2.0
	queue_redraw()


func _room_button(id: String, room: Dictionary) -> Button:
	var button := Button.new()
	button.name = "Move_" + id
	button.custom_minimum_size.y = FieldUI.ACTION_HEIGHT
	button.tooltip_text = "%s (%s)
이동 가능" % [room.name, TYPES[room.type][0]]
	button.accessibility_name = button.tooltip_text
	for state in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		button.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	var content := _room_face(id, room, NEXT_RING)
	button.add_child(content)
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	button.pressed.connect(func(): room_chosen.emit(id))
	for change in [button.mouse_entered, button.mouse_exited, button.focus_entered, button.focus_exited]:
		change.connect(queue_redraw)
	_buttons[id] = button
	return button


func _room_tile(id: String, room: Dictionary, state: String, next: bool) -> PanelContainer:
	var panel := PanelContainer.new()
	var ink := FieldUI.BRASS if state == "현재 위치" else NEXT_RING if next else FieldUI.MUTED if state == "완료" else FieldUI.MUTED.darkened(0.25)
	panel.tooltip_text = "%s (%s)" % [room.name, TYPES[room.type][0]]
	if not state.is_empty():
		panel.tooltip_text += "
" + state
	panel.accessibility_name = panel.tooltip_text
	panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	panel.add_child(_room_face(id, room, ink))
	return panel


## A painted medallion for the room type with the room name under it.
func _room_face(id: String, room: Dictionary, ink: Color) -> VBoxContainer:
	var face := VBoxContainer.new()
	face.mouse_filter = Control.MOUSE_FILTER_IGNORE
	face.alignment = BoxContainer.ALIGNMENT_CENTER
	face.add_theme_constant_override("separation", 2)
	var icon := TextureRect.new()
	icon.name = "Medallion"
	icon.texture = load(MEDALLION % room.type)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(FieldUI.GLYPH_SIZE, FieldUI.GLYPH_SIZE + 12)
	icon.size_flags_vertical = Control.SIZE_EXPAND_FILL
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon.resized.connect(queue_redraw)
	face.add_child(icon)
	_icons[id] = icon
	var title := FieldUI.label(room.name, 13, ink)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	face.add_child(title)
	return face


## Centre and radius of a room's medallion in this control's space.
func _disc(id: String) -> Array:
	var icon: TextureRect = _icons[id]
	var box := Rect2(icon.global_position - global_position, icon.size)
	return [box.get_center(), minf(box.size.x, box.size.y) / 2.0]


func _draw() -> void:
	for id: String in _rooms:
		for dest: String in _rooms[id].next:
			var walked := _walked.has(id + "→" + dest)
			var traveling := id == _travel_from and dest == _travel_to
			var color := FieldUI.BRASS if traveling else Color("#b5a77e") if walked else Color("#6b5b56")
			draw_line(_disc(id)[0], _disc(dest)[0], color, 3.0 if walked or traveling else 2.0, true)
	for id: String in _icons:
		var disc := _disc(id)
		var ring := Color.TRANSPARENT
		var width := 3.0
		if id == _current:
			ring = FieldUI.BRASS
		elif _buttons.has(id):
			var button: Button = _buttons[id]
			ring = NEXT_RING.lightened(0.35) if button.is_hovered() or button.has_focus() else NEXT_RING
			width = 4.0 if button.has_focus() else 3.0
		elif _reachable.has(id):
			ring = NEXT_RING
		if ring.a > 0:
			draw_arc(disc[0], disc[1] + 4.0, 0.0, TAU, 48, ring, width, true)
		if _done.has(id) and id != _current:
			draw_circle(disc[0], disc[1] * 0.98, Color(0, 0, 0, 0.45))
