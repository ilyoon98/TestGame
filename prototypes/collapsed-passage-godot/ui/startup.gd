extends Control

const Run := preload("res://combat/threshold_run.gd")
const GameScreen := preload("res://ui/threshold.tscn")
const Codex := preload("res://ui/codex.gd")
const SeedMap := preload("res://world/seed_map.gd")
const FieldUI := preload("res://ui/field_ui.gd")
const OPENING_FOLDER := "res://art/opening/"
const PALE := FieldUI.TEXT
const GOLD := FieldUI.BRASS
const SPECIAL_ROOM_LABELS := {"shops": "상점", "rests": "휴식", "elites": "강적", "mysteries": "사건"}

var tutorial_path := "user://opening.cfg"
var view := "home"
var step := 0
var seed := ""
var sound_enabled := true
var _training := false
var _tutorial_seen := false
var _data: Dictionary
var _display: Control
var _field: LineEdit
var _codex: Control
var _codex_opener: Control
var _map_options := SeedMap.DEFAULT_OPTIONS.duplicate(true)
var _map_panel: PanelContainer
var _map_toggle: Button
var _map_widths: LineEdit
var _map_counts: Dictionary = {}
var _map_status: Label


func _ready() -> void:
	if get_parent() == get_tree().root:
		get_tree().root.min_size = FieldUI.WINDOW_MIN
	_data = JSON.parse_string(FileAccess.get_file_as_string("res://data/threshold.json"))
	var save := ConfigFile.new()
	if save.load(tutorial_path) == OK:
		_tutorial_seen = save.get_value("opening", "tutorial_v1", false) == true
	theme = FieldUI.make_theme()
	_render()


func _render() -> void:
	if is_instance_valid(_display):
		remove_child(_display)
		_display.queue_free()
	if view == "game":
		var game := GameScreen.instantiate()
		game.run = Run.new(seed, _map_options, _training)
		game.sound_enabled = sound_enabled
		game.sound_changed.connect(func(enabled: bool): sound_enabled = enabled)
		game.return_to_title.connect(_show_home)
		game.codex_requested.connect(_open_codex)
		_display = game
		add_child(game)
		return
	_display = Control.new()
	add_child(_display)
	_display.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if view == "home":
		_build_home()
	else:
		_build_pages()


func _show_home() -> void:
	view = "home"
	step = 0
	_render()


func _build_home() -> void:
	var backdrop := _texture(_comic_path(0))
	backdrop.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_display.add_child(backdrop)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	var shaded := TextureRect.new()
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color("#17101c0a"), Color("#130c15ef")])
	var lighting := GradientTexture2D.new()
	lighting.gradient = gradient
	lighting.fill_from = Vector2(0.55, 0.07)
	lighting.fill_to = Vector2(0.27, 0.95)
	shaded.texture = lighting
	shaded.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	shaded.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_display.add_child(shaded)
	shaded.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	var content := _page(44)
	content.alignment = BoxContainer.ALIGNMENT_END
	var lockup := HBoxContainer.new()
	lockup.add_theme_constant_override("separation", 17)
	content.add_child(lockup)
	var seal := FieldUI.mark("seal", GOLD, 66)
	seal.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	lockup.add_child(seal)
	lockup.add_child(FieldUI.label("붕괴 통로", 70, FieldUI.TEXT, true))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	content.add_child(row)
	_field = LineEdit.new()
	_field.name = "Seed"
	_field.placeholder_text = "비우면 무작위"
	_field.text = seed
	_field.max_length = 24
	_field.custom_minimum_size.x = 195
	_field.text_submitted.connect(func(_value: String): _start())
	row.add_child(_label("시드", 17))
	row.add_child(_field)
	var reroll := _button("무작위", "RandomSeed", func(): _field.text = _random_seed())
	row.add_child(reroll)
	_map_toggle = _button("지도 설정", "MapSettings", _toggle_map_settings)
	_map_toggle.toggle_mode = true
	row.add_child(_map_toggle)
	var start := _button("시작하기", "StartRun", _start, true)
	row.add_child(start)
	var training := _button("QA 훈련장", "StartTraining", _start.bind(true))
	row.add_child(training)
	FieldUI.add_key_hint(training, "T")
	var book := _button("도감", "OpenCodex", _open_codex)
	row.add_child(book)
	FieldUI.add_key_hint(book, "D")
	_build_map_settings(content)
	start.grab_focus()


func _build_map_settings(parent: VBoxContainer) -> void:
	_map_panel = PanelContainer.new()
	_map_panel.name = "MapSettingsPanel"
	var panel_style := FieldUI.plate(Color("#211923f5"), FieldUI.RIM)
	panel_style.content_margin_top = 12
	panel_style.content_margin_bottom = 12
	_map_panel.add_theme_stylebox_override("panel", panel_style)
	parent.add_child(_map_panel)
	_map_panel.hide()
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 8)
	_map_panel.add_child(content)
	var fields := HBoxContainer.new()
	fields.add_theme_constant_override("separation", 10)
	content.add_child(fields)

	_map_widths = LineEdit.new()
	_map_widths.name = "MapWidths"
	_map_widths.text = ",".join(_map_options.widths)
	_map_widths.placeholder_text = "예: 3,2,3"
	_map_widths.max_length = 12
	_map_widths.accessibility_name = "구간별 방 수"
	_map_widths.text_changed.connect(func(_value: String): _refresh_map_status())
	_map_widths.text_submitted.connect(func(_value: String): _start())
	_add_map_field(fields, "구간별 방 수", _map_widths)

	_map_counts.clear()
	for key: String in SPECIAL_ROOM_LABELS:
		var select := OptionButton.new()
		select.name = "Map_" + key
		select.accessibility_name = SPECIAL_ROOM_LABELS[key] + " 방 수"
		for count in range(SeedMap.MAX_STAGES * SeedMap.MAX_STAGE_ROOMS + 1):
			select.add_item(str(count))
		select.select(_map_options[key])
		select.item_selected.connect(func(_index: int): _refresh_map_status())
		_add_map_field(fields, SPECIAL_ROOM_LABELS[key], select)
		_map_counts[key] = select

	_map_status = _label("", 15)
	_map_status.name = "MapSettingsStatus"
	_map_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(_map_status)
	_refresh_map_status()


func _add_map_field(fields: HBoxContainer, title: String, input: Control) -> void:
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fields.add_child(column)
	column.add_child(_label(title, 15))
	input.custom_minimum_size.y = 38
	column.add_child(input)


func _toggle_map_settings() -> void:
	_map_panel.visible = _map_toggle.button_pressed
	if _map_panel.visible:
		_map_widths.grab_focus()


func _read_map_options() -> Dictionary:
	var options := {"widths": SeedMap.parse_widths(_map_widths.text)}
	for key: String in _map_counts:
		options[key] = _map_counts[key].selected
	return options


func _refresh_map_status() -> void:
	_validate_map(_read_map_options())


func _validate_map(options: Dictionary, training := false) -> bool:
	var total := 0
	var special := 0
	for width: int in options.widths:
		total += width
	for key: String in SPECIAL_ROOM_LABELS:
		special += options[key]
	if total == 0:
		_map_status.text = "구간 1~4개, 방 1~3개씩 입력하세요. 예: 3,2,3"
	elif special > total:
		_map_status.text = "특수 방 %d개가 전체 방 %d개를 넘습니다." % [special, total]
	else:
		_map_status.text = "구간 방 %d개, 일반 전투 %d개" % [total, total - special]
	_map_status.add_theme_color_override("font_color", Color("#ef9b7a") if total == 0 or special > total else PALE)
	return total > 0 and (training or special <= total)


func _build_pages() -> void:
	var page := _page(20)
	if view == "comic":
		var image := _texture(_comic_path(step))
		image.name = "ComicImage"
		image.tooltip_text = FieldUI.display_copy(_data.openingPanels[step][1])
		image.accessibility_name = image.tooltip_text
		image.size_flags_vertical = Control.SIZE_EXPAND_FILL
		page.add_child(image)
	else:
		var lesson: Array = _data.openingLessons[step]
		var center := CenterContainer.new()
		center.size_flags_vertical = Control.SIZE_EXPAND_FILL
		page.add_child(center)
		var box := VBoxContainer.new()
		box.add_theme_constant_override("separation", 16)
		center.add_child(box)
		var icon_id: String = "tutorial-battle" if lesson[1] == "routeBattle" else lesson[1]
		var icon := _texture("res://art/route/" + icon_id + ".svg")
		icon.custom_minimum_size = Vector2(80, 80)
		icon.modulate = GOLD
		box.add_child(icon)
		var title := _label(lesson[0], 42)
		title.name = "LessonTitle"
		title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		box.add_child(title)
		var description := _label(lesson[2], 20)
		if step == 0:
			description.text = "대원을 고르고 전위, 중위 또는 후위를 눌러 배치하세요.\n적의 일반 공격은 맨 앞을 노립니다."
		description.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		description.custom_minimum_size.x = minf(550, maxf(200, size.x - 60))
		box.add_child(description)
	var total: int = _data.openingPanels.size() if view == "comic" else _data.openingLessons.size()
	var navigation := HBoxContainer.new()
	navigation.add_theme_constant_override("separation", 10)
	page.add_child(navigation)
	navigation.add_child(_button("건너뛰기", "OpeningSkip", _advance.bind(true)))
	var count := _label("%d / %d" % [step + 1, total], 16)
	count.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	count.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	navigation.add_child(count)
	var previous := _button("이전", "OpeningBack", _back)
	previous.disabled = step == 0
	navigation.add_child(previous)
	var next_label := "다음"
	if step + 1 == total:
		next_label = "계속" if view == "comic" else "전투 준비"
	var next := _button(next_label, "OpeningNext", _advance, true)
	navigation.add_child(next)
	next.grab_focus()


func _start(training := false) -> void:
	if view != "home":
		return
	var options := _read_map_options()
	if not _validate_map(options, training):
		_map_toggle.set_pressed_no_signal(true)
		_toggle_map_settings()
		if not options.widths.is_empty():
			_map_counts.shops.grab_focus()
		return
	_map_options = options
	seed = _field.text.strip_edges()
	if seed.is_empty():
		seed = _random_seed()
	_training = training
	view = "game" if training else "comic"
	step = 0
	_render()


func _back() -> void:
	if step > 0:
		step -= 1
		_render()


func _advance(skip := false) -> void:
	var total: int = _data.openingPanels.size() if view == "comic" else _data.openingLessons.size()
	if not skip and step + 1 < total:
		step += 1
	elif view == "comic" and not _tutorial_seen:
		view = "tutorial"
		step = 0
	else:
		if view == "tutorial":
			_tutorial_seen = true
			var save := ConfigFile.new()
			save.set_value("opening", "tutorial_v1", true)
			var error := save.save(tutorial_path)
			if error != OK:
				push_warning("Tutorial progress could not be saved: " + error_string(error))
		view = "game"
	_render()


func _input(event: InputEvent) -> void:
	if is_instance_valid(_codex) and _codex.visible:
		if event.is_action_pressed("ui_cancel"):
			get_viewport().set_input_as_handled()
			_close_codex()
		return
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.ctrl_pressed or event.alt_pressed or event.meta_pressed:
		return
	if view == "home":
		if get_viewport().gui_get_focus_owner() == _field or event.shift_pressed:
			return
		if event.keycode == KEY_D:
			_open_codex()
		elif event.keycode == KEY_T:
			_start(true)
		else:
			return
	elif view not in ["comic", "tutorial"]:
		return
	elif event.keycode == KEY_LEFT:
		_back()
	elif event.keycode == KEY_RIGHT:
		_advance()
	else:
		return
	get_viewport().set_input_as_handled()


func _open_codex() -> void:
	if not is_instance_valid(_codex):
		_codex = Codex.new()
		_codex.name = "Codex"
		_codex.setup(_data)
		_codex.dismissed.connect(_close_codex)
		add_child(_codex)
		_codex.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_codex_opener = _display.find_child("OpenCodex", true, false)
	_display.hide()
	move_child(_codex, -1)
	_codex.show()
	_codex.focus_close()


func _close_codex() -> void:
	_codex.hide()
	_display.show()
	if is_instance_valid(_codex_opener):
		_codex_opener.grab_focus()


func _random_seed() -> String:
	return Crypto.new().generate_random_bytes(4).hex_encode().to_upper()


func _comic_path(index: int) -> String:
	return OPENING_FOLDER + _data.openingPanels[index][0] + ".webp"


func _page(margin: int) -> VBoxContainer:
	var margins := MarginContainer.new()
	_display.add_child(margins)
	margins.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margins.add_theme_constant_override("margin_" + side, margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 16)
	margins.add_child(column)
	return column


func _texture(path: String) -> TextureRect:
	var image := TextureRect.new()
	image.texture = load(path)
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	return image


func _label(value: String, font_size: int) -> Label:
	return FieldUI.label(value, font_size, FieldUI.TEXT, font_size >= 24)


func _button(text_value: String, id: String, action: Callable, primary := false) -> Button:
	var button := Button.new()
	button.name = id
	button.text = text_value
	FieldUI.style_action(button, primary)
	button.pressed.connect(action)
	return button
