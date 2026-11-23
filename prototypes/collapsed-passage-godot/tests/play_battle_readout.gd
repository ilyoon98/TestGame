extends SceneTree

const Screen := preload("res://ui/threshold.tscn")
const Run := preload("res://combat/threshold_run.gd")
var failures := 0


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(900, 650)
	root.add_child(viewport)
	var game := Screen.instantiate()
	game.run = Run.new("READOUT", null, true)
	game.run.set_rank(1, "companion3")
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	var readout: Control = game._body_readout
	game.find_child("Inspect_enemy", true, false).pressed.emit()
	_expect(readout._body.visible and readout._parts.head.amount.text.contains("가드 2"), "Enemy parts show actual guard")
	_expect(game._intent.text.contains("수녀 다리 5"), "Enemy attack names the recipient and target")
	game.find_child("Inspect_player", true, false).pressed.emit()
	_expect(readout._parts.legs.amount.text.contains("공격 예고"), "Threatened part is identified")
	_expect(game._skill_bars.aimedShot.time.text == "위치 제한", "Rank restriction is explicit")
	game.run.player.body.legs.guard = 8
	game.run.set_training_injury("player", "eyes", "lost")
	game._refresh_combat()
	_expect(game._intent.text.begins_with("?") and not game._intent.text.contains("3.5초"), "Lost eyes hide enemy intent and timer")
	_expect(readout._parts.legs.amount.text.contains("가드 ?") and not readout._parts.legs.amount.text.contains("공격 예고"),
		"Lost eyes conceal ally guard and forecast")
	game.run.set_training_injury("player", "arms", "lost")
	game._refresh_combat()
	_expect(game._skill_bars.heavy.time.text == "팔 결손", "Lost limb explains unavailable skills")
	game.run.set_training_injury("player", "arms", "healthy")
	game.run.set_training_injury("player", "eyes", "healthy")
	game.run.elapsed = 4300
	game._refresh_combat()
	_expect(game._skill_bars.mending.time.text == "회복 대기", "A charged heal waits for an eligible wound")
	game.find_child("Inspect_player", true, false).pressed.emit()
	_expect(not readout._body.visible, "Opening and closing body details does not rebuild the screen")
	_expect(not is_instance_valid(game.find_child("PursuitTrack", true, false)), "QA has no pursuit HUD")
	game.free()

	game = Screen.instantiate()
	game.run = Run.new("CHASE", null)
	viewport.add_child(game)
	game.set_process(false)
	game.find_child("BeginCombat", true, false).pressed.emit()
	await process_frame
	var screen_bounds := Rect2(Vector2.ZERO, Vector2(viewport.size))
	_expect(screen_bounds.encloses(game._pursuit_track.get_global_rect()) and
		screen_bounds.encloses(game._speed.get_global_rect()), "Pursuit art and controls fit the minimum viewport")
	var cues: Array[String] = []
	game._audio.cue_triggered.connect(func(id: String): cues.append(id))
	game.run.distance = 3
	game.run.elapsed = 2900
	game._refresh_combat()
	_expect(game._status.text.contains("0.1초 뒤 −1"), "Pursuit countdown uses battle time")
	game._process(0.1)
	# The ready strike is resolved first without advancing the clock.
	for tick in 30:
		if game.run.distance == 2:
			break
		game._process(0.1)
	_expect(game.run.distance == 2 and game._pursuit_track._urgent and cues.count("pursuit") == 1,
		"Pursuit threshold warns once as the pursuer advances")
	game._refresh_status()
	_expect(cues.count("pursuit") == 1, "Refreshing the HUD does not replay the warning")
	viewport.free()
	if failures == 0:
		print("Body inspection, hidden intent, cooldown reasons and pursuit warning passed")
	quit(int(failures > 0))


func _expect(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		failures += 1
