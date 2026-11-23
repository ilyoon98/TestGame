extends SceneTree

const Screen := preload("res://ui/threshold.tscn")
const Run := preload("res://combat/threshold_run.gd")
var failures := 0


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(1100, 740)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var game := Screen.instantiate()
	game.run = Run.new("INJURY-ART", null, true)
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	var sprite: Control = game._fighters.player.sprite
	_expect(sprite.sprite_path.ends_with("nun-sd.png"), "Healthy portrait uses the ordinary art")
	_expect(game.run.set_training_injury("player", "arms", "lost"), "QA can set the arm state")
	game._refresh_combat()
	_expect(sprite.sprite_path.ends_with("arms-lost/nun-idle.webp"), "Arm loss uses the web variant")
	_expect(game.run.set_training_injury("player", "legs", "lost"), "QA can set the leg state")
	_expect(game.run.set_training_injury("player", "eyes", "lost"), "QA can set the eye state")
	game._refresh_combat()
	_expect(sprite.sprite_path.ends_with("legs-lost/nun-idle-arms-lost.webp"), "Arm and leg loss uses the kneeling variant")
	_expect(sprite._wound_art.eyeWraps.has(sprite.sprite_path), "Kneeling view has fitted eye-bandage coordinates")
	game._pose("player", "hit")
	_expect(sprite.sprite_path.ends_with("legs-lost/nun-hit-arms-lost.webp"), "Condition art follows the hit pose")
	var mark: Vector2 = sprite.anchor_at("eyes")
	_expect(sprite.get_global_rect().has_point(mark), "The effect anchor is inside the displayed frame")
	game._restore_poses()
	game.find_child("Inspect_player", true, false).pressed.emit()
	await _capture(viewport, "godot-injury-states.png")
	for part in ["arms", "legs", "eyes"]:
		game.run.set_training_injury("player", part, "healthy")
	game._refresh_combat()
	_expect(sprite.sprite_path.ends_with("nun-sd.png") and sprite._conditions.is_empty(), "Healing clears all persistent variants")
	game.free()
	game = Screen.instantiate()
	viewport.add_child(game)
	game.run.distance = 0
	game.run._lose("pursuit")
	game._show()
	var scene := game.find_child("CaptureScene", true, false) as Control
	scene.elapsed = 2.1
	await _capture(viewport, "godot-pursuit-capture.png")
	viewport.free()
	if failures == 0:
		print("Web arm, knee, eye and hit variants load and recover in a live battle scene")
	quit(int(failures > 0))


func _capture(viewport: SubViewport, filename: String) -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() == 1:
		await RenderingServer.frame_post_draw
		_expect(viewport.get_texture().get_image().save_png(args[0].path_join(filename)) == OK, "Capture failed")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		failures += 1
