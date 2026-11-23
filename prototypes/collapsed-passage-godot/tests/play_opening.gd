extends SceneTree

const Startup := preload("res://ui/startup.tscn")
var _errors: Array[String] = []
var _capture_dir := ""


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var args := OS.get_cmdline_user_args()
	_capture_dir = args[0] if args.size() == 1 else ""
	for skip in [false, true]:
		var size := Vector2i(900, 650) if skip else Vector2i(1100, 740)
		var vp := SubViewport.new()
		vp.size = size
		vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(vp)
		var path := "user://opening-test-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
		var opening := _create(vp, path)
		await process_frame
		_focus(vp, size, "home")
		var field := opening.find_child("Seed", true, false) as LineEdit
		if not skip:
			field.text = "감옥-A24"
			await _capture(vp, "godot-seed-start")
		_press(opening, "StartRun")
		_expect(opening.view == "comic", "A new run must show the comic")
		await process_frame
		_focus(vp, size, "comic")
		if not skip:
			var images := {}
			for page in 8:
				var comic := opening.find_child("ComicImage", true, false) as TextureRect
				_expect(comic != null and comic.texture != null, "Comic page texture missing")
				if comic and comic.texture:
					images[comic.texture.resource_path] = true
				if page == 2:
					await _capture(vp, "godot-opening-prayer")
					_press(opening, "OpeningBack")
					_expect(opening.step == 1, "Previous should return one panel")
					_press(opening, "OpeningNext")
				_press(opening, "OpeningNext")
			_expect(images.size() == 8, "Every comic page should use its own art")
		else:
			_press(opening, "OpeningSkip")
		_expect(opening.view == "tutorial", "First run must show the tutorial even after skipping the comic")
		_expect(not FileAccess.file_exists(path), "Launching the tutorial is not completion")
		await process_frame
		_focus(vp, size, "tutorial")
		if skip:
			_press(opening, "OpeningSkip")
		else:
			await _capture(vp, "godot-first-play-tutorial")
			for title in ["대열", "자동 전투", "추격"]:
				var lesson := opening.find_child("LessonTitle", true, false) as Label
				_expect(lesson != null and lesson.text == title, "Lesson order differs")
				_press(opening, "OpeningNext")
		await process_frame
		_focus(vp, size, "battle preparation")
		_expect(opening.view == "game", "Tutorial end must open the game")
		var run: RefCounted = opening._display.run
		var seed: String = opening.seed
		_expect(run.area == "threshold" and run.phase == "prep", "Must land at Threshold preparation")
		_expect(run.seed == seed and not seed.is_empty(), "Seed must be set on the run")
		_expect(seed == "감옥-A24" if not skip else seed.length() == 8, "Manual or random seed not propagated")
		_expect(run.data.map.has("room-1-1") and not run.data.map.has("duct"), "Normal play must use a generated map")
		var layout: Dictionary = run.data.map.duplicate(true)
		_expect(FileAccess.file_exists(path), "Completion or skip must persist")
		_press(opening, "ReturnTitle")
		_expect(opening.view == "home", "Title should let the player enter another seed")
		opening.free()

		# New scene instance must load the persisted flag without any in-memory state.
		opening = _create(vp, path)
		await process_frame
		field = opening.find_child("Seed", true, false) as LineEdit
		field.text = seed
		_press(opening, "StartRun")
		_expect(opening.view == "comic", "The comic stays available on subsequent runs")
		_press(opening, "OpeningSkip")
		_expect(opening.view == "game", "The second run must bypass the tutorial")
		await process_frame
		var replay: Control = opening._display
		_expect(replay.run.data.map == layout, "Re-entering a seed must reproduce the map")
		_fight_to_map(opening)
		await process_frame
		_focus(vp, size, "seeded map")
		_expect(replay.run.coins == 1, "Winning a seeded fight should award a coin")
		_expect(opening.find_children("Move_room-*", "Button", true, false).size() == 3, "First seeded fork must be playable")
		if not skip:
			await _capture(vp, "godot-seeded-route")
			opening.free()
			await _check_market_and_mystery(vp, path)
		vp.free()
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	if not _errors.is_empty():
		for error in _errors:
			push_error(error)
		quit(1)
		return
	print("Opening, tutorial completion and skip, saved flag, same-seed replay, market and mystery UI passed")
	quit()


func _create(parent: SubViewport, path: String) -> Control:
	var opening := Startup.instantiate()
	opening.tutorial_path = path
	parent.add_child(opening)
	return opening


func _fight_to_map(opening: Control) -> void:
	var game: Control = opening._display
	_press(opening, "BeginCombat")
	game.set_process(false)
	for i in 500:
		if game.run.phase != "combat" and game._hold == 0:
			break
		game._process(0.1)
	_press(opening, "Recruit_guard")
	_press(opening, "SkipReward")


func _check_market_and_mystery(vp: SubViewport, path: String) -> void:
	var opening := _create(vp, path)
	await process_frame
	var field := opening.find_child("Seed", true, false) as LineEdit
	field.text = "2"
	_press(opening, "StartRun")
	_press(opening, "OpeningSkip")
	_fight_to_map(opening)
	var game: Control = opening._display
	_press(opening, "Move_room-1-3")
	await game.arrived
	await process_frame
	_expect(game.run.data.map[game.run.area].type == "shop", "Seed 2 should offer the market")
	_press(opening, "Buy_lockpicks")
	_expect(game.run.coins == 0 and game.run.lockpicks, "Market purchase should change coins and inventory")
	_press(opening, "Move_room-2-3")
	await game.arrived
	await process_frame
	_expect(game.run.pending_mystery == "cache", "Seed 2 should lead from the market to the cache")
	_expect(opening.find_children("Move_*", "Button", true, false).is_empty(), "Mystery must block travel until a choice")
	var distance: int = game.run.distance
	_press(opening, "TakeMystery")
	await process_frame
	_expect(not game.run.lockpicks and game.run.coins == 2 and game.run.distance == distance, "The cache should consume the lockpick instead of escape margin")
	_expect(opening.find_child("Move_lift", true, false) != null, "Resolving the event must reopen the path")


func _capture(vp: SubViewport, id: String) -> void:
	if _capture_dir.is_empty():
		return
	await RenderingServer.frame_post_draw
	var saved := vp.get_texture().get_image().save_png(_capture_dir.path_join(id + ".png"))
	_expect(saved == OK, "Could not save screenshot " + id)


func _press(parent: Control, id: String) -> void:
	var control := parent.find_child(id, true, false) as Button
	_expect(control != null and not control.disabled, "Missing or disabled button: " + id)
	if control and not control.disabled:
		control.pressed.emit()


func _focus(vp: SubViewport, size: Vector2i, label: String) -> void:
	var focus := vp.gui_get_focus_owner()
	_expect(focus != null and Rect2(Vector2.ZERO, Vector2(size)).encloses(focus.get_global_rect()),
		"No visible keyboard focus on " + label)


func _expect(value: bool, message: String) -> void:
	if not value:
		_errors.append(message)
