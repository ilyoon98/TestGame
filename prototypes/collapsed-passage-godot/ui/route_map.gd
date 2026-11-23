extends Control

signal room_chosen(id: String)
signal travel_finished(id: String)

const TYPES := {
	"battle": ["전투", Color("#9bd8be")],
	"rest": ["휴식", Color("#91cbdc")],
	"boss": ["보스", Color("#ef9b7a")],
	"exit": ["출구", Color("#e8cea1")],
	"shop": ["상점", Color("#e5b970")],
	"elite": ["강적", Color("#ef9b7a")],
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
		cell.anchor_left = (room.col - 1) / columns
		cell.anchor_right = room.col / columns
		cell.anchor_top = (room.row - 1) / ROWS
		cell.anchor_bottom = room.row / ROWS
		cell.offset_left = INSET
		cell.offset_right = -INSET
		cell.offset_top = INSET
		cell.offset_bottom = -INSET
		cell.resized.connect(queue_redraw)


func first_move() -> Button:
	return null if _buttons.is_empty() else _buttons.values()[0]


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
	button.text = room.name
	button.tooltip_text = "%s · 이동 가능" % TYPES[room.type][0]
	button.icon = load("res://art/route/%s.svg" % room.type)
	button.add_theme_color_override("icon_normal_color", TYPES[room.type][1])
	button.add_theme_stylebox_override("normal", _tile_style(Color("#203731"), Color("#689f8a")))
	button.pressed.connect(func(): room_chosen.emit(id))
	_buttons[id] = button
	return button


func _room_tile(room: Dictionary, state: String, next: bool) -> PanelContainer:
	var panel := PanelContainer.new()
	var current := state == "현재 위치"
	var background := Color("#3d3223") if current else Color("#203731") if next else Color("#1a221b")
	var border := Color("#efc58a") if current else Color("#689f8a") if next else Color("#41483b")
	panel.tooltip_text = "%s · %s" % [room.name, TYPES[room.type][0]]
	panel.add_theme_stylebox_override("panel", _tile_style(background, border))
	var content := VBoxContainer.new()
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 1)
	panel.add_child(content)
	var symbol := TextureRect.new()
	symbol.texture = load("res://art/route/%s.svg" % room.type)
	symbol.custom_minimum_size.y = 18
	symbol.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	symbol.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	symbol.modulate = TYPES[room.type][1]
	content.add_child(symbol)
	var title := Label.new()
	title.text = room.name
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(title)
	if not state.is_empty():
		var caption := Label.new()
		caption.text = state
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		caption.add_theme_font_size_override("font_size", 12)
		caption.modulate = border.lightened(0.2)
		content.add_child(caption)
	return panel


func _tile_style(color: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(6)
	return style


func _draw() -> void:
	for id: String in _rooms:
		for dest: String in _rooms[id].next:
			var a: Control = _cells[id]
			var b: Control = _cells[dest]
			var walked := _walked.has(id + "→" + dest)
			var traveling := id == _travel_from and dest == _travel_to
			var color := Color("#d2f1d9") if traveling else Color("#86bd9e") if walked else Color("#526156")
			var start := a.position + Vector2(a.size.x, a.size.y * 0.5)
			var finish := b.position + Vector2(0, b.size.y * 0.5)
			draw_line(start, finish, color, 2.0, true)
