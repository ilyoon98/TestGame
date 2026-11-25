extends SceneTree

const Startup := preload("res://ui/startup.tscn")
const OPTIONS := {"widths": [2, 1, 3, 2], "shops": 2, "rests": 1, "elites": 2, "mysteries": 1}
## The title always climbs every floor; the widths and counts above shape floor 1.
const RUN_OPTIONS := {"widths": [2, 1, 3, 2], "shops": 2, "rests": 1, "elites": 2, "mysteries": 1, "floors": 3}
var _errors: Array[String] = []


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var args := OS.get_cmdline_user_args()
	for size in [Vector2i(1100, 740), Vector2i(900, 650)]:
		var viewport := SubViewport.new()
		viewport.size = size
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(viewport)
		var title := Startup.instantiate()
		var path := "user://map-settings-test-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
		var tutorial := ConfigFile.new()
		tutorial.set_value("opening", "tutorial_v1", true)
		_expect(tutorial.save(path) == OK, "Could not prepare tutorial fixture")
		title.tutorial_path = path
		viewport.add_child(title)
		await process_frame
		_expect(not _control(title, "QAPanel").visible, "QA tools and map settings start hidden")
		_press(title, "OpenQA")
		_expect(viewport.gui_get_focus_owner() == _control(title, "MapWidths"), "Opening settings focuses the width field")

		var status := _control(title, "MapSettingsStatus") as Label
		_expect(status.text.contains("일반 전투 7개"), "Default has eleven rooms and four special rooms")
		for invalid in ["", "0,2", "4,2", "1,1,1,1,1", "2,,3", "2.5,3"]:
			_write(title, "MapWidths", invalid)
			_press(title, "StartRun")
			_expect(title.view == "home" and status.text.contains("1~4"), "Invalid widths must be rejected: " + invalid)
		_press(title, "StartTraining")
		_expect(title.view == "home", "Training also validates stage widths")
		_write(title, "MapWidths", " 2, 1,3, 2 ")
		_choose(title, "shops", 12)
		_press(title, "StartRun")
		_expect(title.view == "home" and status.text.contains("넘습니다"), "Too many special rooms must be rejected")
		for kind: String in OPTIONS:
			if kind != "widths":
				_choose(title, kind, OPTIONS[kind])
		_write(title, "Seed", "  격리문-04  ")
		_expect(status.text == "구간 방 8개, 일반 전투 2개", "Summary reflects edits")
		await process_frame
		for id in ["QAPanel", "MapSettingsPanel", "StartTraining"]:
			_check_bounds(_control(title, id), size)
		if args.size() == 1 and size.x == 900:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-map-settings.png")

		_press(title, "StartRun")
		_expect(title.view == "comic", "Custom map starts through the normal opening")
		_press(title, "OpeningSkip")
		var game: Control = title._display
		game.set_process(false)
		var run: RefCounted = game.run
		_expect(run.seed == "격리문-04" and run.map_options == RUN_OPTIONS, "Settings and trimmed seed reach the run")
		var layout: Dictionary = run.data.map
		_check_layout(layout)
		_fight_to_route(title, game)
		await process_frame
		var map := _control(title, "RouteMap")
		_expect(title.find_children("Move_room-*", "Button", true, false).size() == 2, "First fork uses custom width")
		for cell: Control in map.get_children():
			_expect(map.get_global_rect().encloses(cell.get_global_rect()), "Room tile extends beyond the route")
		if args.size() == 1 and size.x == 900:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-custom-route.png")

		run._lose("pursuit")
		game._show()
		_press(title, "Restart")
		_expect(game.run.data.map == layout and game.run.map_options == RUN_OPTIONS, "Retry reproduces the configured layout")
		_press(title, "ReturnTitle")
		_press(title, "OpenQA")
		_expect(_control(title, "MapWidths").text == "2,1,3,2", "Returning to title keeps the selected widths")
		_expect(_control(title, "Map_elites").selected == 2, "Returning to title keeps special room counts")
		_write(title, "MapWidths", "1,1,1,1")
		_choose(title, "shops", 12)
		_press(title, "StartTraining")
		run = title._display.run
		_expect(run.training and run.area == "threshold", "QA opens with the validated widths")
		_expect(run.map_options.widths == [1, 1, 1, 1] and run.data.map.size() == 6,
			"QA uses the selected widths and omits the exit")
		_expect(run.data.map.values().all(func(room): return room.type in ["battle", "boss"]),
			"QA uses encounters regardless of special counts")
		viewport.free()
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	for error: String in _errors:
		push_error(error)
	if _errors.is_empty():
		print("Map settings, validation, custom route, same-seed retry and QA passed at 1100×740 and 900×650")
	quit(0 if _errors.is_empty() else 1)


func _check_layout(layout: Dictionary) -> void:
	var columns := [0, 0, 0, 0]
	var counts := {"battle": 0, "shop": 0, "rest": 0, "elite": 0, "mystery": 0}
	for id: String in layout:
		if id.begins_with("room-"):
			var room: Dictionary = layout[id]
			columns[room.col - 2] += 1
			counts[room.type] += 1
	_expect(columns == OPTIONS.widths, "Each generated column matches its requested width")
	_expect(counts == {"battle": 2, "shop": 2, "rest": 1, "elite": 2, "mystery": 1}, "Generated room counts must match")


func _fight_to_route(title: Control, game: Control) -> void:
	_press(title, "BeginCombat")
	for tick in 500:
		if game.run.phase != "combat" and game._hold == 0:
			break
		game._process(0.1)
	_press(title, "Recruit_guard")
	_press(title, "SkipReward")


func _control(parent: Node, id: String) -> Control:
	return parent.find_child(id, true, false) as Control


func _press(parent: Node, id: String) -> void:
	var button := _control(parent, id) as Button
	_expect(is_instance_valid(button) and not button.disabled, "Button unavailable: " + id)
	if is_instance_valid(button):
		if button.toggle_mode:
			button.button_pressed = not button.button_pressed
		button.pressed.emit()


func _write(parent: Node, id: String, value: String) -> void:
	var input := _control(parent, id) as LineEdit
	input.text = value
	input.text_changed.emit(input.text)


func _choose(parent: Node, key: String, count: int) -> void:
	var picker := _control(parent, "Map_" + key) as OptionButton
	picker.select(count)
	picker.item_selected.emit(count)


func _check_bounds(control: Control, size: Vector2i) -> void:
	_expect(Rect2(Vector2.ZERO, size).encloses(control.get_global_rect()), String(control.name) + " outside viewport")


func _capture(viewport: SubViewport, directory: String, filename: String) -> void:
	_expect(viewport.get_texture().get_image().save_png(directory.path_join(filename)) == OK, "Capture failed")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_errors.append(message)
