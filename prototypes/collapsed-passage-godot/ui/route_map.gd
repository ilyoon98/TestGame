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
}
const ROWS := 3.0
const INSET := 7
var _rooms: Dictionary
var _walked: Dictionary = {}
var _buttons: Dictionary = {}
var _cells: Dictionary = {}
var _travel_from := ""
var _travel_to := ""
var _traveler: TextureRect


func setup(rooms: Dictionary, trail: Array, reachable: Array, preview := false, next_label := "다음 방") -> void:
	_rooms = rooms
	for i in range(1, trail.size()):
		_walked[trail[i - 1] + "→" + trail[i]] = true
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
		var cell: Control = _room_button(id, room) if next and not preview else _room_tile(room, state, next)
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
	var from: Vector2 = _cells[_travel_from].get_rect().get_center()
	var to: Vector2 = _cells[_travel_to].get_rect().get_center()
	_traveler.position = from.lerp(to, progress) - _traveler.size / 2.0
	queue_redraw()


func _room_button(id: String, room: Dictionary) -> Button:
	var button := Button.new()
	button.name = "Move_" + id
	button.custom_minimum_size.y = FieldUI.ACTION_HEIGHT
	button.tooltip_text = "%s (%s)\n이동 가능" % [room.name, TYPES[room.type][0]]
	button.accessibility_name = button.tooltip_text
	button.add_theme_stylebox_override("normal", FieldUI.plate(Color("#263731"), Color("#82b39f"), 0))
	button.add_theme_stylebox_override("hover", FieldUI.plate(Color("#354940"), FieldUI.ALLY, 0))
	var content := _room_face(room)
	button.add_child(content)
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 3
	content.offset_right = -3
	button.pressed.connect(func(): room_chosen.emit(id))
	_buttons[id] = button
	return button


func _room_tile(room: Dictionary, state: String, next: bool) -> PanelContainer:
	var panel := PanelContainer.new()
	var current := state == "현재 위치"
	var background := Color("#412e26") if current else Color("#263731") if next else FieldUI.IRON
	var border := FieldUI.BRASS if current else Color("#82b39f") if next else FieldUI.RIM
	panel.tooltip_text = "%s (%s)" % [room.name, TYPES[room.type][0]]
	if not state.is_empty():
		panel.tooltip_text += "\n" + state
	panel.accessibility_name = panel.tooltip_text
	panel.add_theme_stylebox_override("panel", FieldUI.plate(background, border, 3))
	var content := _room_face(room)
	panel.add_child(content)
	if not state.is_empty():
		var caption := FieldUI.label(state, 13, border.lightened(0.25))
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		caption.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		content.add_child(caption)
	return panel


func _room_face(room: Dictionary) -> VBoxContainer:
	var face := VBoxContainer.new()
	face.mouse_filter = Control.MOUSE_FILTER_IGNORE
	face.alignment = BoxContainer.ALIGNMENT_CENTER
	face.add_theme_constant_override("separation", 1)
	face.add_child(FieldUI.mark(room.type, TYPES[room.type][1]))
	var title := FieldUI.label(room.name, 15)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	face.add_child(title)
	return face


func _draw() -> void:
	for id: String in _rooms:
		for dest: String in _rooms[id].next:
			var a: Control = _cells[id]
			var b: Control = _cells[dest]
			var walked := _walked.has(id + "→" + dest)
			var traveling := id == _travel_from and dest == _travel_to
			var color := FieldUI.BRASS if traveling else Color("#b5a77e") if walked else Color("#6b5b56")
			var start := a.position + Vector2(a.size.x, a.size.y * 0.5)
			var finish := b.position + Vector2(0, b.size.y * 0.5)
			draw_line(start, finish, color, 2.0, true)
