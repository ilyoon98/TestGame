extends Control

const Run := preload("res://combat/threshold_run.gd")
const GameScreen := preload("res://ui/threshold.tscn")
const Codex := preload("res://ui/codex.gd")
const SeedMap := preload("res://world/seed_map.gd")
const FieldUI := preload("res://ui/field_ui.gd")
const TitleLantern := preload("res://ui/title_lantern.gd")
const OPENING_FOLDER := "res://art/opening/"
const PALE := FieldUI.TEXT
const GOLD := FieldUI.BRASS
const MENU_WIDTH := 260
const SPECIAL_ROOM_LABELS := {"shops": "상점", "rests": "휴식", "elites": "강적", "mysteries": "사건"}

var tutorial_path := "user://opening.cfg"
var view := "home"
var step := 0
var seed := ""
var sound_enabled := true
## The lantern-snuffing intro plays before the opening comic in a visible window.
var title_intro := true
var _starting := false
var _lantern = null
var _home_ui: Control
var _training := false
var _tutorial_seen := false
var _data: Dictionary
var _display: Control
var _field: LineEdit
var _codex: Control
var _codex_opener: Control
var _map_options := SeedMap.DEFAULT_OPTIONS.duplicate(true)
var _qa_panel: PanelContainer
var _menus: Dictionary = {}
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
	_starting = false
	view = "home"
	step = 0
	_render()


func _build_home() -> void:
	_lantern = TitleLantern.new()
	_lantern.name = "TitleLantern"
	_display.add_child(_lantern)
	_lantern.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_lantern.snuffed.connect(_enter_opening, CONNECT_DEFERRED)

	_home_ui = Control.new()
	_home_ui.name = "HomeUI"
	_home_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_display.add_child(_home_ui)
	_home_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	var margins := MarginContainer.new()
	margins.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_home_ui.add_child(margins)
	margins.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "top", "right", "bottom"]:
		margins.add_theme_constant_override("margin_" + side, {"left": 72, "top": 64, "right": 44, "bottom": 56}[side])
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	column.custom_minimum_size.x = MENU_WIDTH
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margins.add_child(column)
	var lockup := VBoxContainer.new()
	lockup.name = "TitleLockup"
	lockup.add_theme_constant_override("separation", 0)
	column.add_child(lockup)
	lockup.add_child(FieldUI.label("루치아", 76, FieldUI.TEXT, true))
	lockup.add_child(FieldUI.label("빈콜리의 등불", 24, GOLD, true))
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(spacer)

	_menus.clear()
	var main := _menu_box(column, "MainMenu")
	main.add_child(_menu_button("시작하기", "OpenRun", _show_menu.bind("seed"), true))
	var book := _menu_button("도감", "OpenCodex", _open_codex)
	FieldUI.add_key_hint(book, "D")
	main.add_child(book)
	main.add_child(_menu_button("설정", "OpenSettings", _show_menu.bind("settings")))

	var seed_menu := _menu_box(column, "SeedMenu")
	seed_menu.add_child(_label("시드", 17))
	_field = LineEdit.new()
	_field.name = "Seed"
	_field.placeholder_text = "비우면 무작위"
	_field.accessibility_name = "시드"
	_field.text = seed
	_field.max_length = 24
	_field.custom_minimum_size.y = FieldUI.ACTION_HEIGHT
	_field.text_submitted.connect(func(_value: String): _start())
	seed_menu.add_child(_field)
	var seed_row := HBoxContainer.new()
	seed_row.add_theme_constant_override("separation", 10)
	seed_menu.add_child(seed_row)
	var reroll := _button("무작위", "RandomSeed", func(): _field.text = _random_seed())
	reroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	seed_row.add_child(reroll)
	var depart := _button("출발", "StartRun", _start, true)
	depart.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	seed_row.add_child(depart)
	seed_menu.add_child(_menu_button("뒤로", "SeedBack", _show_menu.bind("main")))

	var settings := _menu_box(column, "SettingsMenu")
	var sound := _menu_button("", "SoundToggle", func(): pass)
	sound.toggle_mode = true
	sound.button_pressed = sound_enabled
	sound.text = "효과음 켬" if sound_enabled else "효과음 끔"
	sound.toggled.connect(func(enabled: bool):
		sound_enabled = enabled
		sound.text = "효과음 켬" if enabled else "효과음 끔")
	settings.add_child(sound)
	settings.add_child(_menu_button("뒤로", "SettingsBack", _show_menu.bind("main")))

	_build_qa_corner()
	_show_menu("main")
	# Touching any title control makes the candle gutter.
	for control: BaseButton in _home_ui.find_children("*", "BaseButton", true, false):
		control.mouse_entered.connect(_lantern.startle)


func _menu_box(parent: Control, id: String) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.name = id
	box.add_theme_constant_override("separation", 10)
	parent.add_child(box)
	_menus[id] = box
	return box


func _menu_button(text_value: String, id: String, action: Callable, primary := false) -> Button:
	var button := _button(text_value, id, action, primary)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.custom_minimum_size.x = MENU_WIDTH
	return button


## Shows one of the title menus: "main", "seed" or "settings".
func _show_menu(mode: String) -> void:
	var id: String = {"main": "MainMenu", "seed": "SeedMenu", "settings": "SettingsMenu"}[mode]
	for key: String in _menus:
		_menus[key].visible = key == id
	var focus: String = {"main": "OpenRun", "seed": "Seed", "settings": "SoundToggle"}[mode]
	(_menus[id].find_child(focus, true, false) as Control).grab_focus()


## QA tools stay out of the way in the top-right corner; map settings live inside them.
func _build_qa_corner() -> void:
	var corner := VBoxContainer.new()
	corner.name = "QACorner"
	corner.add_theme_constant_override("separation", 8)
	corner.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_home_ui.add_child(corner)
	corner.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE, 16)
	var opener := _button("QA", "OpenQA", _toggle_qa)
	FieldUI.style_action(opener, false, true)
	opener.size_flags_horizontal = Control.SIZE_SHRINK_END
	opener.modulate.a = 0.4
	opener.tooltip_text = "QA 훈련장"
	corner.add_child(opener)

	_qa_panel = PanelContainer.new()
	_qa_panel.name = "QAPanel"
	_qa_panel.custom_minimum_size.x = 560
	var panel_style := FieldUI.plate(Color("#211923f5"), FieldUI.RIM)
	panel_style.content_margin_top = 12
	panel_style.content_margin_bottom = 12
	_qa_panel.add_theme_stylebox_override("panel", panel_style)
	corner.add_child(_qa_panel)
	_qa_panel.hide()
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 10)
	_qa_panel.add_child(content)
	content.add_child(_label("QA 훈련장 · 지도 설정", 17))
	_build_map_settings(content)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	actions.alignment = BoxContainer.ALIGNMENT_END
	content.add_child(actions)
	actions.add_child(_button("닫기", "CloseQA", _toggle_qa.bind(false)))
	var training := _button("훈련장 시작", "StartTraining", _start.bind(true), true)
	FieldUI.add_key_hint(training, "T")
	actions.add_child(training)


func _build_map_settings(parent: VBoxContainer) -> void:
	var content := VBoxContainer.new()
	content.name = "MapSettingsPanel"
	content.add_theme_constant_override("separation", 8)
	parent.add_child(content)
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
	_map_widths.text_submitted.connect(func(_value: String): _start(true))
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


func _toggle_qa(open: Variant = null) -> void:
	_qa_panel.visible = not _qa_panel.visible if open == null else bool(open)
	if _qa_panel.visible:
		_map_widths.grab_focus()
	else:
		(_display.find_child("OpenQA", true, false) as Control).grab_focus()

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
	if view != "home" or _starting:
		return
	var options := _read_map_options()
	if not _validate_map(options, training):
		_toggle_qa(true)
		if not options.widths.is_empty():
			_map_counts.shops.grab_focus()
		return
	_map_options = options
	seed = _field.text.strip_edges()
	if seed.is_empty():
		seed = _random_seed()
	_training = training
	step = 0
	if training or not _title_intro_enabled():
		view = "game" if training else "comic"
		_render()
		return
	# Hold the title while the gust snuffs the lantern; `_enter_opening` follows.
	_starting = true
	create_tween().tween_property(_home_ui, "modulate:a", 0.0, 0.3)
	_lantern.snuff()
	if sound_enabled:
		var player := AudioStreamPlayer.new()
		player.name = "TitleSnuff"
		player.stream = TitleLantern.snuff_stream()
		player.finished.connect(player.queue_free)
		add_child(player)
		player.play()


func _title_intro_enabled() -> bool:
	return title_intro and DisplayServer.get_name() != "headless" and is_instance_valid(_lantern)


func _enter_opening() -> void:
	if not _starting or view != "home":
		return
	_starting = false
	view = "comic"
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
	if _starting:
		var press := event is InputEventKey or event is InputEventMouseButton or event is InputEventJoypadButton
		if press and event.is_pressed() and not event.is_echo():
			get_viewport().set_input_as_handled()
			_lantern.finish()
		return
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
		if event.keycode == KEY_ESCAPE:
			if _qa_panel.visible:
				_toggle_qa(false)
			elif not _menus.MainMenu.visible:
				_show_menu("main")
			else:
				return
			get_viewport().set_input_as_handled()
			return
		if get_viewport().gui_get_focus_owner() is LineEdit or event.shift_pressed:
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
