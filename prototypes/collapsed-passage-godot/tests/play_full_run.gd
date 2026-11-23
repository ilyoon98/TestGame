extends SceneTree

const Startup := preload("res://ui/startup.tscn")
const Run := preload("res://combat/threshold_run.gd")
var _capture_dir := ""


func _initialize() -> void:
	call_deferred("_play")


func _play() -> void:
	var args := OS.get_cmdline_user_args()
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	_capture_dir = args[1] if args.size() > 1 else ""
	var startup := Startup.instantiate()
	startup.tutorial_path = "user://playthrough-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
	root.add_child(startup)
	await process_frame
	startup.find_child("Seed", true, false).text = fixture.seed
	await _capture("godot-full-run-title")
	_press(startup, "StartRun")
	for index in 8:
		assert(startup.view == "comic" and startup.step == index)
		assert(startup.find_child("ComicImage", true, false).texture != null)
		_press(startup, "OpeningNext")
	for index in 3:
		assert(startup.view == "tutorial" and startup.step == index)
		_press(startup, "OpeningNext")
	assert(startup.view == "game" and FileAccess.file_exists(startup.tutorial_path))
	var game: Control = startup._display
	var checkpoints := []
	for step: Array in fixture.steps:
		match String(step[0]):
			"fight":
				_press(game, "BeginCombat")
				while game.speed < 4:
					game._speed.pressed.emit()
				var deadline := Time.get_ticks_msec() + 20000
				while game.run.phase == "combat" or game._pending_screen:
					if Time.get_ticks_msec() > deadline:
						push_error("Game did not finish the battle at " + game.run.area)
						quit(1)
						return
					await process_frame
			"recruit": _press(game, "Recruit_" + step[1])
			"reward": _press(game, "Reward_" + step[1])
			"move":
				_press(game, "Move_" + step[1])
				await game.arrived
			"buy": _press(game, "Buy_" + step[1])
			"treat":
				_press(game, "Treat_%s_%s" % [step[1], step[2]])
				await _capture("godot-full-run-treatment")
		checkpoints.append(_snapshot(game.run))
	assert(game.run.phase == "won" and game.run.qa_uses == 0)
	assert(game.find_child("EscapeScene", true, false) != null)
	await _capture("godot-full-run-escape")
	print("PLAYTHROUGH ", JSON.stringify(checkpoints))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(startup.tutorial_path))
	quit()


func _snapshot(run: RefCounted) -> Dictionary:
	var allies := {}
	for side: String in ["player"] + Run.COMPANION_SIDES:
		var actor: Dictionary = run.get(side)
		if not actor.is_empty():
			allies[side] = {"hp": actor.hp, "body": actor.body, "skills": run.side_loadout(side)}
	return {
		"phase": run.phase, "area": run.area, "trail": run.trail, "time": run.combat_time, "distance": run.distance,
		"coins": run.coins, "formation": run.formation, "allies": allies, "levels": run.levels,
		"rewards": run.rewards, "enemyHp": run.enemy.hp,
	}.duplicate(true)


func _press(parent: Control, name: String) -> void:
	var button := parent.find_child(name, true, false) as Button
	assert(button != null and not button.disabled, "Unavailable control: " + name)
	button.pressed.emit()


func _capture(name: String) -> void:
	if _capture_dir.is_empty():
		return
	await RenderingServer.frame_post_draw
	assert(root.get_texture().get_image().save_png(_capture_dir.path_join(name + ".png")) == OK)
