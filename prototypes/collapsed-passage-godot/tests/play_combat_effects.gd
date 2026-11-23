extends SceneTree

const Startup := preload("res://ui/startup.tscn")
const CombatAudio := preload("res://ui/combat_audio.gd")
const VitalityMeter := preload("res://ui/vitality_meter.gd")
var _errors: Array[String] = []
var _cues: Array[String] = []


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var args := OS.get_cmdline_user_args()
	_check_hp_trail()
	for size in [Vector2i(1100, 740), Vector2i(900, 650)]:
		var viewport := SubViewport.new()
		viewport.size = size
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		root.add_child(viewport)
		var startup := Startup.instantiate()
		var path := "user://combat-effects-%s.cfg" % Crypto.new().generate_random_bytes(8).hex_encode()
		var saved := ConfigFile.new()
		saved.set_value("opening", "tutorial_v1", true)
		_expect(saved.save(path) == OK, "Could not prepare tutorial fixture")
		startup.tutorial_path = path
		viewport.add_child(startup)
		_press(startup, "StartRun")
		_press(startup, "OpeningSkip")
		var game: Control = startup._display
		game.set_process(false)
		game._audio.cue_triggered.connect(func(id: String): _cues.append(id))
		_cues.clear()
		_press(game, "BeginCombat")
		await process_frame
		_check_sound_toggle(game, size)
		var max_hp: float = game._fighters.enemy.hp.value
		_advance_until(game, func(): return game._active_event.get("card") == "strike")
		_expect(game._fighters.player.pose == "attack" and game._fighters.enemy.pose == "idle",
			"Attack pose begins before the defender reacts")
		_expect(game._effect._mode == "windup" and _has_cue(game, "attack"), "Attack has its own cue and motion")
		_expect(game._effect._emote != null and game._skill_bars.strike.activation.text == "발동",
			"Cast shows its shared skill art and highlights the charged slot")
		_expect(game._fighters.enemy.hp.value == max_hp, "HP should wait for contact")
		var contact_delay: float = game._contact_left

		game._pause.pressed.emit()
		game._process(0.5)
		_expect(game._audio.suspended and game._contact_left == contact_delay, "Manual pause suspends sound and windup")
		game._pause.pressed.emit()
		_press(game, "OpenCodex")
		game._process(0.5)
		_expect(game._audio.suspended and game._contact_left == contact_delay, "Codex suspends sound and windup")
		_press(startup._codex, "CloseCodex")
		_expect(not game._audio.suspended, "Closing the codex resumes sound")
		game._process(0.11)
		_expect(game._fighters.enemy.pose == "hit" and game._effect._event.get("dealt") == 2 and _has_cue(game, "hit"),
			"Contact plays the hit still, impact and low thud")
		_expect(game._fighters.enemy.hp.value == max_hp - 2, "Contact updates HP")
		_expect(game._fighters.enemy.hp.trail == max_hp, "Contact leaves the lost portion visible")
		game._pause.pressed.emit()
		game._process(1.5)
		_expect(game._fighters.enemy.hp.trail == max_hp, "White trail freezes while combat is paused")
		game._pause.pressed.emit()
		if args.size() == 1 and size.x == 1100:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-combat-hit.png")

		_press(game, "ToggleCombatAudio")
		_expect(not startup.sound_enabled and game._audio.get_child_count() == 0, "Muting stops active cues")
		_cues.clear()
		_advance_until(game, func(): return game._effect._event.get("type") == "guard")
		_expect(game._fighters.player.pose == "guard" and game._effect._event.get("added") == 3,
			"Guard uses its pose and the blue guard amount")
		_expect(_cues.is_empty(), "Muted guard still draws but schedules no sound")
		if args.size() == 1 and size.x == 1100:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-combat-guard.png")

		_press(game, "ToggleCombatAudio")
		_advance_until(game, func(): return game._active_event.get("from") == "enemy")
		game._process(0.11)
		_expect(game._effect._event.get("blocked") == 3 and game._effect._event.get("dealt") == 2,
			"Partial guard displays both blocked and received damage")
		_expect(_has_cue(game, "block-hit"), "Partial block has both metal clang and hit thud")
		if args.size() == 1 and size.x == 1100:
			await RenderingServer.frame_post_draw
			_capture(viewport, args[0], "godot-combat-block.png")
		_press(game, "ToggleCombatAudio")
		game._speed.pressed.emit()
		game._speed.pressed.emit()
		_advance_until(game, func(): return game._active_event.get("defeated", false))
		_expect(game.speed == 4 and game._contact_left < 0.03 and game._fighters.enemy.pose != "defeat",
			"Defeat waits for the finishing blow at 4× speed")
		game._process(0.03)
		_expect(game._fighters.enemy.pose == "defeat" and game._hold >= 0.9, "Finishing blow holds the defeat pose")
		_advance_until(game, func(): return game.run.phase == "recruit" and game._hold == 0.0)
		_press(game, "DeclineRecruit")
		_press(game, "SkipReward")
		_expect(_control(game, "ToggleCombatAudio").text == "효과음 끔", "Mute survives view changes")
		startup._show_home()
		_press(startup, "StartTraining")
		_check_training(startup._display)
		startup._display._audio.stop_cues()
		viewport.free()
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))

	if args.size() == 1:
		await _check_audio_bus()
	for error: String in _errors:
		push_error(error)
	if _errors.is_empty():
		print("Combat effects, one-second HP trail, pause, mute and session settings passed at both viewport sizes")
	quit(0 if _errors.is_empty() else 1)


func _check_hp_trail() -> void:
	var meter := VitalityMeter.new()
	meter.setup(30, 24, Color.AQUAMARINE)
	_expect(meter.value == 24 and meter.trail == 24, "Initial HP must not show a phantom hit")
	meter.set_health(16)
	meter.advance(0.99)
	_expect(meter.value == 16 and meter.trail == 24, "White layer holds for one second")
	meter.advance(0.21)
	_expect(meter.trail < 24 and meter.trail > 16, "White layer slides toward current HP")
	var before := meter.trail
	meter.set_health(9)
	meter.advance(0.99)
	_expect(meter.value == 9 and meter.trail == before, "A second hit renews the hold without jumping")
	meter.advance(0.57)
	_expect(meter.trail == 9 and meter.remaining_loss() == 0.0, "White layer catches up completely")
	meter.set_health(1)
	meter.set_health(12)
	_expect(meter.value == 12 and meter.trail == 12, "Healing updates both layers and clears the loss")
	meter.free()


func _check_training(game: Control) -> void:
	game.set_process(false)
	game._audio.cue_triggered.connect(func(id: String): _cues.append(id))
	_cues.clear()
	_expect(not game._audio.enabled, "A different run inherits the session's mute setting")
	_press(game, "ToggleCombatAudio")
	_press(game, "BeginCombat")
	_advance_until(game, func(): return game._projectile == "arrow" and game._effect._mode == "arrow")
	_expect(game._fighters.companion3.pose == "release" and not game._active_event.is_empty(),
		"Archers show release art while the arrow is in flight")
	_advance_until(game, func(): return game._effect._event.get("from") == "companion3")
	_expect(game._effect._mode == "impact", "Ranged impact displays only after the flight")
	game.run.player.body.legs.guard = 12
	_advance_until(game, func(): return game._active_event.get("from") == "enemy")
	_cues.clear()
	game._process(0.11)
	_expect(game._effect._event.get("dealt") == 0 and game._fighters.player.pose == "guard" and _cues == ["block"],
		"A full block uses the guard pose and metal cue without a damage cue")
	game.run.player.body.chest.hp = 3
	game.run.player.hp -= 4
	_advance_until(game, func(): return game._effect._mode == "healing")
	_expect(game._fighters.companion4.pose == "heal" and game._fighters.player.hp.value < game.run.player.hp,
		"Heal pose and projectile precede the health update")
	_advance_until(game, func(): return game._effect._event.get("type") == "heal")
	_expect(_has_cue(game, "heal") and game._fighters.player.hp.value == game.run.player.hp,
		"Healing contact updates the health and plays the heal cue")
	_check_multiple_contacts(game)
	_press(game, "TrainingMap")
	_press(game, "Move_lift")
	_press(game, "BeginCombat")
	_advance_until(game, func(): return game._last_gate == "bell")
	_expect(_has_cue(game, "bell"), "Bellboy has its own audible windup")


func _check_multiple_contacts(game: Control) -> void:
	_press(game, "TrainingPrep")
	game.run.set_rank(1, "companion3")
	game.run.set_training_skill("companion3", 0, "forkShot")
	_press(game, "BeginCombat")
	game.run.enemy_ready_at = 999999
	for slot: Dictionary in game.run.slots:
		if slot.id != "forkShot":
			slot.readyAt = 999999
	_press(game, "Inspect_enemy")
	_advance_until(game, func(): return game._active_event.get("card") == "forkShot")
	var first: String = game.run.events[0].targets[0]
	var second: String = game.run.events[1].targets[0]
	game._process(0.30)
	var readout: Control = game._body_readout
	var first_part: Dictionary = game.run.enemy.body[first]
	var second_part: Dictionary = game.run.enemy.body[second]
	_expect(readout._parts[first].amount.text.begins_with("%d/%d" % [first_part.hp, first_part.max]),
		"First arrow updates its own target on contact")
	_expect(readout._parts[second].amount.text.begins_with("%d/%d" % [second_part.max, second_part.max]),
		"Second arrow must not reveal damage before contact")
	_advance_until(game, func(): return game._effect._event.get("targets") == [second])
	_expect(readout._parts[second].amount.text.begins_with("%d/%d" % [second_part.hp, second_part.max]),
		"Second target updates on the second contact")


func _check_audio_bus() -> void:
	var capture := AudioEffectCapture.new()
	AudioServer.add_bus_effect(0, capture)
	var audio := CombatAudio.new()
	root.add_child(audio)
	for id in ["attack", "hit", "guard", "block"]:
		capture.clear_buffer()
		audio.cue(id)
		await create_timer(0.28).timeout
		_expect(_peak(capture) > 0.01, "No sound reached the output mix for " + id)
	audio.enabled = false
	await create_timer(0.05).timeout
	capture.clear_buffer()
	audio.cue("hit")
	await create_timer(0.15).timeout
	_expect(_peak(capture) < 0.0001, "Mute must produce silence in the output mix")
	audio.free()
	AudioServer.remove_bus_effect(0, 0)


func _peak(capture: AudioEffectCapture) -> float:
	var peak := 0.0
	for sample: Vector2 in capture.get_buffer(capture.get_frames_available()):
		peak = maxf(peak, maxf(absf(sample.x), absf(sample.y)))
	return peak


func _advance_until(game: Control, predicate: Callable) -> void:
	for tick in 900:
		if predicate.call():
			return
		game._process(0.025)
	_expect(false, "Combat feedback timed out")


func _check_sound_toggle(game: Control, size: Vector2i) -> void:
	var button := _control(game, "ToggleCombatAudio") as Button
	_expect(button.button_pressed and button.text == "효과음 켬", "Sound defaults on")
	_expect(Rect2(Vector2.ZERO, size).encloses(button.get_global_rect()), "Sound toggle outside viewport")


func _has_cue(game: Control, id: String) -> bool:
	return _cues.has(id) and (DisplayServer.get_name() == "headless" or game._audio.get_node_or_null("Cue_" + id) != null)


func _control(node: Node, id: String) -> Control:
	return node.find_child(id, true, false) as Control


func _press(node: Node, id: String) -> void:
	var button := _control(node, id) as Button
	_expect(button != null and not button.disabled, "Missing button " + id)
	if button != null:
		button.pressed.emit()


func _capture(viewport: SubViewport, directory: String, filename: String) -> void:
	_expect(viewport.get_texture().get_image().save_png(directory.path_join(filename)) == OK, "Capture failed")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_errors.append(message)
