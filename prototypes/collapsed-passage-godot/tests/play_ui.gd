extends SceneTree

const Screen := preload("res://ui/threshold.tscn")
const Run := preload("res://combat/threshold_run.gd")
var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var args := OS.get_cmdline_user_args()
	for route: String in ["infirmary", "corridor", "duct"]:
		var size := Vector2i(1100, 740) if route == "infirmary" else Vector2i(900, 650)
		var vp := SubViewport.new()
		vp.size = size
		vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(vp)
		var ui := Screen.instantiate()
		ui.run = Run.new("THRESHOLD", null)
		vp.add_child(ui)
		await process_frame
		await process_frame
		_check_focused(vp, size, "prep")
		if args.size() == 1 and size.x == 1100:
			await _capture(vp, args[0], "godot-threshold-prep")

		_press(ui, "BeginCombat")
		await process_frame
		_check_focused(vp, size, "combat")
		if args.size() == 1 and size.x == 1100:
			await _capture(vp, args[0], "godot-threshold-combat")
		# Drive the normal UI timer with a fixed delta instead of waiting in real time.
		ui.set_process(false)
		for i in 300:
			if ui.find_child("Recruit_guard", true, false):
				break
			ui._process(0.1)
		await process_frame
		_check_focused(vp, size, "recruit")
		if args.size() == 1 and size.x == 1100:
			await _capture(vp, args[0], "godot-threshold-recruit")
		var recruit := route != "duct"
		_press(ui, "Recruit_guard" if recruit else "DeclineRecruit")
		await process_frame
		_check_focused(vp, size, "reward")
		if args.size() == 1 and size.x == 1100:
			await _capture(vp, args[0], "godot-threshold-rewards")
		var chosen: String = ui.run.rewards[1 if route == "corridor" else 0] if recruit else ""
		_press(ui, "Reward_" + chosen if recruit else "SkipReward")
		await process_frame
		_check_focused(vp, size, "route")
		_expect(ui.run.phase == "route", "Reward choice must open the map")
		_expect(ui.find_children("Move_*", "Button", true, false).size() == 3, "Only three adjacent rooms may be selected")
		if args.size() == 1 and size.x == 1100:
			await _capture(vp, args[0], "godot-threshold-route")
		_press(ui, "Move_" + route)
		await ui.arrived
		await process_frame
		_expect(ui.run.area == route, "Selected room must become the current location")
		_expect(ui.run.distance == 5, "First room must add two escape points")
		_expect(ui.run.player.hp == 26 and ui.run.player.body.legs.hp == 5, "The nun's damage must carry forward")
		_expect(ui.run.companion.is_empty() == not recruit, "Recruit decision must persist")
		if recruit:
			_expect(ui.run.companion.hp == 16 and ui.run.companion.body.arms.hp == 3, "The guard's injury must carry forward")
			_expect(ui.run.levels[chosen] == (2 if route == "corridor" else 1), "Learned reward must be kept")
		if route == "corridor":
			_check_focused(vp, size, "rest")
			var guest := ui.find_child("Guest_guard", true, false)
			_expect(guest != null and guest.sprite_path.ends_with("camp-poses/guard-normal.webp"), "Living guard rests beside the campfire")
			if args.size() == 1:
				await _capture(vp, args[0], "godot-camp-rest")
			_press(ui, "Treat_companion_arms")
			await process_frame
			guest = ui.find_child("Guest_guard", true, false)
			_expect(guest != null and guest.sprite_path.ends_with("guard-sd.png"), "Camp switches to the standing party after treatment")
			_expect(ui.run.companion.body.arms.hp == 5 and ui.run.player.body.legs.hp == 5, "Treatment must target only the selected part")
			_expect(ui.find_children("Treat_*", "Button", true, false).is_empty(), "Treatment can only be used once")
			_press(ui, "Move_landing")
			await ui.arrived
			await process_frame
			_expect(ui.run.area == "landing" and ui.run.distance == 6, "Landing follows rest and adds one more travel gain")
		_expect(ui.run.phase == "prep" and ui.run.area != "threshold", "Arrival must open the next room's preparation")
		_expect(ui.find_child("BeginCombat", true, false) != null, "Next fight must be playable")
		_check_focused(vp, size, "arrival")
		if args.size() == 1 and size.x == 1100:
			await _capture(vp, args[0], "godot-threshold-arrival")
		if route == "infirmary":
			_press(ui, "Equip_guard")
			_press(ui, "Equip_" + chosen)
			_expect(ui.run.loadout.has(chosen), "Learned card can be equipped in the next room")
		ui.speed = 4
		_fight(ui)
		await process_frame
		for i in 2:
			if ui.run.phase != "recruit":
				break
			var button := "Recruit_" + String(ui.run.pending_recruit)
			if ui.find_child(button, true, false):
				_press(ui, button)
			else:
				_press(ui, "Replace_companion" if route == "infirmary" else "DeclineRecruit")
		if ui.run.phase == "reward":
			_press(ui, "Reward_" + ui.run.rewards[0])
		if ui.run.phase == "route":
			_press(ui, "Move_lift")
			await ui.arrived
			await process_frame
			_check_focused(vp, size, "lift prep")
			if args.size() == 1 and route == "corridor":
				_press(ui, "BeginCombat")
				for i in 280:
					if ui.run.phase != "combat" or ui.run.gate_phase() == "bell":
						break
					ui._process(0.1)
				await _capture(vp, args[0], "godot-first-stage-bellboy")
				_finish_fight(ui)
			else:
				_fight(ui)
		if ui.run.phase == "route":
			_press(ui, "Move_exit")
			await ui.arrived
		await process_frame
		if route == "corridor":
			_expect(ui.run.phase == "won", "The stairs example should escape")
			_expect(ui.find_child("EscapeScene", true, false) != null and ui.find_child("Guest_nun", true, false) != null,
				"The exit scene shows surviving companions")
			if args.size() == 1:
				await _capture(vp, args[0], "godot-first-stage-escaped")
		_expect(ui.run.phase in ["won", "lost"], "Stage must reach a terminal screen")
		_check_focused(vp, size, "stage complete")
		_press(ui, "Restart")
		_expect(ui.run.phase == "prep" and ui.run.area == "threshold" and ui.run.companion.is_empty(), "Restart must reset the run")
		vp.free()
	if not _failures.is_empty():
		for failure in _failures:
			push_error(failure)
		quit(1)
		return
	print("All three routes, later battles, recruitment, escape and keyboard focus passed at 1100×740 and 900×650")
	quit()


func _fight(ui: Control) -> void:
	_press(ui, "BeginCombat")
	_finish_fight(ui)


func _finish_fight(ui: Control) -> void:
	for tick in 1500:
		if ui.find_child("BeginCombat", true, false) == null and ui.run.phase != "combat" and ui._hold == 0:
			return
		ui._process(0.1)
	_expect(false, "Combat did not finish")


func _press(ui: Control, button_name: String) -> void:
	var button := ui.find_child(button_name, true, false) as Button
	_expect(button != null and not button.disabled, "Missing or disabled button: " + button_name)
	if button != null and not button.disabled:
		button.pressed.emit()


func _check_focused(vp: SubViewport, size: Vector2i, screen: String) -> void:
	var focus := vp.gui_get_focus_owner()
	_expect(focus != null, "No focus on %s at %s" % [screen, size])
	if focus == null:
		return
	_expect(Rect2(Vector2.ZERO, Vector2(size)).encloses(focus.get_global_rect()),
		"Focused button outside viewport on %s at %s: %s" % [screen, size, focus.get_global_rect()])


func _capture(vp: SubViewport, directory: String, name: String) -> void:
	await RenderingServer.frame_post_draw
	var result := vp.get_texture().get_image().save_png(directory.path_join(name + ".png"))
	_expect(result == OK, "Could not save capture: " + name)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
