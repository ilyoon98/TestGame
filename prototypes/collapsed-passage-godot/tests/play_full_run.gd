extends Node

const Startup := preload("res://ui/startup.tscn")
const Run := preload("res://combat/threshold_run.gd")
var _capture_dir := ""


func _ready() -> void:
	call_deferred("_play")


func _play() -> void:
	var args := OS.get_cmdline_user_args()
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var tree := get_tree()
	_capture_dir = args[1] if args.size() > 1 else ""
	var startup: Control
	if fixture.get("exported", false):
		if not _require(OS.has_feature("template") and not OS.has_feature("editor"), "Expected a standalone export template"):
			return
		await tree.process_frame
		startup = tree.current_scene as Control
		if not _require(startup != null and startup.scene_file_path == "res://ui/startup.tscn", "Export did not launch its normal startup scene"):
			return
	else:
		startup = Startup.instantiate()
		startup.tutorial_path = "user://playthrough-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
		tree.root.add_child(startup)
		await tree.process_frame
	if not _require(startup.view == "home" and not FileAccess.file_exists(startup.tutorial_path), "Expected a fresh launch at the title"):
		return
	startup.find_child("Seed", true, false).text = fixture.seed
	if not await _capture("godot-full-run-title") or not _press(startup, "StartRun"):
		return
	for index in 8:
		if not _require(startup.view == "comic" and startup.step == index, "Opening panel order differs"):
			return
		var comic := startup.find_child("ComicImage", true, false) as TextureRect
		if not _require(comic != null and comic.texture != null, "Opening panel is missing") or not _press(startup, "OpeningNext"):
			return
	for index in 3:
		if not _require(startup.view == "tutorial" and startup.step == index, "First-play tutorial order differs") or not _press(startup, "OpeningNext"):
			return
	if not _require(startup.view == "game" and FileAccess.file_exists(startup.tutorial_path), "Tutorial did not reach battle preparation"):
		return
	var game: Control = startup._display
	var checkpoints := []
	for step: Array in fixture.steps:
		match String(step[0]):
			"fight":
				if not _press(game, "BeginCombat"):
					return
				while game.speed < 4:
					game._speed.pressed.emit()
				var deadline := Time.get_ticks_msec() + 20000
				while game.run.phase == "combat" or game._pending_screen:
					if Time.get_ticks_msec() > deadline:
						push_error("Game did not finish the battle at " + game.run.area)
						tree.quit(1)
						return
					await tree.process_frame
			"recruit":
				if not _press(game, "Recruit_" + step[1]):
					return
			"reward":
				if not _press(game, "Reward_" + step[1]):
					return
			"move":
				if not _press(game, "Move_" + step[1]):
					return
				await game.arrived
			"buy":
				if not _press(game, "Buy_" + step[1]):
					return
			"treat":
				if not _press(game, "Treat_%s_%s" % [step[1], step[2]]) or not await _capture("godot-full-run-treatment"):
					return
		checkpoints.append(_snapshot(game.run))
	if not _require(game.run.phase == "won" and game.run.qa_uses == 0, "Run did not escape normally"):
		return
	if not _require(game.find_child("EscapeScene", true, false) != null, "Escape scene is missing") or not await _capture("godot-full-run-escape"):
		return
	print("PLAYTHROUGH ", JSON.stringify(checkpoints))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(startup.tutorial_path))
	tree.quit()


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


func _press(parent: Control, name: String) -> bool:
	var button := parent.find_child(name, true, false) as Button
	if not _require(button != null and not button.disabled, "Unavailable control: " + name):
		return false
	button.pressed.emit()
	return true


func _capture(name: String) -> bool:
	if _capture_dir.is_empty():
		return true
	await RenderingServer.frame_post_draw
	return _require(get_tree().root.get_texture().get_image().save_png(_capture_dir.path_join(name + ".png")) == OK, "Could not save " + name)


func _require(condition: bool, message: String) -> bool:
	if not condition:
		push_error(message)
		get_tree().quit(1)
	return condition
